import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';

if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* loaded by runner */ }
}
const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("Phase 4: Fixed Deposit Constraints and SP", () => {
    let client;
    let admin;
    let created = false;
    let activeAccountId;
    let inactiveAccountId;
    let fdPlanId;
    let userId;
    let channelId;

    before(async () => {
        if (process.env.MIMS_ISOLATED_TEST !== '1') throw new Error('Use the disposable verification harness.');
        admin = createMigrationClient(connectionString);
        await admin.connect();
        const database = (await admin.query('SELECT current_database() AS name')).rows[0].name;
        assert.ok(['mims_test_closeout', 'mims_test_customer_schema'].includes(database));
        await admin.query('CREATE DATABASE mims_test_fd_opening OWNER mims_owner');
        created = true;
        const owner = new URL(connectionString);
        const app = new URL(process.env.DATABASE_URL);
        owner.pathname = app.pathname = '/mims_test_fd_opening';
        const rebuild = spawnSync(process.execPath, ['scripts/db-rebuild.mjs'],
          { env: { ...process.env, DATABASE_MIGRATION_URL: owner.href, DATABASE_URL: app.href },
            encoding: 'utf8', windowsHide: true, timeout: 30000 });
        assert.equal(rebuild.status, 0, 'Fresh FD-opening fixture rebuild must pass.');
        client = createMigrationClient(owner.href);
        await client.connect();
        
        const planRes = await client.query("SELECT fd_plan_id FROM fd_plan WHERE plan_name = '6 Month FD'");
        fdPlanId = planRes.rows[0].fd_plan_id;
        userId = (await client.query("SELECT user_id FROM app_user WHERE username = 'admin'")).rows[0].user_id;
        channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'")).rows[0].channel_id;
        
        // Find an active account that we can debit from safely.
        // The seeds create some accounts. We'll pick one and give it massive funds.
        const activeRes = await client.query("SELECT account_id FROM account WHERE status = 'ACTIVE' LIMIT 1");
        activeAccountId = activeRes.rows[0].account_id;
        await client.query("UPDATE account SET current_balance = 500000 WHERE account_id = $1", [activeAccountId]);
        
        // Create an inactive account
        const inactiveRes = await client.query("SELECT account_id FROM account WHERE status = 'ACTIVE' OFFSET 1 LIMIT 1");
        inactiveAccountId = inactiveRes.rows[0].account_id;
        await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [inactiveAccountId]);
        
        // Cleanup any existing FDs so we have a clean slate
        // Only this suite's owned disposable DB is cleared; seeded parent history is intact.
        await client.query('DELETE FROM interest_payout');
        await client.query('DELETE FROM interest_run');
        await client.query("DELETE FROM fixed_deposit");
    });

    after(async () => {
        try {
            await client?.end();
            if (created) await admin.query('DROP DATABASE mims_test_fd_opening');
        } finally { await admin?.end(); }
    });

    describe("Task 1: Schema Constraints", () => {
        test("1. Reject zero principal (positive_money check)", async () => {
            await assert.rejects(
                client.query(`
                    INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date)
                    VALUES ($1, $2, 0, 0.13, CURRENT_DATE, CURRENT_DATE + interval '6 months', CURRENT_DATE + interval '30 days')
                `, [activeAccountId, fdPlanId])
            );
        });

        test("2. Reject invalid status", async () => {
            await assert.rejects(
                client.query(`
                    INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date, status)
                    VALUES ($1, $2, 10000, 0.13, CURRENT_DATE, CURRENT_DATE + interval '6 months', CURRENT_DATE + interval '30 days', 'INVALID')
                `, [activeAccountId, fdPlanId])
            );
        });
        
        test("3. Reject maturity_date <= start_date", async () => {
            await assert.rejects(
                client.query(`
                    INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date)
                    VALUES ($1, $2, 10000, 0.13, CURRENT_DATE, CURRENT_DATE - interval '1 day', CURRENT_DATE + interval '30 days')
                `, [activeAccountId, fdPlanId])
            );
        });
    });

    describe("Task 3: fn_calculate_fd_interest", () => {
        const mathTests = [
            [100000.00, 0.1400, 30, 1150.68],
            [100000.00, 0.1300, 30, 1068.49],
            [100000.00, 0.1500, 30, 1232.88],
            [50000.00, 0.1400, 30, 575.34],
            [250000.00, 0.1300, 30, 2671.23]
        ];

        for (const [p, r, d, expected] of mathTests) {
            test(`Math: Principal=${p}, Rate=${r}, Days=${d} -> Expected ${expected}`, async () => {
                const res = await client.query(`SELECT fn_calculate_fd_interest($1, $2, $3) as val`, [p, r, d]);
                assert.equal(Number(res.rows[0].val), expected);
            });
        }
    });

    describe("Task 2: sp_open_fixed_deposit", () => {
        test("1. Open FD with insufficient balance throws exception", async () => {
            const tryAmount = 9000000; // Unreasonably high
            await assert.rejects(
                client.query(`SELECT sp_open_fixed_deposit($1, $2, $3, $4, $5)`, [activeAccountId, fdPlanId, tryAmount, userId, channelId]),
                (err) => err.message.includes("Insufficient balance")
            );
        });
        
        test("2. Open FD on INACTIVE account throws exception", async () => {
            await assert.rejects(
                client.query(`SELECT sp_open_fixed_deposit($1, $2, $3, $4, $5)`, [inactiveAccountId, fdPlanId, 10000, userId, channelId]),
                (err) => err.message.includes("Account is not active")
            );
        });

        test("3. Open FD on ACTIVE account with sufficient balance", async () => {
            const accBefore = await client.query("SELECT current_balance FROM account WHERE account_id = $1", [activeAccountId]);
            const balBefore = Number(accBefore.rows[0].current_balance);

            const res = await client.query(`SELECT sp_open_fixed_deposit($1, $2, $3, $4, $5) as fd_id`, [activeAccountId, fdPlanId, 50000, userId, channelId]);
            const fdId = res.rows[0].fd_id;
            assert.ok(fdId);

            const accAfter = await client.query("SELECT current_balance FROM account WHERE account_id = $1", [activeAccountId]);
            const balAfter = Number(accAfter.rows[0].current_balance);

            assert.equal(balAfter, balBefore - 50000, "Balance should be correctly debited");
            
            // Check maturity date and next interest date
            const fdRes = await client.query("SELECT maturity_date, next_interest_date FROM fixed_deposit WHERE fd_id = $1", [fdId]);
            assert.ok(fdRes.rows.length === 1);
            // It should be successfully inserted
        });

        test("4. Open second ACTIVE FD on same account -> 23505", async () => {
            await assert.rejects(
                client.query(`SELECT sp_open_fixed_deposit($1, $2, $3, $4, $5)`, [activeAccountId, fdPlanId, 10000, userId, channelId]),
                (err) => err.code === '23505'
            );
        });
    });
});
