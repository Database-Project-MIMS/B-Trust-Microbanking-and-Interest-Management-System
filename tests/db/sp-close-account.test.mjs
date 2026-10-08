import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Load .env if not already in environment
if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile();
    } catch {
        // ignore if loaded by runner
    }
}

const connectionString =
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

const TEST_PREFIX = "TEST-CLOSE-P04T02-";

// Fixture rows live in ONE transaction that is rolled back in after(); nothing is committed. Each
// check that is expected to fail runs inside a SAVEPOINT so the transaction survives it. The lock
// tests use a second connection against a SEEDED account and only take and release row locks.
describe("P04-M03-T02: sp_close_account and trg_account_close_guard (BR-18)", () => {
    let client;
    let agent;
    let otherBranchId;
    let adultPlanId;
    let fdPlanId;
    let seq = 0;

    async function openAccount({ balance = "0.00", status = "ACTIVE" } = {}) {
        seq += 1;
        const res = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [adultPlanId, agent.branch_id, agent.agent_id, `${TEST_PREFIX}${seq}`],
        );
        const accountId = res.rows[0].account_id;
        await client.query(
            "UPDATE account SET current_balance = $2, status = $3 WHERE account_id = $1",
            [accountId, balance, status],
        );
        return accountId;
    }

    async function addFd(accountId, status) {
        await client.query(
            `INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening,
                                        start_date, maturity_date, next_interest_date, status)
             VALUES ($1, $2, 10000.00, 0.1400, CURRENT_DATE, CURRENT_DATE + 365, CURRENT_DATE + 30, $3)`,
            [accountId, fdPlanId, status],
        );
    }

    async function statusOf(accountId) {
        const res = await client.query("SELECT status FROM account WHERE account_id = $1", [accountId]);
        return res.rows[0].status;
    }

    async function closeCall(accountId, actor = agent.agent_id) {
        return client.query("CALL sp_close_account($1, $2, NULL)", [accountId, actor]);
    }

    // Runs `work` in a savepoint and returns the error it raised (or null), always rolling back.
    async function raised(work) {
        await client.query("SAVEPOINT attempt");
        try {
            await work();
            return null;
        } catch (error) {
            return error;
        } finally {
            await client.query("ROLLBACK TO SAVEPOINT attempt");
        }
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        await client.query("BEGIN");

        const plan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'");
        adultPlanId = plan.rows[0]?.plan_id;
        assert.ok(adultPlanId, "seeded Adult plan is required");
        const fdPlan = await client.query("SELECT fd_plan_id FROM fd_plan ORDER BY tenure_months LIMIT 1");
        fdPlanId = fdPlan.rows[0]?.fd_plan_id;
        assert.ok(fdPlanId, "a seeded fd_plan is required");
        const found = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        agent = found.rows[0];
        assert.ok(agent, "a seeded active agent is required");
        const other = await client.query("SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1", [agent.branch_id]);
        otherBranchId = other.rows[0].branch_id;

        // The acting user for the whole transaction; sp_close_account must agree with it.
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [agent.agent_id]);
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("1. Closing an ACTIVE zero-balance account with no FD succeeds, returns the time and audits it", async () => {
        const accountId = await openAccount();
        const res = await closeCall(accountId);
        assert.ok(res.rows[0].p_closed_at instanceof Date);
        assert.equal(await statusOf(accountId), "CLOSED");

        const audits = await client.query(
            "SELECT user_id, actor_type, action, old_values, new_values FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'CLOSE'",
            [accountId],
        );
        assert.equal(audits.rows.length, 1);
        assert.equal(audits.rows[0].user_id, agent.agent_id);
        assert.equal(audits.rows[0].actor_type, "USER");
        assert.equal(audits.rows[0].old_values.status, "ACTIVE");
        assert.equal(audits.rows[0].new_values.status, "CLOSED");

        // trg_audit_account (0200) also records the UPDATE for the same acting user.
        const generic = await client.query(
            "SELECT user_id, actor_type, new_values FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'UPDATE'",
            [accountId],
        );
        assert.ok(generic.rows.some((row) => row.user_id === agent.agent_id && row.actor_type === "USER" && row.new_values.status === "CLOSED"));
    });

    test("2. A non-zero balance is rejected with BALANCE_NOT_ZERO and the status is unchanged", async () => {
        const accountId = await openAccount({ balance: "0.01" });
        const error = await raised(() => closeCall(accountId));
        assert.equal(error.code, "P0001");
        assert.equal(error.constraint, "ck_close_account_balance");
        assert.match(error.message, /^BALANCE_NOT_ZERO/);
        assert.equal(await statusOf(accountId), "ACTIVE");
    });

    test("3. An ACTIVE fixed deposit is rejected with ACTIVE_FD_EXISTS and the status is unchanged", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "ACTIVE");
        const error = await raised(() => closeCall(accountId));
        assert.equal(error.constraint, "ck_close_account_active_fd");
        assert.match(error.message, /^ACTIVE_FD_EXISTS/);
        assert.equal(await statusOf(accountId), "ACTIVE");
    });

    test("4. MATURED and CLOSED fixed deposits do not block closing (only ACTIVE ones do)", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "MATURED");
        await addFd(accountId, "CLOSED");
        await closeCall(accountId);
        assert.equal(await statusOf(accountId), "CLOSED");
    });

    test("5. Balance is checked before the FD: a non-zero balance with an ACTIVE FD reports the balance", async () => {
        const accountId = await openAccount({ balance: "5.00" });
        await addFd(accountId, "ACTIVE");
        const error = await raised(() => closeCall(accountId));
        assert.equal(error.constraint, "ck_close_account_balance");
    });

    test("6. Closing twice gives ACCOUNT_ALREADY_CLOSED and writes no second CLOSE audit", async () => {
        const accountId = await openAccount();
        await closeCall(accountId);
        const error = await raised(() => closeCall(accountId));
        assert.equal(error.constraint, "ck_close_account_already_closed");
        const audits = await client.query(
            "SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1 AND action = 'CLOSE'",
            [accountId],
        );
        assert.equal(audits.rows[0].n, 1);
    });

    test("7. A FROZEN account cannot be closed (ACCOUNT_NOT_ACTIVE) and stays frozen", async () => {
        const accountId = await openAccount({ status: "FROZEN" });
        const error = await raised(() => closeCall(accountId));
        assert.equal(error.constraint, "ck_close_account_not_active");
        assert.equal(await statusOf(accountId), "FROZEN");
    });

    test("8. Unknown account gives ACCOUNT_NOT_FOUND; NULL or mismatched actor gives ACTOR_MISMATCH", async () => {
        const unknown = await raised(() => client.query("CALL sp_close_account(gen_random_uuid(), $1, NULL)", [agent.agent_id]));
        assert.equal(unknown.constraint, "ck_close_account_not_found");

        const accountId = await openAccount();
        const noActor = await raised(() => client.query("CALL sp_close_account($1, NULL, NULL)", [accountId]));
        assert.equal(noActor.constraint, "ck_close_account_actor");
        const wrongActor = await raised(() => client.query("CALL sp_close_account($1, gen_random_uuid(), NULL)", [accountId]));
        assert.equal(wrongActor.constraint, "ck_close_account_actor");
        assert.equal(await statusOf(accountId), "ACTIVE");
    });

    test("9. Guard trigger: a direct UPDATE to CLOSED fails for a non-zero balance and for an ACTIVE FD", async () => {
        const funded = await openAccount({ balance: "10.00" });
        const balanceError = await raised(() => client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [funded]));
        assert.equal(balanceError.constraint, "ck_close_account_balance");

        const withFd = await openAccount();
        await addFd(withFd, "ACTIVE");
        const fdError = await raised(() => client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [withFd]));
        assert.equal(fdError.constraint, "ck_close_account_active_fd");

        assert.equal(await statusOf(funded), "ACTIVE");
        assert.equal(await statusOf(withFd), "ACTIVE");
    });

    test("10. Guard trigger only fires on a move to CLOSED: other updates and an eligible close still work", async () => {
        const accountId = await openAccount({ balance: "10.00" });
        await addFd(accountId, "ACTIVE");
        // Freezing a funded account with an FD is not a close and is not blocked by this rule.
        await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [accountId]);
        assert.equal(await statusOf(accountId), "FROZEN");

        const eligible = await openAccount();
        await client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [eligible]);
        assert.equal(await statusOf(eligible), "CLOSED");
        // An already-closed account may be touched again (WHEN OLD.status IS DISTINCT FROM 'CLOSED').
        await client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [eligible]);
    });

    test("11. Guard trigger sees an FD that row-level security hides from the caller", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "ACTIVE");
        await client.query("SAVEPOINT as_manager");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', 'BRANCH_MANAGER', true)`,
                [agent.agent_id, agent.branch_id],
            );
            // The FD policy needs an account holder in scope and a current stored actor, so the
            // caller cannot read the row: a caller-side check would wrongly allow the close.
            const visible = await client.query("SELECT count(*)::int AS n FROM fixed_deposit WHERE account_id = $1", [accountId]);
            assert.equal(visible.rows[0].n, 0, "the FD must be invisible to this caller for the test to mean anything");

            await client.query("SAVEPOINT direct");
            await assert.rejects(
                client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [accountId]),
                (error) => error.constraint === "ck_close_account_active_fd",
            );
            await client.query("ROLLBACK TO SAVEPOINT direct");

            // sp_close_account's own check is caller-scoped, so here the trigger is what stops it.
            await client.query("SAVEPOINT via_sp");
            await assert.rejects(
                client.query("CALL sp_close_account($1, $2, NULL)", [accountId, agent.agent_id]),
                (error) => error.constraint === "ck_close_account_active_fd",
            );
            await client.query("ROLLBACK TO SAVEPOINT via_sp");
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_manager");
        }
        assert.equal(await statusOf(accountId), "ACTIVE");
    });

    test("12. As mims_app under RLS: an in-scope manager closes; another branch or no context gets ACCOUNT_NOT_FOUND", async () => {
        const accountId = await openAccount();
        const scope = (branchId, role = "BRANCH_MANAGER") =>
            client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', $3, true)`,
                [agent.agent_id, branchId, role],
            );
        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");

            await scope(otherBranchId);
            await client.query("SAVEPOINT elsewhere");
            await assert.rejects(closeCall(accountId), (error) => error.constraint === "ck_close_account_not_found");
            await client.query("ROLLBACK TO SAVEPOINT elsewhere");

            await scope("", "");
            await client.query("SAVEPOINT no_context");
            await assert.rejects(closeCall(accountId), (error) => error.constraint === "ck_close_account_not_found");
            await client.query("ROLLBACK TO SAVEPOINT no_context");

            await scope(agent.branch_id);
            const res = await closeCall(accountId);
            assert.ok(res.rows[0].p_closed_at instanceof Date);
            assert.equal(await statusOf(accountId), "CLOSED");
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_app");
        }
    });

    test("13. mims_app holds EXECUTE on sp_close_account but not on the trigger function", async () => {
        const res = await client.query(
            "SELECT has_function_privilege('mims_app', 'fn_account_close_guard()', 'EXECUTE') AS guard_exec",
        );
        assert.equal(res.rows[0].guard_exec, false);
        const proc = await client.query(
            "SELECT has_function_privilege('mims_app', p.oid, 'EXECUTE') AS ok, p.prosecdef FROM pg_proc p WHERE p.proname = 'sp_close_account'",
        );
        assert.equal(proc.rows.length, 1);
        assert.equal(proc.rows[0].ok, true);
        assert.equal(proc.rows[0].prosecdef, false, "sp_close_account is SECURITY INVOKER so RLS applies");
        const guard = await client.query("SELECT prosecdef FROM pg_proc WHERE proname = 'fn_account_close_guard'");
        assert.equal(guard.rows[0].prosecdef, true);
    });

    test("14. sp_close_account locks with FOR UPDATE, which conflicts with the KEY SHARE an FD insert takes", async () => {
        const def = (await client.query("SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p WHERE p.proname = 'sp_close_account'")).rows[0].def;
        assert.match(def, /FOR UPDATE/);
        assert.doesNotMatch(def, /FOR NO KEY UPDATE/);

        // The premise: while one transaction holds FOR UPDATE on an account row, inserting an FD for it waits.
        const seeded = await client.query(
            "SELECT account_id FROM account WHERE account_number NOT LIKE $1 ORDER BY account_number LIMIT 1",
            [`${TEST_PREFIX}%`],
        );
        const accountId = seeded.rows[0].account_id;
        const writer = new pg.Client({ connectionString });
        await writer.connect();
        try {
            await client.query("SAVEPOINT lock_probe");
            await client.query("SELECT account_id FROM account WHERE account_id = $1 FOR UPDATE", [accountId]);

            await writer.query("BEGIN");
            await writer.query("SET LOCAL lock_timeout = '300ms'");
            await assert.rejects(
                writer.query(
                    `INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening,
                                                start_date, maturity_date, next_interest_date, status)
                     VALUES ($1, $2, 1.00, 0.1400, CURRENT_DATE, CURRENT_DATE + 365, CURRENT_DATE + 30, 'ACTIVE')`,
                    [accountId, fdPlanId],
                ),
                (error) => error.code === "55P03",
            );
            await writer.query("ROLLBACK");
        } finally {
            await writer.end();
            // Releases the row lock so nothing else waits on this seeded account.
            await client.query("ROLLBACK TO SAVEPOINT lock_probe");
        }
    });
});

// A real race needs rows another connection can see, so these fixtures are COMMITTED and removed in
// after(). (audit_log is append-only, so the audit rows the account trigger wrote for them remain.)
describe("P04-M03-T02: closing waits for an in-flight fixed-deposit insert (committed fixtures)", () => {
    const RACE_PREFIX = "TEST-CLOSE-RACE-";
    let owner;
    let agent;
    let adultPlanId;
    let fdPlanId;

    before(async () => {
        owner = new pg.Client({ connectionString });
        await owner.connect();
        adultPlanId = (await owner.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0]?.plan_id;
        fdPlanId = (await owner.query("SELECT fd_plan_id FROM fd_plan ORDER BY tenure_months LIMIT 1")).rows[0]?.fd_plan_id;
        agent = (await owner.query("SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1")).rows[0];
        assert.ok(adultPlanId && fdPlanId && agent, "seeded plan, fd_plan and agent are required");
    });

    after(async () => {
        const mine = "SELECT account_id FROM account WHERE account_number LIKE $1";
        await owner.query(`DELETE FROM fixed_deposit WHERE account_id IN (${mine})`, [`${RACE_PREFIX}%`]);
        await owner.query("DELETE FROM account WHERE account_number LIKE $1", [`${RACE_PREFIX}%`]);
        await owner.end();
    });

    async function committedAccount() {
        const res = await owner.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [adultPlanId, agent.branch_id, agent.agent_id, `${RACE_PREFIX}${randomUUID().slice(0, 12)}`],
        );
        return res.rows[0].account_id;
    }

    // An FD insert is in flight (uncommitted); the close starts, must wait, and must then see the FD.
    async function closeRacesAgainstFdInsert(closeSql) {
        const accountId = await committedAccount();
        const writer = new pg.Client({ connectionString });
        const closer = new pg.Client({ connectionString });
        await writer.connect();
        await closer.connect();
        try {
            await writer.query("BEGIN");
            await writer.query(
                `INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening,
                                            start_date, maturity_date, next_interest_date, status)
                 VALUES ($1, $2, 1000.00, 0.1400, CURRENT_DATE, CURRENT_DATE + 365, CURRENT_DATE + 30, 'ACTIVE')`,
                [accountId, fdPlanId],
            );

            await closer.query("BEGIN");
            await closer.query("SELECT set_config('app.current_user_id', $1, true)", [agent.agent_id]);
            let settled = false;
            const outcome = closer.query(closeSql, [accountId, agent.agent_id].slice(0, closeSql.includes("$2") ? 2 : 1))
                .then(() => ({ error: null }), (error) => ({ error }))
                .finally(() => { settled = true; });

            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "the close must wait while an FD insert for the account is in flight");

            await writer.query("COMMIT");
            const { error } = await outcome;
            assert.ok(error, "the close must be rejected once the FD is committed");
            assert.equal(error.constraint, "ck_close_account_active_fd");
            await closer.query("ROLLBACK");

            const status = await owner.query("SELECT status FROM account WHERE account_id = $1", [accountId]);
            assert.equal(status.rows[0].status, "ACTIVE");
        } finally {
            await writer.query("ROLLBACK").catch(() => {});
            await closer.query("ROLLBACK").catch(() => {});
            await writer.end();
            await closer.end();
        }
    }

    test("15. A direct UPDATE to CLOSED waits for an in-flight FD insert, then sees it and is rejected", async () => {
        await closeRacesAgainstFdInsert("UPDATE account SET status = 'CLOSED' WHERE account_id = $1");
    });

    test("16. sp_close_account waits for an in-flight FD insert, then sees it and is rejected", async () => {
        await closeRacesAgainstFdInsert("CALL sp_close_account($1, $2, NULL)");
    });

    test("17. With no FD in flight, a committed zero-balance account closes normally", async () => {
        const accountId = await committedAccount();
        const closer = new pg.Client({ connectionString });
        await closer.connect();
        try {
            await closer.query("BEGIN");
            await closer.query("SELECT set_config('app.current_user_id', $1, true)", [agent.agent_id]);
            await closer.query("CALL sp_close_account($1, $2, NULL)", [accountId, agent.agent_id]);
            await closer.query("COMMIT");
        } finally {
            await closer.end();
        }
        const status = await owner.query("SELECT status FROM account WHERE account_id = $1", [accountId]);
        assert.equal(status.rows[0].status, "CLOSED");
    });
});
