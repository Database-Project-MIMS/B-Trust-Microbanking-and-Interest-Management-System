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

const TEST_PREFIX = "TEST-MIN-P03T01-";
const TEST_PLAN = "TEST-Min Plan P03T01";

// Every row this suite creates lives in ONE transaction that is rolled back in after().
// Nothing is committed, so no account rows and, because audit_log is append-only, no
// audit rows are left behind. The mims_app test uses SET LOCAL ROLE in the same transaction.
describe("P03-M03-T01: fn_check_plan_minimum (I-4)", () => {
    let client;
    let planIds;
    let agent;
    let otherBranchId;
    const accounts = {}; // plan name -> account_id

    async function check(accountId, resulting) {
        const res = await client.query(
            "SELECT fn_check_plan_minimum($1, $2) AS ok",
            [accountId, resulting],
        );
        return res.rows[0].ok;
    }

    async function openAccount(planId, suffix) {
        const res = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [planId, agent.branch_id, agent.agent_id, `${TEST_PREFIX}${suffix}`],
        );
        return res.rows[0].account_id;
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        await client.query("BEGIN");

        const plans = await client.query("SELECT plan_id, plan_name FROM savings_plan");
        planIds = Object.fromEntries(plans.rows.map((r) => [r.plan_name, r.plan_id]));
        const found = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        agent = found.rows[0];
        assert.ok(agent, "a seeded active agent is required");
        const other = await client.query(
            "SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1",
            [agent.branch_id],
        );
        otherBranchId = other.rows[0].branch_id;

        for (const name of ["Children", "Teen", "Adult", "Senior", "Joint"]) {
            assert.ok(planIds[name], `seeded plan ${name} is required`);
            accounts[name] = await openAccount(planIds[name], name);
        }
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("1. Adult (min 1,000): exactly the minimum passes, one cent below fails", async () => {
        assert.equal(await check(accounts.Adult, "1000.00"), true);
        assert.equal(await check(accounts.Adult, "999.99"), false);
        assert.equal(await check(accounts.Adult, "1000.01"), true);
    });

    test("2. Children (min 0): zero passes; a negative input gives a deterministic false", async () => {
        assert.equal(await check(accounts.Children, "0.00"), true);
        assert.equal(await check(accounts.Children, "100000.00"), true);
        assert.equal(await check(accounts.Children, "-0.01"), false);
    });

    test("3. Teen (min 500), Senior (min 1,000) and Joint (min 5,000) boundaries", async () => {
        assert.equal(await check(accounts.Teen, "500.00"), true);
        assert.equal(await check(accounts.Teen, "499.99"), false);
        assert.equal(await check(accounts.Senior, "1000.00"), true);
        assert.equal(await check(accounts.Senior, "999.99"), false);
        assert.equal(await check(accounts.Joint, "5000.00"), true);
        assert.equal(await check(accounts.Joint, "4999.99"), false);
    });

    test("4. A non-existent account returns false, never an error", async () => {
        const res = await client.query(
            "SELECT fn_check_plan_minimum(gen_random_uuid(), 100000.00) AS ok",
        );
        assert.equal(res.rows[0].ok, false);
    });

    test("5. NULL account or NULL resulting balance returns false", async () => {
        assert.equal(await check(null, "1000.00"), false);
        assert.equal(await check(accounts.Adult, null), false);
    });

    test("6. The rule is data-driven: changing savings_plan.min_balance changes the answer", async () => {
        const plan = await client.query(
            `INSERT INTO savings_plan (plan_name, interest_rate, min_balance)
             VALUES ($1, 0.05, 250.00) RETURNING plan_id`,
            [TEST_PLAN],
        );
        const accountId = await openAccount(plan.rows[0].plan_id, "DYN");
        assert.equal(await check(accountId, "250.00"), true);
        assert.equal(await check(accountId, "249.99"), false);

        await client.query("UPDATE savings_plan SET min_balance = 300.00 WHERE plan_id = $1", [plan.rows[0].plan_id]);
        assert.equal(await check(accountId, "250.00"), false, "raised minimum applies without redeploying");
        assert.equal(await check(accountId, "300.00"), true);

        await client.query("UPDATE savings_plan SET min_balance = 0 WHERE plan_id = $1", [plan.rows[0].plan_id]);
        assert.equal(await check(accountId, "0.00"), true);
    });

    test("7. The verdict depends on the argument only, not on the stored current_balance", async () => {
        // Stored balance 5,000 does not rescue a resulting balance of 500; stored 0 does not block 5,000.
        const accountId = await openAccount(planIds["Adult"], "BAL");
        await client.query("UPDATE account SET current_balance = 5000.00 WHERE account_id = $1", [accountId]);
        assert.equal(await check(accountId, "500.00"), false);
        assert.equal(await check(accounts.Adult, "5000.00"), true);
        const row = await client.query("SELECT current_balance FROM account WHERE account_id = $1", [accounts.Adult]);
        assert.equal(row.rows[0].current_balance, "0.00");
    });

    test("8. The function is STABLE, SECURITY INVOKER and has the published signature", async () => {
        const res = await client.query(
            `SELECT p.provolatile, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args,
                    pg_get_function_result(p.oid) AS result, obj_description(p.oid, 'pg_proc') AS comment
             FROM pg_proc p WHERE p.proname = 'fn_check_plan_minimum'`,
        );
        assert.equal(res.rows.length, 1);
        assert.equal(res.rows[0].provolatile, "s");
        assert.equal(res.rows[0].prosecdef, false);
        assert.equal(res.rows[0].args, "p_account_id uuid, p_resulting_balance numeric");
        assert.equal(res.rows[0].result, "boolean");
        assert.match(res.rows[0].comment, /I-4/);
    });

    test("9. As mims_app under RLS: an in-scope account gives the real answer, an out-of-scope one false", async () => {
        const scope = (branchId, role = "AGENT") =>
            client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', $3, true)`,
                [agent.agent_id, branchId, role],
            );
        const verdicts = (accountId) =>
            client.query(
                "SELECT fn_check_plan_minimum($1, '1000.00') AS ok, fn_check_plan_minimum($1, '999.99') AS low, fn_check_plan_minimum($1, '1000000.00') AS big",
                [accountId],
            );
        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await scope(agent.branch_id);
            const inScope = (await verdicts(accounts.Adult)).rows[0];
            assert.equal(inScope.ok, true);
            assert.equal(inScope.low, false);

            // Another branch's agent cannot see the row, so the check fails closed even for a huge balance.
            await scope(otherBranchId);
            assert.equal((await verdicts(accounts.Adult)).rows[0].big, false);

            // No RLS context at all behaves the same way: false, never an error.
            await client.query("SELECT set_config('app.current_user_id', NULL, true), set_config('app.current_branch_id', NULL, true), set_config('app.current_user_role', NULL, true)");
            assert.equal((await verdicts(accounts.Adult)).rows[0].big, false);
        } finally {
            await client.query("ROLLBACK TO SAVEPOINT as_app");
            await client.query("RESET ROLE");
        }
    });

    test("10. mims_app holds EXECUTE on the function", async () => {
        const res = await client.query(
            "SELECT has_function_privilege('mims_app', 'fn_check_plan_minimum(uuid, numeric)', 'EXECUTE') AS ok",
        );
        assert.equal(res.rows[0].ok, true);
    });

    test("11. Deliberately plan-only: an INACTIVE plan or a FROZEN/CLOSED account still gets the plan minimum", async () => {
        // Existing accounts keep their plan's minimum when the plan is retired; account status is
        // sp_post_withdrawal's rule (ACCOUNT_NOT_ACTIVE), not this function's.
        const plan = await client.query(
            `INSERT INTO savings_plan (plan_name, interest_rate, min_balance, status)
             VALUES ($1, 0.05, 400.00, 'INACTIVE') RETURNING plan_id`,
            [`${TEST_PLAN} inactive`],
        );
        const retired = await openAccount(plan.rows[0].plan_id, "INACTIVE");
        assert.equal(await check(retired, "400.00"), true);
        assert.equal(await check(retired, "399.99"), false);

        const frozen = await openAccount(planIds["Adult"], "FROZEN");
        await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [frozen]);
        assert.equal(await check(frozen, "1000.00"), true);
        assert.equal(await check(frozen, "999.99"), false);

        const closed = await openAccount(planIds["Adult"], "CLOSED");
        await client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [closed]);
        assert.equal(await check(closed, "1000.00"), true);
        assert.equal(await check(closed, "999.99"), false);
    });
});
