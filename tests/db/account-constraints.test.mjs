import { describe, test, before, after, beforeEach } from "node:test";
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

// Account numbers used by this suite; cleaned up before and after every run.
const TEST_PREFIX = "TEST-ACC-T01-";

describe("P02-M03-T01: account schema constraints", () => {
    let client;
    let planId;
    let branchId;
    let otherBranchId;
    let agentId;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        // Reuse the seeded master data (savings plans, branches, agents).
        const plan = await client.query(
            "SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'",
        );
        const branches = await client.query(
            "SELECT branch_id FROM branch ORDER BY branch_code LIMIT 2",
        );
        const agent = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        assert.ok(plan.rows[0], "seeded 'Adult' savings plan is required");
        assert.equal(branches.rows.length, 2, "two seeded branches are required");
        assert.ok(agent.rows[0], "a seeded active agent is required");

        planId = plan.rows[0].plan_id;
        agentId = agent.rows[0].agent_id;
        branchId = agent.rows[0].branch_id;
        otherBranchId = branches.rows.find((b) => b.branch_id !== branchId).branch_id;
    });

    beforeEach(async () => {
        await client.query("DELETE FROM account WHERE account_number LIKE $1", [
            `${TEST_PREFIX}%`,
        ]);
    });

    after(async () => {
        await client.query("DELETE FROM account WHERE account_number LIKE $1", [
            `${TEST_PREFIX}%`,
        ]);
        await client.end();
    });

    const insertAccount = (overrides = {}) => {
        const v = {
            plan_id: planId,
            branch_id: branchId,
            opened_by_agent_id: agentId,
            account_number: `${TEST_PREFIX}0001`,
            ...overrides,
        };
        return client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4)
             RETURNING account_id, status, current_balance, opened_date, created_at, updated_at`,
            [v.plan_id, v.branch_id, v.opened_by_agent_id, v.account_number],
        );
    };

    // Runs a statement that must fail and returns the PostgreSQL error.
    const expectError = async (sql, params, code) => {
        await client.query("BEGIN");
        try {
            await client.query(sql, params);
        } catch (err) {
            const allowed = Array.isArray(code) ? code : [code];
            assert.ok(allowed.includes(err.code), `expected SQLSTATE ${allowed.join('/')}, got ${err.code}`);
            return err;
        } finally {
            await client.query("ROLLBACK");
        }
        assert.fail(`statement should have failed with ${code}`);
    };

    test("1. A new account defaults to ACTIVE, balance 0, today's opened_date", async () => {
        const res = await insertAccount();
        const row = res.rows[0];
        assert.equal(row.status, "ACTIVE");
        assert.equal(row.current_balance, "0.00");
        assert.ok(row.opened_date instanceof Date);
        assert.ok(row.created_at && row.updated_at);
    });

    test("2. A negative current_balance is rejected by the CHECK (G-18)", async () => {
        const id = (await insertAccount()).rows[0].account_id;
        const err = await expectError(
            "UPDATE account SET current_balance = -0.01 WHERE account_id = $1",
            [id],
            "23514",
        );
        assert.equal(err.constraint, "ck_account_balance_non_negative");
        const ins = await expectError(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, current_balance)
             VALUES ($1, $2, $3, $4, -1)`,
            [planId, branchId, agentId, `${TEST_PREFIX}0002`],
            "23514",
        );
        assert.equal(ins.constraint, "ck_account_balance_non_negative");
    });

    test("3. A duplicate account_number is rejected (23505)", async () => {
        await insertAccount();
        const err = await expectError(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4)`,
            [planId, branchId, agentId, `${TEST_PREFIX}0001`],
            "23505",
        );
        assert.equal(err.constraint, "uq_account_account_number");
    });

    test("4. A non-existent plan, branch or agent is rejected (23503)", async () => {
        const missing = "00000000-0000-0000-0000-00000000dead";
        for (const [override, constraint] of [
            [{ plan_id: missing }, "fk_account_plan"],
            [{ branch_id: missing }, "fk_account_branch"],
            [{ opened_by_agent_id: missing }, "fk_account_opened_by_agent"],
        ]) {
            let failure;
            try {
                await insertAccount(override);
            } catch (err) {
                failure = err;
            }
            assert.ok(failure, `insert with ${JSON.stringify(override)} should fail`);
            assert.equal(failure.code, "23503");
            assert.equal(failure.constraint, constraint);
        }
    });

    test("5. An invalid status is rejected (23514)", async () => {
        const id = (await insertAccount()).rows[0].account_id;
        const err = await expectError(
            "UPDATE account SET status = 'DORMANT' WHERE account_id = $1",
            [id],
            "23514",
        );
        assert.equal(err.constraint, "ck_account_status");
    });

    test("6. FROZEN and CLOSED are valid statuses", async () => {
        const id = (await insertAccount()).rows[0].account_id;
        for (const status of ["FROZEN", "CLOSED", "ACTIVE"]) {
            const res = await client.query(
                "UPDATE account SET status = $1 WHERE account_id = $2 RETURNING status",
                [status, id],
            );
            assert.equal(res.rows[0].status, status);
        }
    });

    test("7. branch_id cannot be changed after opening (ADR-0008)", async () => {
        const id = (await insertAccount()).rows[0].account_id;
        const err = await expectError(
            "UPDATE account SET branch_id = $1 WHERE account_id = $2",
            [otherBranchId, id],
            "23514",
        );
        assert.equal(err.constraint, "ck_account_branch_immutable");

        const row = await client.query(
            "SELECT branch_id FROM account WHERE account_id = $1",
            [id],
        );
        assert.equal(row.rows[0].branch_id, branchId);
    });

    test("8. Other updates leave branch_id alone and refresh updated_at", async () => {
        const created = (await insertAccount()).rows[0];
        await new Promise((r) => setTimeout(r, 20));
        const res = await client.query(
            "UPDATE account SET status = 'FROZEN' WHERE account_id = $1 RETURNING branch_id, updated_at",
            [created.account_id],
        );
        assert.equal(res.rows[0].branch_id, branchId);
        assert.ok(res.rows[0].updated_at > created.updated_at);
    });

    test("9. A referenced plan, branch or agent cannot be deleted (RESTRICT)", async () => {
        await insertAccount();
        for (const [table, col, id] of [
            ["savings_plan", "plan_id", planId],
            ["branch", "branch_id", branchId],
            ["agent", "agent_id", agentId],
        ]) {
            await expectError(`DELETE FROM ${table} WHERE ${col} = $1`, [id], ["23503", "23001"]);
        }
    });

    test("10. The expected indexes exist", async () => {
        const res = await client.query(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'account'",
        );
        const names = res.rows.map((r) => r.indexname);
        for (const expected of [
            "ix_account_plan",
            "ix_account_branch_status",
            "ix_account_status",
            "uq_account_account_number",
        ]) {
            assert.ok(names.includes(expected), `missing index ${expected}`);
        }
    });
});
