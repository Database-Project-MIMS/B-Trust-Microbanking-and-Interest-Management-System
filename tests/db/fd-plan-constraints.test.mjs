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

describe("Phase 1 Task 1: fd_plan Schema Constraints", () => {
    let client;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
    });

    after(async () => {
        await client.end();
    });

    // 1. Exactly 3 FD plans exist after migration with the correct rates and tenures
    test("1. Exactly 3 FD plans exist after migration with the correct rates and tenures", async () => {
        const res = await client.query(`SELECT plan_name, tenure_months, interest_rate FROM fd_plan ORDER BY tenure_months`);
        assert.equal(res.rows.length, 3, "Exactly 3 products should exist");
        
        assert.equal(res.rows[0].plan_name, "6 Month FD");
        assert.equal(res.rows[0].tenure_months, 6);
        assert.equal(Number(res.rows[0].interest_rate), 0.1300);

        assert.equal(res.rows[1].plan_name, "1 Year FD");
        assert.equal(res.rows[1].tenure_months, 12);
        assert.equal(Number(res.rows[1].interest_rate), 0.1400);

        assert.equal(res.rows[2].plan_name, "3 Year FD");
        assert.equal(res.rows[2].tenure_months, 36);
        assert.equal(Number(res.rows[2].interest_rate), 0.1500);
    });

    // 2. Duplicate `plan_name` is rejected (error code `23505`)
    test("2. Duplicate plan_name is rejected with code 23505", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('6 Month FD', 24, 0.15)`
            ),
            (err) => {
                assert.equal(err.code, "23505", "Expected unique_violation (23505)");
                return true;
            }
        );
    });

    // 3. `tenure_months = 0` or negative is rejected by CHECK constraint
    test("3. tenure_months = 0 or negative is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('Zero Month FD', 0, 0.10)`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );

        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('Negative Month FD', -5, 0.10)`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
    });

    // 4. `interest_rate > 1` is rejected (rate must be a fraction, not a percentage)
    test("4. interest_rate > 1 is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('High Rate FD', 12, 1.10)`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
        
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('Negative Rate FD', 12, -0.05)`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
    });

    // 5. `effective_to < effective_from` is rejected by CHECK constraint
    test("5. effective_to < effective_from is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, effective_from, effective_to) 
                 VALUES ('Time Travel FD', 12, 0.10, '2024-01-01', '2023-12-31')`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
    });

    // 6. Rate is stored as a fraction: 13% = 0.1300, not 13 or 13.00
    test("6. Rate is stored as a fraction", async () => {
        const res = await client.query(`SELECT interest_rate FROM fd_plan WHERE plan_name = '6 Month FD'`);
        const rate = res.rows[0].interest_rate;
        assert.equal(Number(rate), 0.1300, "13% should be stored as 0.1300");
    });

    // 7. NULL `plan_name` is rejected
    test("7. NULL plan_name is rejected with code 23502", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES (NULL, 12, 0.10)`
            ),
            (err) => {
                assert.equal(err.code, "23502", "Expected not_null_violation (23502)");
                return true;
            }
        );
    });

    // 8. Invalid `status` values are rejected
    test("8. Invalid status values are rejected with code 23514", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, status) VALUES ('Invalid Status FD', 12, 0.10, 'DELETED')`
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
    });
});
