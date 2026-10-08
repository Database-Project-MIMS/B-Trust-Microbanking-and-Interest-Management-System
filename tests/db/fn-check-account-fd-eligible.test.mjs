import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
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

const TEST_PREFIX = "TEST-FDE-P04T01-";

// Fixture rows (accounts, customers, fixed deposits) live in ONE transaction that is rolled back in
// after(). Nothing is committed, and the functions write no audit rows, so nothing is left behind. The
// lock tests use a second connection against a SEEDED account (committed data) and only take and
// release row locks; they never change committed data.
describe("P04-M03-T01: fn_check_account_fd_eligible / fn_fd_funding_verdict (I-6)", () => {
    let client;
    let agent;
    let otherBranchId;
    let adultPlanId;
    let fdPlanId;
    let seq = 0;

    async function openAccount({ balance = "50000.00", status = "ACTIVE" } = {}) {
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

    async function verdict(accountId, principal) {
        const res = await client.query("SELECT fn_fd_funding_verdict($1, $2) AS v", [accountId, principal]);
        return res.rows[0].v;
    }

    async function eligible(accountId) {
        const res = await client.query("SELECT fn_check_account_fd_eligible($1) AS ok", [accountId]);
        return res.rows[0].ok;
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
            `SELECT a.agent_id, a.branch_id FROM agent a
             JOIN app_user u ON u.user_id = a.agent_id AND u.status = 'ACTIVE'
             JOIN role r ON r.role_id = u.role_id AND r.role_name = 'AGENT' AND r.status = 'ACTIVE'
             WHERE a.status = 'ACTIVE' ORDER BY a.employee_no LIMIT 1`,
        );
        agent = found.rows[0];
        assert.ok(agent, "a seeded active agent is required");
        const other = await client.query(
            "SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1",
            [agent.branch_id],
        );
        otherBranchId = other.rows[0].branch_id;
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("0. fn_check_account_fd_eligible (card contract): true only for an existing ACTIVE account", async () => {
        const active = await openAccount({ balance: "0.00" });
        const frozen = await openAccount({ status: "FROZEN" });
        const closed = await openAccount({ balance: "0.00", status: "CLOSED" });
        assert.equal(await eligible(active), true, "status only: a zero balance does not matter");
        assert.equal(await eligible(frozen), false);
        assert.equal(await eligible(closed), false);
        assert.equal(await eligible(null), false);
        const unknown = await client.query("SELECT fn_check_account_fd_eligible(gen_random_uuid()) AS ok");
        assert.equal(unknown.rows[0].ok, false);
    });

    test("0b. fn_check_account_fd_eligible does not look at an existing FD or take a lock (caller's job)", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "ACTIVE");
        assert.equal(await eligible(accountId), true, "one-active-FD is the index's and the verdict's job");
    });

    test("1. An active account with no FD and enough balance is eligible", async () => {
        const accountId = await openAccount({ balance: "50000.00" });
        assert.equal(await verdict(accountId, "10000.00"), "OK");
    });

    test("2. Balance boundary: exactly the principal passes, one cent less fails", async () => {
        const accountId = await openAccount({ balance: "10000.00" });
        assert.equal(await verdict(accountId, "10000.00"), "OK");
        assert.equal(await verdict(accountId, "10000.01"), "INSUFFICIENT_BALANCE");
        assert.equal(await verdict(accountId, "9999.99"), "OK");
    });

    test("3. NULL, zero and negative principal give INVALID_PRINCIPAL, never an error", async () => {
        const accountId = await openAccount();
        assert.equal(await verdict(accountId, null), "INVALID_PRINCIPAL");
        assert.equal(await verdict(accountId, "0.00"), "INVALID_PRINCIPAL");
        assert.equal(await verdict(accountId, "-1.00"), "INVALID_PRINCIPAL");
        assert.equal(await verdict(null, "1000.00"), "INVALID_PRINCIPAL");
    });

    test("4. An unknown account gives ACCOUNT_NOT_FOUND", async () => {
        const res = await client.query(
            "SELECT fn_fd_funding_verdict(gen_random_uuid(), 1000.00) AS v, fn_check_account_fd_eligible(gen_random_uuid()) AS ok",
        );
        assert.equal(res.rows[0].v, "ACCOUNT_NOT_FOUND");
        assert.equal(res.rows[0].ok, false);
    });

    test("5. FROZEN and CLOSED accounts give ACCOUNT_NOT_ACTIVE (BR-11)", async () => {
        const frozen = await openAccount({ status: "FROZEN" });
        const closed = await openAccount({ balance: "0.00", status: "CLOSED" });
        assert.equal(await verdict(frozen, "1000.00"), "ACCOUNT_NOT_ACTIVE");
        assert.equal(await verdict(closed, "1000.00"), "ACCOUNT_NOT_ACTIVE");
    });

    test("6. An ACTIVE fixed deposit blocks a second one (BR-12)", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "ACTIVE");
        assert.equal(await verdict(accountId, "1000.00"), "ACTIVE_FD_EXISTS");
    });

    test("7. MATURED and CLOSED fixed deposits do not block a new one (ADR-0011)", async () => {
        const accountId = await openAccount();
        await addFd(accountId, "MATURED");
        await addFd(accountId, "CLOSED");
        assert.equal(await verdict(accountId, "1000.00"), "OK");
    });

    test("8. Reasons are reported in order: not-active before active-FD before balance", async () => {
        const frozenWithFd = await openAccount({ balance: "1.00", status: "FROZEN" });
        await addFd(frozenWithFd, "ACTIVE");
        assert.equal(await verdict(frozenWithFd, "1000.00"), "ACCOUNT_NOT_ACTIVE");

        const poorWithFd = await openAccount({ balance: "1.00" });
        await addFd(poorWithFd, "ACTIVE");
        assert.equal(await verdict(poorWithFd, "1000.00"), "ACTIVE_FD_EXISTS");

        const poor = await openAccount({ balance: "1.00" });
        assert.equal(await verdict(poor, "1000.00"), "INSUFFICIENT_BALANCE");
    });

    test("9. The plan minimum is deliberately not applied: the whole balance may fund an FD", async () => {
        // Adult minimum is 1,000.00; BR-09 governs withdrawals, the I-6 card asks only for ACTIVE + balance.
        const accountId = await openAccount({ balance: "5000.00" });
        assert.equal(await verdict(accountId, "5000.00"), "OK");
    });

    test("10. The check changes nothing: no balance change, no ledger row, no audit row", async () => {
        const accountId = await openAccount({ balance: "7000.00" });
        const counts = async () =>
            (
                await client.query(
                    `SELECT (SELECT count(*) FROM transaction WHERE account_id = $1)::int AS txns,
                            (SELECT count(*) FROM audit_log)::int AS audits,
                            (SELECT current_balance FROM account WHERE account_id = $1) AS balance`,
                    [accountId],
                )
            ).rows[0];
        const before = await counts();
        await verdict(accountId, "5000.00");
        await verdict(accountId, "999999.00");
        assert.deepEqual(await counts(), before);
    });

    test("11. It takes the account row lock: a second connection cannot lock the row until commit/rollback", async () => {
        // Use a committed, seeded account; this connection only locks and then rolls back.
        const seeded = await client.query(
            "SELECT account_id FROM account WHERE account_number NOT LIKE $1 ORDER BY account_number LIMIT 1",
            [`${TEST_PREFIX}%`],
        );
        const accountId = seeded.rows[0]?.account_id;
        assert.ok(accountId, "a seeded account is required for the lock test");

        const other = new pg.Client({ connectionString });
        await other.connect();
        try {
            await client.query("SAVEPOINT lock_probe");
            await client.query("SELECT fn_fd_funding_verdict($1, 1.00)", [accountId]);

            await other.query("BEGIN");
            await assert.rejects(
                other.query("SELECT account_id FROM account WHERE account_id = $1 FOR UPDATE NOWAIT", [accountId]),
                (error) => error.code === "55P03",
                "the row must be locked by the eligibility check (lock_not_available)",
            );
            await other.query("ROLLBACK");
        } finally {
            await other.end();
            // Rolling back to the savepoint releases the row lock taken after it, so later tests
            // (and any other connection) can lock the same seeded account.
            await client.query("ROLLBACK TO SAVEPOINT lock_probe");
        }
    });

    test("12. Published signatures: the card function is STABLE, the verdict helper VOLATILE; both SECURITY INVOKER", async () => {
        const res = await client.query(
            `SELECT p.proname, p.provolatile, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args,
                    pg_get_function_result(p.oid) AS result, obj_description(p.oid, 'pg_proc') AS comment
             FROM pg_proc p WHERE p.proname IN ('fn_check_account_fd_eligible', 'fn_fd_funding_verdict')
             ORDER BY p.proname`,
        );
        assert.equal(res.rows.length, 2);
        const [check, verdictFn] = res.rows;
        assert.equal(check.proname, "fn_check_account_fd_eligible");
        assert.equal(check.args, "p_account_id uuid");
        assert.equal(check.result, "boolean");
        assert.equal(check.provolatile, "s");
        assert.equal(verdictFn.args, "p_account_id uuid, p_principal numeric");
        assert.equal(verdictFn.result, "text");
        assert.equal(verdictFn.provolatile, "v", "it locks a row, so it must be VOLATILE");
        for (const row of res.rows) {
            assert.equal(row.prosecdef, false);
            assert.match(row.comment, /I-6/);
        }
    });

    test("13. As mims_app under RLS: in scope gives the real answer, out of scope or no context ACCOUNT_NOT_FOUND", async () => {
        const accountId = await openAccount({ balance: "20000.00" });
        const scope = (branchId, role = "AGENT") =>
            client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', $3, true)`,
                [agent.agent_id, branchId, role],
            );
        const verdicts = () =>
            client.query(
                "SELECT fn_fd_funding_verdict($1, '1000.00') AS ok, fn_fd_funding_verdict($1, '999999.00') AS big",
                [accountId],
            );
        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await scope(agent.branch_id);
            const inScope = (await verdicts()).rows[0];
            assert.equal(inScope.ok, "OK");
            assert.equal(inScope.big, "INSUFFICIENT_BALANCE");
            assert.equal(await eligible(accountId), true);

            await scope(otherBranchId);
            assert.equal((await verdicts()).rows[0].ok, "ACCOUNT_NOT_FOUND");
            assert.equal(await eligible(accountId), false);

            await scope("", "");
            assert.equal((await verdicts()).rows[0].ok, "ACCOUNT_NOT_FOUND");
            assert.equal(await eligible(accountId), false);
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_app");
        }
    });

    test("14. mims_app holds EXECUTE on both functions", async () => {
        const res = await client.query(
            `SELECT has_function_privilege('mims_app', 'fn_check_account_fd_eligible(uuid)', 'EXECUTE') AS a,
                    has_function_privilege('mims_app', 'fn_fd_funding_verdict(uuid, numeric)', 'EXECUTE') AS b`,
        );
        assert.equal(res.rows[0].a, true);
        assert.equal(res.rows[0].b, true);
    });

    // An account whose single holder is a customer assigned to the seeded agent, so the fixed_deposit
    // SELECT policy (0420) lets that agent's RLS context see the account's FDs.
    async function assignedAccountWithActiveFd() {
        seq += 1;
        const customer = await client.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
             VALUES ($1, $2, $3, 'Test FD Holder', '1990-01-01', $4) RETURNING customer_id`,
            [agent.branch_id, `${TEST_PREFIX}C${seq}`, `${TEST_PREFIX}NIC-${seq}`, `${TEST_PREFIX}c${seq}@example.test`],
        );
        const accountId = await openAccount({ balance: "20000.00" });
        await client.query(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'PRIMARY')",
            [accountId, customer.rows[0].customer_id],
        );
        await client.query(
            "INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1, $2)",
            [customer.rows[0].customer_id, agent.agent_id],
        );
        await addFd(accountId, "ACTIVE");
        return accountId;
    }

    test("15. As mims_app, an assigned AGENT sees the account's active FD: ACTIVE_FD_EXISTS", async () => {
        const accountId = await assignedAccountWithActiveFd();
        await client.query("SAVEPOINT as_agent");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', 'AGENT', true)`,
                [agent.agent_id, agent.branch_id],
            );
            assert.equal(await verdict(accountId, "1000.00"), "ACTIVE_FD_EXISTS");
            assert.equal(await eligible(accountId), true, "the status-only function ignores FDs by design");
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_agent");
        }
    });

    test("16. Documented limit: where RLS hides fixed_deposit the pre-check says OK, and the unique index still stops a second ACTIVE FD", async () => {
        const accountId = await assignedAccountWithActiveFd();
        await client.query("SAVEPOINT as_admin");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            // The fixed_deposit SELECT policy does not include ADMIN, so an existing FD is invisible.
            await client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', '', true),
                        set_config('app.current_user_role', 'ADMIN', true)`,
                [agent.agent_id],
            );
            const seen = await client.query("SELECT count(*)::int AS n FROM fixed_deposit WHERE account_id = $1", [accountId]);
            assert.equal(seen.rows[0].n, 0, "ADMIN context cannot read the FD row");
            const result = await verdict(accountId, "1000.00");
            assert.ok(["OK", "ACCOUNT_NOT_FOUND"].includes(result), `pre-check cannot see the FD (got ${result})`);
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_admin");
        }
        // The authoritative guard: a second ACTIVE FD on the same account violates the partial unique index.
        await client.query("SAVEPOINT dup_fd");
        await assert.rejects(addFd(accountId, "ACTIVE"), (error) => error.code === "23505" && error.constraint === "uq_one_active_fd_per_account");
        await client.query("ROLLBACK TO SAVEPOINT dup_fd");
    });

    test("17. fn_fd_funding_verdict cannot run in a read-only transaction (25006); the status-only function can", async () => {
        const seeded = await client.query(
            "SELECT account_id FROM account WHERE account_number NOT LIKE $1 ORDER BY account_number LIMIT 1",
            [`${TEST_PREFIX}%`],
        );
        const accountId = seeded.rows[0].account_id;
        const readOnly = new pg.Client({ connectionString });
        await readOnly.connect();
        try {
            await readOnly.query("BEGIN READ ONLY");
            const status = await readOnly.query("SELECT fn_check_account_fd_eligible($1) AS ok", [accountId]);
            assert.equal(typeof status.rows[0].ok, "boolean");
            await assert.rejects(
                readOnly.query("SELECT fn_fd_funding_verdict($1, 1.00)", [accountId]),
                (error) => error.code === "25006",
            );
            await readOnly.query("ROLLBACK");
        } finally {
            await readOnly.end();
        }
    });

    test("18. The verdict waits for a competing lock on the account and answers once it is released", async () => {
        const seeded = await client.query(
            "SELECT account_id FROM account WHERE account_number NOT LIKE $1 ORDER BY account_number LIMIT 1",
            [`${TEST_PREFIX}%`],
        );
        const accountId = seeded.rows[0].account_id;
        const holder = new pg.Client({ connectionString });
        const caller = new pg.Client({ connectionString });
        await holder.connect();
        await caller.connect();
        try {
            await holder.query("BEGIN");
            await holder.query("SELECT account_id FROM account WHERE account_id = $1 FOR UPDATE", [accountId]);

            let settled = false;
            const pending = caller.query("SELECT fn_fd_funding_verdict($1, 1.00) AS v", [accountId]).then((res) => {
                settled = true;
                return res.rows[0].v;
            });
            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "the verdict must block while another transaction holds the account lock");

            await holder.query("ROLLBACK");
            const answer = await pending;
            assert.ok(typeof answer === "string" && answer.length > 0, "the verdict is returned after the lock is released");
        } finally {
            await caller.end();
            await holder.end();
        }
    });
});
