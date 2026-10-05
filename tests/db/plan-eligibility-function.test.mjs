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

describe("P01-M03-T02: fn_check_plan_eligibility", () => {
    let client;
    let planIds;
    let inactivePlanId;

    async function checkEligibility(planId, dateOfBirth, holderCount) {
        const res = await client.query(
            `SELECT fn_check_plan_eligibility($1, $2, $3) AS eligible`,
            [planId, dateOfBirth, holderCount],
        );
        return res.rows[0].eligible;
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        const res = await client.query(
            `SELECT plan_id, plan_name FROM savings_plan`,
        );
        planIds = Object.fromEntries(
            res.rows.map((r) => [r.plan_name, r.plan_id]),
        );

        const inactive = await client.query(
            `INSERT INTO savings_plan (plan_name, interest_rate, min_balance, status)
             VALUES ('TEST-Inactive Plan', 0.10, 0.00, 'INACTIVE')
             RETURNING plan_id`,
        );
        inactivePlanId = inactive.rows[0].plan_id;
    });

    after(async () => {
        await client.query(
            `DELETE FROM savings_plan WHERE plan_name = 'TEST-Inactive Plan'`,
        );
        await client.end();
    });

    // AC-1: child aged 15 rejected for Children (max_age_years = 12)
    test("1. Child aged 15 is rejected for Children", async () => {
        const dob = "2011-01-01"; // ~15 years old as of 2026
        const eligible = await checkEligibility(planIds["Children"], dob, 1);
        assert.equal(eligible, false);
    });

    // AC-2: adult aged 30 accepted for Adult (18-59)
    test("2. Adult aged 30 is accepted for Adult", async () => {
        const dob = "1996-01-01"; // ~30 years old as of 2026
        const eligible = await checkEligibility(planIds["Adult"], dob, 1);
        assert.equal(eligible, true);
    });

    // AC-3: single holder rejected for Joint (min_holders = 2)
    test("3. Single holder is rejected for Joint", async () => {
        const dob = "1996-01-01";
        const eligible = await checkEligibility(planIds["Joint"], dob, 1);
        assert.equal(eligible, false);
    });

    // AC-4: Senior has no upper age bound (max_age_years IS NULL)
    test("4. Senior accepts any age at or above min_age_years, no upper bound", async () => {
        const dob = "1930-01-01"; // ~96 years old
        const eligible = await checkEligibility(planIds["Senior"], dob, 1);
        assert.equal(eligible, true);
    });

    // AC-5: Children has no lower age bound (min_age_years IS NULL)
    test("5. Children accepts any age at or below max_age_years, no lower bound", async () => {
        const dob = new Date().toISOString().slice(0, 10); // born today, age 0
        const eligible = await checkEligibility(planIds["Children"], dob, 1);
        assert.equal(eligible, true);
    });

    // AC-6: holder count inclusive boundaries for Joint (min_holders=2, max_holders=4)
    test("6. Joint holder count boundaries are inclusive", async () => {
        const dob = "1996-01-01";
        assert.equal(await checkEligibility(planIds["Joint"], dob, 2), true, "2 holders (min) should be accepted");
        assert.equal(await checkEligibility(planIds["Joint"], dob, 4), true, "4 holders (max) should be accepted");
        assert.equal(await checkEligibility(planIds["Joint"], dob, 5), false, "5 holders should be rejected");
    });

    // AC-7: nonexistent plan_id returns false, never an error
    test("7. Nonexistent plan_id returns false", async () => {
        const res = await client.query(
            `SELECT fn_check_plan_eligibility(gen_random_uuid(), '1996-01-01', 1) AS eligible`,
        );
        assert.equal(res.rows[0].eligible, false);
    });

    // AC-8: INACTIVE plan returns false regardless of age/holder fit
    test("8. INACTIVE plan returns false", async () => {
        const eligible = await checkEligibility(inactivePlanId, "1996-01-01", 1);
        assert.equal(eligible, false);
    });

    // AC-9: NULL/invalid input returns false, never raises
    test("9. NULL date_of_birth, and NULL/zero/negative holder_count, all return false", async () => {
        assert.equal(await checkEligibility(planIds["Adult"], null, 1), false);
        assert.equal(await checkEligibility(planIds["Adult"], "1996-01-01", null), false);
        assert.equal(await checkEligibility(planIds["Adult"], "1996-01-01", 0), false);
        assert.equal(await checkEligibility(planIds["Adult"], "1996-01-01", -1), false);
    });

    // AC-10: age is computed as whole completed years, not naive year subtraction
    test("10. Age is computed as whole completed years against CURRENT_DATE", async () => {
        const today = new Date();

        const turns18Today = new Date(today);
        turns18Today.setFullYear(today.getFullYear() - 18);
        const dobTurns18Today = turns18Today.toISOString().slice(0, 10);
        assert.equal(
            await checkEligibility(planIds["Adult"], dobTurns18Today, 1),
            true,
            "someone who turns 18 today should already be eligible for Adult (min_age_years=18)",
        );

        const turns18Tomorrow = new Date(today);
        turns18Tomorrow.setFullYear(today.getFullYear() - 18);
        turns18Tomorrow.setDate(turns18Tomorrow.getDate() + 1);
        const dobTurns18Tomorrow = turns18Tomorrow.toISOString().slice(0, 10);
        assert.equal(
            await checkEligibility(planIds["Adult"], dobTurns18Tomorrow, 1),
            false,
            "someone who turns 18 tomorrow is still 17 today and should be rejected for Adult",
        );
    });
});
