import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* loaded by runner */ }
}
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
const CUS_PREFIX = "TEST-ADH-";
const ACC_PREFIX = "TEST-ADH-ACC-";

const CONSTRAINTS = {
    ACTOR_MISMATCH: "ck_add_holder_actor",
    ACCOUNT_NOT_FOUND: "ck_add_holder_account",
    ACCOUNT_NOT_ACTIVE: "ck_add_holder_account_active",
    HOLDER_NOT_FOUND: "ck_open_account_holder_exists",
    DOCUMENTS_NOT_VERIFIED: "ck_open_account_documents",
    INVALID_HOLDER_COUNT: "ck_account_holder_count",
    UNDERAGE_HOLDER: "ck_account_holder_adult",
};
const CALL = "CALL sp_add_account_holder($1::uuid, $2::uuid, $3::uuid, NULL, NULL)";

describe("P02-M03-T05: sp_add_account_holder", () => {
    let client;
    let jointPlan;
    let adultPlan;
    let agentId;
    let branchId;
    let seq = 0;

    const cleanup = async () => {
        const scope = "SELECT account_id FROM account WHERE account_number LIKE $1";
        await client.query(`DELETE FROM joint_mandate WHERE account_id IN (${scope})`, [`${ACC_PREFIX}%`]);
        await client.query(`DELETE FROM account_holder WHERE account_id IN (${scope})`, [`${ACC_PREFIX}%`]);
        await client.query("DELETE FROM account WHERE account_number LIKE $1", [`${ACC_PREFIX}%`]);
        await client.query("DELETE FROM customer_document WHERE customer_id IN (SELECT customer_id FROM customer WHERE customer_number LIKE $1)", [`${CUS_PREFIX}%`]);
        await client.query("DELETE FROM customer WHERE customer_number LIKE $1", [`${CUS_PREFIX}%`]);
    };

    before(async () => {
        client = new pg.Client({ connectionString: ownerUrl });
        await client.connect();
        jointPlan = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Joint'")).rows[0].plan_id;
        adultPlan = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0].plan_id;
        const agent = (await client.query("SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1")).rows[0];
        assert.ok(agent, "a seeded active agent is required");
        ({ agent_id: agentId, branch_id: branchId } = agent);
        await cleanup();
    });
    after(async () => { await client.query("ROLLBACK").catch(() => {}); await cleanup(); await client.end(); });

    const scenario = (fn) => async () => {
        await client.query("BEGIN");
        try { await fn(client); } finally { await client.query("ROLLBACK"); }
    };
    const makeCustomer = async (c, { dob = "DATE '1990-01-01'", verified = true, status = "ACTIVE" } = {}) => {
        const n = `${Date.now()}-${++seq}`;
        const id = (await c.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email, status)
             VALUES ($1, $2, $3, 'Test Add Holder', ${dob}, $4, $5) RETURNING customer_id`,
            [branchId, `${CUS_PREFIX}${n}`, `${CUS_PREFIX}NIC-${n}`, `${CUS_PREFIX}${n}@example.test`, status])).rows[0].customer_id;
        if (verified) await c.query(
            "INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date) VALUES ($1, 'NIC', '/synthetic/x.pdf', $2, now())",
            [id, agentId]);
        return id;
    };
    // Account and holders are written the way the opening routine does: all holders in one INSERT.
    const makeAccount = async (c, planId, holderIds, { status = "ACTIVE", mandate = null } = {}) => {
        const accountId = (await c.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING account_id`,
            [planId, branchId, agentId, `${ACC_PREFIX}${Date.now()}-${++seq}`, status])).rows[0].account_id;
        const params = [accountId];
        const rows = holderIds.map((id, i) => { params.push(id, i === 0 ? "PRIMARY" : "JOINT"); return `($1, $${params.length - 1}, $${params.length})`; });
        await c.query(`INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ${rows.join(", ")}`, params);
        if (mandate) await c.query("INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES ($1, $2, $3)",
            [accountId, mandate, mandate === "ANY_ONE" ? 1 : holderIds.length]);
        return accountId;
    };
    const fail = async (c, args, prefix, code = "P0001") => {
        await c.query("SAVEPOINT s");
        try {
            await assert.rejects(c.query(CALL, args), (err) => {
                assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
                if (prefix) {
                    assert.ok(err.message.startsWith(prefix), `expected ${prefix}, got ${err.message}`);
                    assert.equal(err.constraint, CONSTRAINTS[prefix]);
                }
                return true;
            });
        } finally { await c.query("ROLLBACK TO SAVEPOINT s"); }
    };

    test("1. Adds a JOINT holder, returns the new count, syncs ALL_HOLDERS and audits the insert", scenario(async (c) => {
        const holders = [await makeCustomer(c), await makeCustomer(c)];
        const accountId = await makeAccount(c, jointPlan, holders, { mandate: "ALL_HOLDERS" });
        const newcomer = await makeCustomer(c);
        const out = (await c.query(CALL, [accountId, newcomer, agentId])).rows[0];
        assert.equal(out.p_holder_count, 3);
        const row = (await c.query("SELECT holder_type FROM account_holder WHERE account_holder_id = $1", [out.p_account_holder_id])).rows[0];
        assert.equal(row.holder_type, "JOINT");
        const mandate = (await c.query("SELECT required_signatories FROM joint_mandate WHERE account_id = $1", [accountId])).rows[0];
        assert.equal(mandate.required_signatories, 3);
        const audit = await c.query("SELECT user_id FROM audit_log WHERE entity_type = 'account_holder' AND entity_id = $1", [out.p_account_holder_id]);
        assert.equal(audit.rowCount, 1); assert.equal(audit.rows[0].user_id, agentId);
    }));

    test("2. ANY_ONE stays at one signatory when a holder is added", scenario(async (c) => {
        const accountId = await makeAccount(c, jointPlan, [await makeCustomer(c), await makeCustomer(c)], { mandate: "ANY_ONE" });
        await c.query(CALL, [accountId, await makeCustomer(c), agentId]);
        assert.equal((await c.query("SELECT required_signatories FROM joint_mandate WHERE account_id = $1", [accountId])).rows[0].required_signatories, 1);
    }));

    test("3. Unknown account, frozen or closed account", scenario(async (c) => {
        const holders = [await makeCustomer(c), await makeCustomer(c)];
        const candidate = await makeCustomer(c);
        await fail(c, ["00000000-0000-0000-0000-00000000dead", candidate, agentId], "ACCOUNT_NOT_FOUND");
        for (const status of ["FROZEN", "CLOSED"]) {
            const accountId = await makeAccount(c, jointPlan, [await makeCustomer(c), await makeCustomer(c)], { status });
            await fail(c, [accountId, candidate, agentId], "ACCOUNT_NOT_ACTIVE");
        }
        assert.equal(holders.length, 2);
    }));

    test("4. Unknown, inactive, unverified, underage and duplicate holders are rejected", scenario(async (c) => {
        const holders = [await makeCustomer(c), await makeCustomer(c)];
        const accountId = await makeAccount(c, jointPlan, holders, { mandate: "ANY_ONE" });
        await fail(c, [accountId, "00000000-0000-0000-0000-00000000dead", agentId], "HOLDER_NOT_FOUND");
        await fail(c, [accountId, await makeCustomer(c, { status: "INACTIVE" }), agentId], "HOLDER_NOT_FOUND");
        await fail(c, [accountId, await makeCustomer(c, { verified: false }), agentId], "DOCUMENTS_NOT_VERIFIED");
        await fail(c, [accountId, await makeCustomer(c, { dob: "(CURRENT_DATE - INTERVAL '10 years')::date" }), agentId], "UNDERAGE_HOLDER");
        await fail(c, [accountId, holders[1], agentId], null, "23505");
    }));

    test("5. The plan's holder range is enforced (full joint account, individual account)", scenario(async (c) => {
        const four = await makeAccount(c, jointPlan, [await makeCustomer(c), await makeCustomer(c), await makeCustomer(c), await makeCustomer(c)], { mandate: "ANY_ONE" });
        await fail(c, [four, await makeCustomer(c), agentId], "INVALID_HOLDER_COUNT");
        const solo = await makeAccount(c, adultPlan, [await makeCustomer(c)]);
        await fail(c, [solo, await makeCustomer(c), agentId], "INVALID_HOLDER_COUNT");
    }));

    test("6. An acting user is required and must match the session user", scenario(async (c) => {
        const accountId = await makeAccount(c, jointPlan, [await makeCustomer(c), await makeCustomer(c)], { mandate: "ANY_ONE" });
        const candidate = await makeCustomer(c);
        await fail(c, [accountId, candidate, null], "ACTOR_MISMATCH");
        await c.query("SELECT set_config('app.current_user_id', $1, true)", ["00000000-0000-0000-0000-00000000dead"]);
        await fail(c, [accountId, candidate, agentId], "ACTOR_MISMATCH");
    }));

    test("7. Concurrent adds to a three-holder account are serialised: the fifth holder cannot slip in", async () => {
        await client.query("BEGIN");
        const holders = [await makeCustomer(client), await makeCustomer(client), await makeCustomer(client)];
        const [a1, a2] = [await makeCustomer(client), await makeCustomer(client)];
        const accountId = await makeAccount(client, jointPlan, holders, { mandate: "ANY_ONE" });
        await client.query("COMMIT");
        const a = new pg.Client({ connectionString: ownerUrl });
        const b = new pg.Client({ connectionString: ownerUrl });
        await a.connect(); await b.connect();
        try {
            await a.query("BEGIN"); await a.query(CALL, [accountId, a1, agentId]);
            await b.query("BEGIN");
            let settled = false;
            const attempt = b.query(CALL, [accountId, a2, agentId]).then(() => ({ ok: true }), (error) => ({ ok: false, error })).finally(() => { settled = true; });
            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "the second add must wait for the account lock");
            await a.query("COMMIT");
            const outcome = await attempt;
            assert.equal(outcome.ok, false);
            assert.ok(outcome.error.message.startsWith("INVALID_HOLDER_COUNT"), outcome.error.message);
            await b.query("ROLLBACK");
            assert.equal((await client.query("SELECT count(*)::int AS n FROM account_holder WHERE account_id = $1", [accountId])).rows[0].n, 4);
        } finally { await a.end(); await b.end(); await cleanup(); }
    });

    test("8. As mims_app (BRANCH_MANAGER scope) a holder is added; a failed add leaves nothing", async () => {
        await client.query("BEGIN");
        const holders = [await makeCustomer(client), await makeCustomer(client)];
        const good = await makeCustomer(client); const unverified = await makeCustomer(client, { verified: false });
        const accountId = await makeAccount(client, jointPlan, holders, { mandate: "ALL_HOLDERS" });
        await client.query("COMMIT");
        const app = new pg.Client({ connectionString: appUrl });
        await app.connect();
        const context = () => app.query(
            `SELECT set_config('app.current_user_id', $1, true), set_config('app.current_branch_id', $2, true),
                    set_config('app.current_user_role', 'BRANCH_MANAGER', true)`, [agentId, branchId]);
        try {
            await app.query("BEGIN"); await context();
            await assert.rejects(app.query(CALL, [accountId, unverified, agentId]), (err) => err.message.startsWith("DOCUMENTS_NOT_VERIFIED"));
            await app.query("ROLLBACK");
            const holdersNow = async () => (await client.query("SELECT count(*)::int AS n FROM account_holder WHERE account_id = $1", [accountId])).rows[0].n;
            assert.equal(await holdersNow(), 2);
            await app.query("BEGIN"); await context();
            assert.equal((await app.query(CALL, [accountId, good, agentId])).rows[0].p_holder_count, 3);
            await app.query("COMMIT");
            assert.equal(await holdersNow(), 3);
        } finally { await app.query("ROLLBACK").catch(() => {}); await app.end(); await cleanup(); }
    });
});
