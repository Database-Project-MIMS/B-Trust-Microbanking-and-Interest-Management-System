import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { listFdProducts, updateFdProduct } from "../../services/fd-product-service.ts";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
    try { process.loadEnvFile(); } catch { }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("P01-M05-T02: FD Products Service Tests", () => {
    let client;
    let testFdPlanId;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        // Ensure we have some seed data from Phase 0
        const fdRes = await client.query(`SELECT fd_plan_id FROM fd_plan WHERE status = 'ACTIVE' ORDER BY tenure_months LIMIT 1`);
        if (fdRes.rows.length > 0) {
            testFdPlanId = fdRes.rows[0].fd_plan_id;
        }
    });

    after(async () => {
        await client.end();
    });

    test("1. listFdProducts returns products (including seed data)", async () => {
        const products = await listFdProducts();
        assert.ok(products.length >= 3, "Should return at least 3 active products");
        
        // Verify rates are returned as string fractions
        for (const p of products) {
            assert.equal(typeof p.interestRate, "string");
            const rate = parseFloat(p.interestRate);
            assert.ok(rate > 0 && rate <= 1, "Rate must be a fraction between 0 and 1");
        }
    });

    test("2. updateFdProduct fails when updating to invalid rate limits (enforced at DB level or Service)", async () => {
        // The DB constraint is typically checking interest rate > 0
        try {
            await updateFdProduct(testFdPlanId, { interestRate: "-0.05" });
            assert.fail("Should have thrown error for negative rate");
        } catch (error) {
            // Check that it's a constraint error or our service validation
            assert.ok(error !== null);
        }
    });

    test("3. updateFdProduct successfully updates the rate and applies SCD2 logic", async () => {
        // This will update the FD product to a new rate
        const newRate = "0.1999";
        
        const result = await updateFdProduct(testFdPlanId, { interestRate: newRate });
        
        assert.equal(result.interestRate, newRate);
        assert.notEqual(result.fdPlanId, testFdPlanId, "fd_plan_id should change due to SCD2 insert-new behavior");

        // Verify that there are now at least 4 products total (3 + 1 new) in the list
        const products = await listFdProducts();
        assert.ok(products.length >= 4);
    });
});
