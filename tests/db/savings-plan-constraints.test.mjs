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

describe("P01-M03-T01: savings_plan schema constraints", () => {
    let client;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
    });

    after(async () => {
        await client.end();
    });

    // AC-1 / AC-2: exactly 5 seeded plans, with the BR-03..BR-07 rates/minimums
    // and the eligibility columns populated per the accepted spec.
    test("1. Exactly 5 savings plans exist with the correct rates, minimums and eligibility data", async () => {
        const res = await client.query(
            `SELECT plan_name, interest_rate, min_balance, min_age_years, max_age_years,
                    min_holders, max_holders, requires_all_adult
             FROM savings_plan
             ORDER BY plan_name`,
        );
        assert.equal(res.rows.length, 5, "Exactly 5 plans should exist");

        const byName = Object.fromEntries(res.rows.map((r) => [r.plan_name, r]));

        assert.equal(Number(byName["Children"].interest_rate), 0.12);
        assert.equal(Number(byName["Children"].min_balance), 0);
        assert.equal(byName["Children"].min_age_years, null);
        assert.equal(byName["Children"].max_age_years, 12);
        assert.equal(byName["Children"].min_holders, 1);
        assert.equal(byName["Children"].max_holders, 1);
        assert.equal(byName["Children"].requires_all_adult, false);

        assert.equal(Number(byName["Teen"].interest_rate), 0.11);
        assert.equal(Number(byName["Teen"].min_balance), 500);
        assert.equal(byName["Teen"].min_age_years, 13);
        assert.equal(byName["Teen"].max_age_years, 17);
        assert.equal(byName["Teen"].requires_all_adult, false);

        assert.equal(Number(byName["Adult"].interest_rate), 0.1);
        assert.equal(Number(byName["Adult"].min_balance), 1000);
        assert.equal(byName["Adult"].min_age_years, 18);
        assert.equal(byName["Adult"].max_age_years, 59);
        assert.equal(byName["Adult"].requires_all_adult, true);

        assert.equal(Number(byName["Senior"].interest_rate), 0.13);
        assert.equal(Number(byName["Senior"].min_balance), 1000);
        assert.equal(byName["Senior"].min_age_years, 60);
        assert.equal(byName["Senior"].max_age_years, null);
        assert.equal(byName["Senior"].requires_all_adult, true);

        assert.equal(Number(byName["Joint"].interest_rate), 0.07);
        assert.equal(Number(byName["Joint"].min_balance), 5000);
        assert.equal(byName["Joint"].min_age_years, null);
        assert.equal(byName["Joint"].max_age_years, null);
        assert.equal(byName["Joint"].min_holders, 2);
        assert.equal(byName["Joint"].max_holders, 4);
        assert.equal(byName["Joint"].requires_all_adult, true);
    });

    // AC-1: rate is stored as a fraction, never a whole-number percentage
    test("2. Rate is stored as a fraction", async () => {
        const res = await client.query(
            `SELECT interest_rate FROM savings_plan WHERE plan_name = 'Senior'`,
        );
        assert.equal(Number(res.rows[0].interest_rate), 0.13, "13% should be stored as 0.1300");
    });

    // AC-3: duplicate plan_name is rejected
    test("3. Duplicate plan_name is rejected with code 23505", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan (plan_name, interest_rate, min_balance)
                 VALUES ('Adult', 0.10, 1000.00)`,
            ),
            (err) => {
                assert.equal(err.code, "23505", "Expected unique_violation (23505)");
                return true;
            },
        );
    });

    // AC-4: max_age_years < min_age_years is rejected by chk_savings_plan_age_range
    test("4. max_age_years < min_age_years is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan
                    (plan_name, interest_rate, min_balance, min_age_years, max_age_years)
                 VALUES ('Backwards Age Plan', 0.10, 0.00, 30, 20)`,
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            },
        );
    });

    // AC-5: max_holders < min_holders is rejected by chk_savings_plan_holder_range
    test("5. max_holders < min_holders is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan
                    (plan_name, interest_rate, min_balance, min_holders, max_holders)
                 VALUES ('Backwards Holders Plan', 0.10, 0.00, 5, 2)`,
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            },
        );
    });

    // AC-6: NULL plan_name is rejected
    test("6. NULL plan_name is rejected with code 23502", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan (plan_name, interest_rate, min_balance)
                 VALUES (NULL, 0.10, 0.00)`,
            ),
            (err) => {
                assert.equal(err.code, "23502", "Expected not_null_violation (23502)");
                return true;
            },
        );
    });

    // AC-6: invalid status is rejected
    test("7. Invalid status values are rejected with code 23514", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan (plan_name, interest_rate, min_balance, status)
                 VALUES ('Invalid Status Plan', 0.10, 0.00, 'DELETED')`,
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            },
        );
    });

    // AC: min_balance below zero is rejected by chk_savings_plan_min_balance_nonneg
    test("8. Negative min_balance is rejected by CHECK constraint", async () => {
        await assert.rejects(
            client.query(
                `INSERT INTO savings_plan (plan_name, interest_rate, min_balance)
                 VALUES ('Negative Balance Plan', 0.10, -1.00)`,
            ),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            },
        );
    });
});
