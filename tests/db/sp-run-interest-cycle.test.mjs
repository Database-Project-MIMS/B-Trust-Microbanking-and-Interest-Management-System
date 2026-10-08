import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* loaded by runner */ }
}
const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("P04-M05-T04: sp_run_interest_cycle", () => {
    let client;
    let account1;
    let account2;
    let planId;
    let cycleDate = '2026-05-01'; // Future date for testing

    before(async () => {
        client = new pg.Client({ connectionString });
        client.on('notice', msg => console.warn("PG NOTICE:", msg.message));
        await client.connect();

        // Cleanup before starting
        await client.query("DELETE FROM interest_payout");
        await client.query("DELETE FROM interest_run");
        await client.query("DELETE FROM fixed_deposit");

        // Setup 2 FDs to simulate a cycle run
        const pRes = await client.query("SELECT fd_plan_id FROM fd_plan WHERE status = 'ACTIVE' LIMIT 1");
        planId = pRes.rows[0].fd_plan_id;

        const accRes = await client.query("SELECT account_id FROM account WHERE status = 'ACTIVE' LIMIT 2");
        account1 = accRes.rows[0].account_id;
        account2 = accRes.rows[1].account_id;
        
        // Give them money
        await client.query("UPDATE account SET current_balance = 500000 WHERE account_id IN ($1, $2)", [account1, account2]);

        // Open FDs manually to bypass full setup complexity
        await client.query(`
            INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date)
            VALUES 
            ($1, $3, 100000, 0.12, '2026-04-01', '2026-10-01', '2026-05-01'),
            ($2, $3, 50000,  0.12, '2026-04-01', '2026-10-01', '2026-05-01')
        `, [account1, account2, planId]);
    });

    after(async () => {
        await client.query("DELETE FROM interest_payout");
        await client.query("DELETE FROM interest_run");
        await client.query("DELETE FROM fixed_deposit");
        await client.end();
    });

    test("1. Run with 2 due FDs -> 2 payouts, correct totals", async () => {
        // Run the cycle for '2026-05-01'
        const res = await client.query(`SELECT sp_run_interest_cycle($1, NULL) as run_id`, [cycleDate]);
        const runId = res.rows[0].run_id;
        
        const runRes = await client.query(`SELECT fd_count, status, exception_count FROM interest_run WHERE run_id = $1`, [runId]);
        console.log("DEBUG CYCLE RUN:", runRes.rows[0]);
        assert.equal(runRes.rows[0].status, 'COMPLETED');
        assert.equal(Number(runRes.rows[0].fd_count), 2, "Should have paid 2 FDs");
        assert.equal(Number(runRes.rows[0].exception_count), 0, "No exceptions should happen");
    });

    test("2. Re-run same cycle date -> 23505 on interest_run", async () => {
        await assert.rejects(
            client.query(`SELECT sp_run_interest_cycle($1, NULL)`, [cycleDate]),
            (err) => err.code === '23505' // Unique constraint violation on cycle_date
        );
    });

    test("3. next_interest_date advances by 30 days", async () => {
        const fdRes = await client.query(`SELECT next_interest_date FROM fixed_deposit WHERE account_id = $1`, [account1]);
        const nextDate = fdRes.rows[0].next_interest_date;
        // nextDate is a Date object (if node-postgres parses it), verify it's 2026-05-31
        assert.equal(nextDate.getDate(), 31, "Next interest date should advance by 30 days exactly (May 1 -> May 31)");
    });

    test("4. Interest credited to the linked savings account balance", async () => {
        // Balances were 500000. For account1 (100k principal, 12% rate, 30 days -> ~986.30 payout)
        // Wait, 12% is 0.12. (100000 * 0.12 * 30) / 365 = 986.30
        const accRes = await client.query(`SELECT current_balance FROM account WHERE account_id = $1`, [account1]);
        const newBalance = Number(accRes.rows[0].current_balance);
        assert.equal(newBalance, 500000 + 986.30, "Balance should reflect the exact payout amount");
    });
});
