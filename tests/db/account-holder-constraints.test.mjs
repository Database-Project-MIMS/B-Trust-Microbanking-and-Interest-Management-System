import { describe, test, before, after, beforeEach } from "node:test";
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

const ACC_PREFIX = "TEST-ACC-T02-";
const CUS_PREFIX = "TEST-HLD-";

describe("P02-M03-T02: account_holder schema constraints", () => {
    let client;
    let planId;
    let agentId;
    let branchId;

    const cleanup = async () => {
        await client.query(
            `DELETE FROM account_holder WHERE account_id IN
               (SELECT account_id FROM account WHERE account_number LIKE $1)`,
            [`${ACC_PREFIX}%`],
        );
        await client.query("DELETE FROM account WHERE account_number LIKE $1", [`${ACC_PREFIX}%`]);
        await client.query("DELETE FROM customer WHERE customer_number LIKE $1", [`${CUS_PREFIX}%`]);
    };

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        const plan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'");
        const agent = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        assert.ok(plan.rows[0], "seeded 'Adult' savings plan is required");
        assert.ok(agent.rows[0], "a seeded active agent is required");
        planId = plan.rows[0].plan_id;
        agentId = agent.rows[0].agent_id;
        branchId = agent.rows[0].branch_id;
    });

    beforeEach(cleanup);

    after(async () => {
        await cleanup();
        await client.end();
    });

    const makeAccount = async (n = 1) =>
        (
            await client.query(
                `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
                 VALUES ($1, $2, $3, $4) RETURNING account_id`,
                [planId, branchId, agentId, `${ACC_PREFIX}${String(n).padStart(4, "0")}`],
            )
        ).rows[0].account_id;

    const makeCustomer = async (n = 1) =>
        (
            await client.query(
                `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
                 VALUES ($1, $2, $3, 'Test Holder', '1990-01-01', $4) RETURNING customer_id`,
                [branchId, `${CUS_PREFIX}${n}`, `${CUS_PREFIX}NIC-${n}`, `${CUS_PREFIX}${n}@example.test`],
            )
        ).rows[0].customer_id;

    const addHolder = (accountId, customerId, holderType) =>
        client.query(
            holderType === undefined
                ? `INSERT INTO account_holder (account_id, customer_id) VALUES ($1, $2)
                   RETURNING holder_type, joined_date, created_at`
                : `INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, '${holderType}')
                   RETURNING holder_type, joined_date, created_at`,
            [accountId, customerId],
        );

    const expectError = async (sql, params, code) => {
        await client.query("BEGIN");
        try {
            await client.query(sql, params);
        } catch (err) {
            assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}`);
            return err;
        } finally {
            await client.query("ROLLBACK");
        }
        assert.fail(`statement should have failed with ${code}`);
    };

    test("1. A holder defaults to PRIMARY with today's joined_date", async () => {
        const row = (await addHolder(await makeAccount(), await makeCustomer())).rows[0];
        assert.equal(row.holder_type, "PRIMARY");
        assert.ok(row.joined_date instanceof Date);
        assert.ok(row.created_at);
    });

    test("2. The same customer cannot hold one account twice (23505)", async () => {
        const acc = await makeAccount();
        const cus = await makeCustomer();
        await addHolder(acc, cus);
        const err = await expectError(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'JOINT')",
            [acc, cus],
            "23505",
        );
        assert.equal(err.constraint, "uq_account_holder_account_customer");
    });

    test("3. An unknown holder_type is rejected (23514)", async () => {
        const err = await expectError(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'OWNER')",
            [await makeAccount(), await makeCustomer()],
            "23514",
        );
        assert.equal(err.constraint, "ck_account_holder_type");
    });

    test("4. An account allows only one PRIMARY holder but many JOINT holders", async () => {
        // Holder counts are plan-driven (trg_validate_joint_mandate, 0242): several holders
        // need the Joint plan and must arrive in one statement.
        const jointPlan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Joint'");
        assert.ok(jointPlan.rows[0], "seeded 'Joint' savings plan is required");
        const acc = (
            await client.query(
                `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
                 VALUES ($1, $2, $3, $4) RETURNING account_id`,
                [jointPlan.rows[0].plan_id, branchId, agentId, `${ACC_PREFIX}J0001`],
            )
        ).rows[0].account_id;
        const [c1, c2, c3] = [await makeCustomer(1), await makeCustomer(2), await makeCustomer(3)];
        await client.query(
            `INSERT INTO account_holder (account_id, customer_id, holder_type)
             VALUES ($1, $2, 'PRIMARY'), ($1, $3, 'JOINT'), ($1, $4, 'JOINT')`,
            [acc, c1, c2, c3],
        );
        const c4 = await makeCustomer(4);
        const err = await expectError(
            "INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1, $2, 'PRIMARY')",
            [acc, c4],
            "23505",
        );
        assert.equal(err.constraint, "uq_account_holder_one_primary");
    });

    test("5. A non-existent account or customer is rejected (23503)", async () => {
        const missing = "00000000-0000-0000-0000-00000000dead";
        const acc = await makeAccount();
        const cus = await makeCustomer();
        const a = await expectError(
            "INSERT INTO account_holder (account_id, customer_id) VALUES ($1, $2)",
            [missing, cus],
            "23503",
        );
        assert.equal(a.constraint, "fk_account_holder_account");
        const c = await expectError(
            "INSERT INTO account_holder (account_id, customer_id) VALUES ($1, $2)",
            [acc, missing],
            "23503",
        );
        assert.equal(c.constraint, "fk_account_holder_customer");
    });

    test("6. A customer or account with holders cannot be deleted (RESTRICT)", async () => {
        const acc = await makeAccount();
        const cus = await makeCustomer();
        await addHolder(acc, cus);
        for (const sql of [
            "DELETE FROM customer WHERE customer_id = $1",
            "DELETE FROM account WHERE account_id = $1",
        ]) {
            await client.query("BEGIN");
            try {
                await client.query(sql, [sql.includes("customer") ? cus : acc]);
                assert.fail("delete should have been rejected");
            } catch (err) {
                assert.ok(["23001", "23503"].includes(err.code), `unexpected ${err.code}`);
            } finally {
                await client.query("ROLLBACK");
            }
        }
    });

    test("7. holder_type, NOT NULL columns and indexes exist as designed", async () => {
        const idx = await client.query(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'account_holder'",
        );
        const names = idx.rows.map((r) => r.indexname);
        assert.ok(names.includes("uq_account_holder_one_primary"));
        assert.ok(names.includes("ix_account_holder_customer"));
        const cols = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'account_holder' AND is_nullable = 'NO'`,
        );
        const notNull = cols.rows.map((r) => r.column_name);
        for (const c of ["account_id", "customer_id", "holder_type", "joined_date"]) {
            assert.ok(notNull.includes(c), `${c} should be NOT NULL`);
        }
    });
});
