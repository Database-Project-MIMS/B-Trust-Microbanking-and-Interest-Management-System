import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* loaded by runner */ }
}
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

const HASH = "a".repeat(64);

describe("P02-M03-T05: account_opening_request constraints", () => {
    let client;
    let planId;
    let agentId;
    let branchId;

    before(async () => {
        client = new pg.Client({ connectionString: ownerUrl });
        await client.connect();
        planId = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0].plan_id;
        const agent = (await client.query("SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1")).rows[0];
        assert.ok(agent, "a seeded active agent is required");
        ({ agent_id: agentId, branch_id: branchId } = agent);
    });
    after(async () => { await client.query("ROLLBACK").catch(() => {}); await client.end(); });

    // Each scenario is rolled back, so nothing persists.
    const scenario = (fn) => async () => {
        await client.query("BEGIN");
        try { await fn(); } finally { await client.query("ROLLBACK"); }
    };
    let seq = 0;
    const makeAccount = async () =>
        (await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [planId, branchId, agentId, `TEST-AOR-${Date.now()}-${++seq}`])).rows[0].account_id;
    const insert = (accountId, key = "valid-key-001", hash = HASH, user = agentId) =>
        client.query(
            "INSERT INTO account_opening_request (user_id, idempotency_key, request_hash, account_id) VALUES ($1, $2, $3, $4) RETURNING request_id, created_at",
            [user, key, hash, accountId]);
    const expectError = async (operation, code, constraint) => {
        await client.query("SAVEPOINT s");
        try {
            await assert.rejects(operation(), (err) => {
                assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
                if (constraint) assert.equal(err.constraint, constraint);
                return true;
            });
        } finally { await client.query("ROLLBACK TO SAVEPOINT s"); }
    };

    test("1. A valid request row is stored", scenario(async () => {
        const row = (await insert(await makeAccount())).rows[0];
        assert.ok(row.request_id && row.created_at);
    }));

    test("2. The key format is checked (8 to 80 URL-safe characters)", scenario(async () => {
        const accountId = await makeAccount();
        for (const key of ["short", "has space here", "bad/char/key"]) {
            await expectError(() => insert(accountId, key), "23514", "ck_account_opening_request_key_format");
        }
        // Past 80 characters the column itself refuses the value (22001).
        await expectError(() => insert(accountId, "x".repeat(81)), "22001");
    }));

    test("3. The request hash must be 64 hex characters", scenario(async () => {
        const accountId = await makeAccount();
        for (const hash of ["abc", "G".repeat(64)]) {
            await expectError(() => insert(accountId, "valid-key-002", hash), "23514");
        }
    }));

    test("4. A user cannot reuse a key (23505)", scenario(async () => {
        await insert(await makeAccount(), "reused-key-01");
        await expectError(async () => insert(await makeAccount(), "reused-key-01"), "23505", "uq_account_opening_request_user_key");
    }));

    test("5. An account has at most one opening request (23505)", scenario(async () => {
        const accountId = await makeAccount();
        await insert(accountId, "first-key-001");
        await expectError(() => insert(accountId, "second-key-02"), "23505", "uq_account_opening_request_account");
    }));

    test("6. Unknown user or account is rejected (23503) and the account cannot be deleted", scenario(async () => {
        const missing = "00000000-0000-0000-0000-00000000dead";
        const accountId = await makeAccount();
        await expectError(() => insert(accountId, "key-bad-user", HASH, missing), "23503", "fk_account_opening_request_user");
        await expectError(() => insert(missing, "key-bad-acct"), "23503", "fk_account_opening_request_account");
        await insert(accountId, "key-restrict");
        await client.query("SAVEPOINT d");
        try {
            await assert.rejects(client.query("DELETE FROM account WHERE account_id = $1", [accountId]),
                (err) => ["23001", "23503"].includes(err.code));
        } finally { await client.query("ROLLBACK TO SAVEPOINT d"); }
    }));

    test("7. The application role can read and insert but never update or delete", async () => {
        const res = await client.query(
            `SELECT has_table_privilege('mims_app', 'account_opening_request', 'SELECT') AS sel,
                    has_table_privilege('mims_app', 'account_opening_request', 'INSERT') AS ins,
                    has_table_privilege('mims_app', 'account_opening_request', 'UPDATE') AS upd,
                    has_table_privilege('mims_app', 'account_opening_request', 'DELETE') AS del`);
        assert.deepEqual(res.rows[0], { sel: true, ins: true, upd: false, del: false });
    });
});
