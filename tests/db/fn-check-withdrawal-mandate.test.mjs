import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile();
    } catch {
        // ignore if loaded by runner
    }
}

const connectionString =
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

const ACC_PREFIX = "TEST-MND-P03T02-";
const CUS_PREFIX = "TEST-MNW-";

// Every row lives in ONE transaction rolled back in after(): nothing is committed and, because
// audit_log is append-only, no audit rows are left behind.
describe("P03-M03-T02: fn_check_withdrawal_mandate (I-4)", () => {
    let client;
    let planIds;
    let agent;
    let otherBranchId;
    let accountSeq = 0;
    let customerSeq = 0;

    async function check(accountId, signers) {
        const res = await client.query(
            "SELECT fn_check_withdrawal_mandate($1, $2::uuid[]) AS ok",
            [accountId, signers],
        );
        return res.rows[0].ok;
    }

    async function makeCustomer(dob = "1990-01-01") {
        const n = ++customerSeq;
        const res = await client.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
             VALUES ($1, $2, $3, 'Test Mandate Signer', $4, $5) RETURNING customer_id`,
            [agent.branch_id, `${CUS_PREFIX}${n}`, `${CUS_PREFIX}NIC-${n}`, dob, `${CUS_PREFIX}${n}@example.test`],
        );
        return res.rows[0].customer_id;
    }

    // One multi-row INSERT so the holder trigger sees the whole set (0242 contract).
    async function makeAccount(planName, holderCount, mandate) {
        const res = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [planIds[planName], agent.branch_id, agent.agent_id, `${ACC_PREFIX}${String(++accountSeq).padStart(4, "0")}`],
        );
        const accountId = res.rows[0].account_id;
        const holders = [];
        for (let i = 0; i < holderCount; i++) holders.push(await makeCustomer());
        const params = [accountId];
        const rows = holders.map((id, i) => {
            params.push(id, i === 0 ? "PRIMARY" : "JOINT");
            return `($1, $${params.length - 1}, $${params.length})`;
        });
        await client.query(
            `INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ${rows.join(", ")}`,
            params,
        );
        if (mandate) {
            await client.query(
                `INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES ($1, $2, $3)`,
                [accountId, mandate, mandate === "ANY_ONE" ? 1 : holderCount],
            );
        }
        return { accountId, holders };
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        await client.query("BEGIN");

        const plans = await client.query("SELECT plan_id, plan_name FROM savings_plan");
        planIds = Object.fromEntries(plans.rows.map((r) => [r.plan_name, r.plan_id]));
        for (const name of ["Adult", "Joint"]) assert.ok(planIds[name], `seeded plan ${name} is required`);
        const found = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        agent = found.rows[0];
        assert.ok(agent, "a seeded active agent is required");
        const other = await client.query("SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1", [agent.branch_id]);
        otherBranchId = other.rows[0].branch_id;
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("1. ANY_ONE: either holder alone satisfies it; both together also do", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        assert.equal(await check(accountId, [holders[0]]), true);
        assert.equal(await check(accountId, [holders[1]]), true);
        assert.equal(await check(accountId, holders), true);
    });

    test("2. ANY_ONE: a non-holder is rejected, alone or alongside a real holder", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        const stranger = await makeCustomer();
        assert.equal(await check(accountId, [stranger]), false);
        assert.equal(await check(accountId, [holders[0], stranger]), false, "a non-holder voids the set");
    });

    test("3. ALL_HOLDERS: every holder must sign; a subset is rejected", async () => {
        const { accountId, holders } = await makeAccount("Joint", 3, "ALL_HOLDERS");
        assert.equal(await check(accountId, holders), true);
        assert.equal(await check(accountId, [holders[2], holders[0], holders[1]]), true, "order is irrelevant");
        assert.equal(await check(accountId, [holders[0], holders[1]]), false);
        assert.equal(await check(accountId, [holders[0]]), false);
    });

    test("4. ALL_HOLDERS: duplicates count once and a stranger cannot make up the numbers", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ALL_HOLDERS");
        assert.equal(await check(accountId, [holders[0], holders[0]]), false, "one holder repeated is still one signer");
        const stranger = await makeCustomer();
        assert.equal(await check(accountId, [holders[0], stranger]), false);
        assert.equal(await check(accountId, [holders[0], holders[1], holders[1]]), true);
    });

    test("5. ALL_HOLDERS follows holder changes: a holder added later must sign too", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ALL_HOLDERS");
        assert.equal(await check(accountId, holders), true);
        const third = await makeCustomer();
        await client.query(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'JOINT')",
            [accountId, third],
        );
        assert.equal(await check(accountId, holders), false, "the original two no longer suffice");
        assert.equal(await check(accountId, [...holders, third]), true);
    });

    test("6. Individual account (no mandate): the holder passes, a stranger fails", async () => {
        const { accountId, holders } = await makeAccount("Adult", 1, null);
        assert.equal(await check(accountId, [holders[0]]), true);
        const stranger = await makeCustomer();
        assert.equal(await check(accountId, [stranger]), false);
        assert.equal(await check(accountId, [holders[0], stranger]), false);
    });

    test("7. Malformed input fails closed: NULL/empty array, NULL element, NULL or unknown account", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        assert.equal(await check(accountId, null), false);
        assert.equal(await check(accountId, []), false);
        const withNull = await client.query(
            "SELECT fn_check_withdrawal_mandate($1, ARRAY[$2::uuid, NULL]::uuid[]) AS ok",
            [accountId, holders[0]],
        );
        assert.equal(withNull.rows[0].ok, false);
        assert.equal(await check(null, [holders[0]]), false);
        assert.equal(await check("00000000-0000-4000-8000-000000000000", [holders[0]]), false);
    });

    test("8. A joint account with no mandate row fails closed, even for a real holder", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, null);
        assert.equal(await check(accountId, holders), false);
        assert.equal(await check(accountId, [holders[0]]), false);
    });

    test("9. A mandate outside its effective dates is not honoured", async () => {
        const future = await makeAccount("Joint", 2, "ANY_ONE");
        await client.query(
            "UPDATE joint_mandate SET effective_from = (now() AT TIME ZONE 'Asia/Colombo')::date + 1 WHERE account_id = $1",
            [future.accountId],
        );
        assert.equal(await check(future.accountId, [future.holders[0]]), false);

        const expired = await makeAccount("Joint", 2, "ANY_ONE");
        await client.query(
            "UPDATE joint_mandate SET effective_from = (now() AT TIME ZONE 'Asia/Colombo')::date - 10, effective_to = (now() AT TIME ZONE 'Asia/Colombo')::date - 1 WHERE account_id = $1",
            [expired.accountId],
        );
        assert.equal(await check(expired.accountId, [expired.holders[0]]), false);

        await client.query("UPDATE joint_mandate SET effective_to = (now() AT TIME ZONE 'Asia/Colombo')::date WHERE account_id = $1", [expired.accountId]);
        assert.equal(await check(expired.accountId, [expired.holders[0]]), true, "the last effective day still counts");
    });

    test("10. The verdict reads the stored mandate type: switching ANY_ONE to ALL_HOLDERS tightens it", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        assert.equal(await check(accountId, [holders[0]]), true);
        await client.query(
            "UPDATE joint_mandate SET mandate_type = 'ALL_HOLDERS', required_signatories = 2 WHERE account_id = $1",
            [accountId],
        );
        assert.equal(await check(accountId, [holders[0]]), false);
        assert.equal(await check(accountId, holders), true);
    });

    test("11. Account status and balance are deliberately not this function's concern", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [accountId]);
        assert.equal(await check(accountId, [holders[0]]), true, "ACCOUNT_NOT_ACTIVE belongs to sp_post_withdrawal");
    });

    test("8b. A mandate that is deleted after opening leaves a joint account unable to withdraw", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        assert.equal(await check(accountId, [holders[0]]), true);
        await client.query("DELETE FROM joint_mandate WHERE account_id = $1", [accountId]);
        assert.equal(await check(accountId, holders), false);
    });

    test("8c. Editing the plan's holder range does not lock an existing individual account", async () => {
        const plan = await client.query(
            `INSERT INTO savings_plan (plan_name, interest_rate, min_balance, min_holders, max_holders)
             VALUES ('TEST-Mandate Plan P03T02', 0.05, 0, 1, 1) RETURNING plan_id`,
        );
        const accountRes = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [plan.rows[0].plan_id, agent.branch_id, agent.agent_id, `${ACC_PREFIX}PLAN`],
        );
        const holder = await makeCustomer();
        await client.query(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'PRIMARY')",
            [accountRes.rows[0].account_id, holder],
        );
        assert.equal(await check(accountRes.rows[0].account_id, [holder]), true);
        await client.query("UPDATE savings_plan SET max_holders = 3 WHERE plan_id = $1", [plan.rows[0].plan_id]);
        assert.equal(await check(accountRes.rows[0].account_id, [holder]), true, "the account still has one holder and no mandate");
    });

    test("8d. fn_withdrawal_mandate_verdict gives the reason behind each false", async () => {
        const verdict = async (accountId, signers) =>
            (await client.query("SELECT fn_withdrawal_mandate_verdict($1, $2::uuid[]) AS v", [accountId, signers])).rows[0].v;
        const any = await makeAccount("Joint", 2, "ANY_ONE");
        const all = await makeAccount("Joint", 2, "ALL_HOLDERS");
        const none = await makeAccount("Joint", 2, null);
        const stranger = await makeCustomer();
        assert.equal(await verdict(any.accountId, [any.holders[0]]), "OK");
        assert.equal(await verdict(any.accountId, []), "NO_SIGNERS");
        assert.equal(await verdict(any.accountId, [stranger]), "SIGNER_NOT_HOLDER");
        assert.equal(await verdict(all.accountId, [all.holders[0]]), "MANDATE_NOT_SATISFIED");
        assert.equal(await verdict(none.accountId, none.holders), "MANDATE_MISSING");
        await client.query(
            "UPDATE joint_mandate SET effective_from = (now() AT TIME ZONE 'Asia/Colombo')::date + 1 WHERE account_id = $1",
            [any.accountId],
        );
        assert.equal(await verdict(any.accountId, [any.holders[0]]), "MANDATE_NOT_EFFECTIVE");
        assert.equal(await verdict("00000000-0000-4000-8000-000000000000", [stranger]), "ACCOUNT_NOT_FOUND");
    });

    test("12. Published signature: STABLE, SECURITY INVOKER, (uuid, uuid[]) → boolean, I-4 comment", async () => {
        const res = await client.query(
            `SELECT p.provolatile, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args,
                    pg_get_function_result(p.oid) AS result, obj_description(p.oid, 'pg_proc') AS comment
             FROM pg_proc p WHERE p.proname = 'fn_check_withdrawal_mandate'`,
        );
        assert.equal(res.rows.length, 1);
        assert.equal(res.rows[0].provolatile, "s");
        assert.equal(res.rows[0].prosecdef, false);
        assert.equal(res.rows[0].args, "p_account_id uuid, p_signer_customer_ids uuid[]");
        assert.equal(res.rows[0].result, "boolean");
        assert.match(res.rows[0].comment, /I-4/);
        const grant = await client.query(
            "SELECT has_function_privilege('mims_app', 'fn_check_withdrawal_mandate(uuid, uuid[])', 'EXECUTE') AS ok",
        );
        assert.equal(grant.rows[0].ok, true);
        const helper = await client.query(
            "SELECT has_function_privilege('mims_app', 'fn_withdrawal_mandate_verdict(uuid, uuid[])', 'EXECUTE') AS ok",
        );
        assert.equal(helper.rows[0].ok, true);
    });

    test("13. As mims_app under RLS: in-scope account answers truthfully, other-branch or no context gives false", async () => {
        const { accountId, holders } = await makeAccount("Joint", 2, "ANY_ONE");
        const scope = (branchId, role = "AGENT") =>
            client.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', $3, true)`,
                [agent.agent_id, branchId, role],
            );
        const verdict = async () =>
            (await client.query("SELECT fn_check_withdrawal_mandate($1, $2::uuid[]) AS ok", [accountId, [holders[0]]])).rows[0].ok;

        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await scope(agent.branch_id);
            assert.equal(await verdict(), true);
            await scope(otherBranchId);
            assert.equal(await verdict(), false, "an account hidden by RLS fails closed");
            await scope("", "");
            assert.equal(await verdict(), false, "no RLS context fails closed");
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_app");
        }
    });
});
