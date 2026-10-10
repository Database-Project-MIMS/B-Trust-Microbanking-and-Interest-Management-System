import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolatedOpsDatabase } from '../helpers/isolated-ops-database.mjs';

if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(); } catch { /* loaded by runner */ }
}

describe('Interest cycle idempotency (AC-08)', () => {
  let client;
  let isolated;
  let activeAccountId;
  let fdPlanId;
  let fdId;
  const cycleDate = '2026-02-01';

  before(async () => {
    isolated = await isolatedOpsDatabase('interest_idempotency');client=isolated.client;
    
    // Find a plan and an account
    const planRes = await client.query("SELECT fd_plan_id FROM fd_plan WHERE plan_name = '6 Month FD'");
    fdPlanId = planRes.rows[0].fd_plan_id;
    
    const activeRes = await client.query("SELECT account_id FROM account WHERE status = 'ACTIVE' LIMIT 1");
    activeAccountId = activeRes.rows[0].account_id;
    
    // Ensure sufficient balance
    await client.query("UPDATE account SET current_balance = 500000 WHERE account_id = $1", [activeAccountId]);
    
    // Clear existing FDs and interest runs for isolated testing
    await client.query("DELETE FROM interest_payout");
    await client.query("DELETE FROM interest_run");
    await client.query("DELETE FROM fixed_deposit");

    // 1. Seed FD with next_interest_date <= cycleDate
    const insertFd = await client.query(`
      INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount, status,
        interest_rate_at_opening, start_date, maturity_date, next_interest_date
      ) VALUES ($1, $2, 100000, 'ACTIVE', 0.14, '2026-01-01', '2026-07-01', '2026-01-31')
      RETURNING fd_id
    `, [activeAccountId, fdPlanId]);
    fdId = insertFd.rows[0].fd_id;
  });

  after(async () => {
    await isolated?.close();
  });

  test('first run processes all due FDs and credits interest', async () => {
    // Check initial balance
    const balBefore = (await client.query("SELECT current_balance FROM account WHERE account_id = $1", [activeAccountId])).rows[0].current_balance;

    // 2. Run sp_run_interest_cycle
    const runRes = await client.query("SELECT sp_run_interest_cycle($1) AS run_id", [cycleDate]);
    const runId = runRes.rows[0].run_id;

    // 3. Assert: interest_run row created, payouts match fd_count
    const runRow = await client.query("SELECT * FROM interest_run WHERE run_id = $1", [runId]);
    assert.equal(runRow.rows[0].fd_count, 1);
    assert.equal(runRow.rows[0].status, 'COMPLETED');

    const payoutRows = await client.query("SELECT * FROM interest_payout WHERE interest_run_id = $1", [runId]);
    assert.equal(payoutRows.rows.length, 1);
    const payoutAmount = payoutRows.rows[0].interest_amount;

    // 4. Assert: each payout has a linked INTEREST_CREDIT transaction
    const txnRow = await client.query("SELECT * FROM transaction WHERE transaction_id = $1 AND transaction_type = 'INTEREST_CREDIT'", [payoutRows.rows[0].transaction_id]);
    assert.equal(txnRow.rows.length, 1);
    assert.equal(txnRow.rows[0].amount, payoutAmount);

    // 5. Assert: account balances increased by the correct amounts
    const balAfter = (await client.query("SELECT current_balance FROM account WHERE account_id = $1", [activeAccountId])).rows[0].current_balance;
    assert.equal(Number(balAfter), Number(balBefore) + Number(payoutAmount));
  });

  test('re-running the same cycle date is rejected (23505)', async () => {
    // 1. Run sp_run_interest_cycle(today) again
    await assert.rejects(
      client.query("SELECT sp_run_interest_cycle($1)", [cycleDate]),
      /unique constraint "interest_run_cycle_date_key"/
    );
  });

  test('same FD + same cycle_date payout is rejected (23505)', async () => {
    // Try to manually insert a duplicate interest_payout
    const runRows = await client.query("SELECT run_id FROM interest_run LIMIT 1");
    const txnRows = await client.query("SELECT transaction_id FROM transaction LIMIT 1");
    
    await assert.rejects(
      client.query(`
        INSERT INTO interest_payout (
          fd_id, interest_run_id, transaction_id, cycle_date, payout_date, interest_amount
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, 100)
      `, [fdId, runRows.rows[0].run_id, txnRows.rows[0].transaction_id, cycleDate]),
      /unique constraint "uq_payout_fd_cycle"/
    );
  });

  test('partial failure does not roll back completed payouts', async () => {
    // 1. Set up one FD that will fail (e.g., linked to a CLOSED account)
    const closedRes = await client.query("SELECT account_id FROM account WHERE account_id<>$1 LIMIT 1",[activeAccountId]);
    const closedId = closedRes.rows[0].account_id;
    await client.query("UPDATE account SET status='FROZEN' WHERE account_id=$1",[closedId]);
    
    await client.query(`
      INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount, status,
        interest_rate_at_opening, start_date, maturity_date, next_interest_date
      ) VALUES ($1, $2, 100000, 'ACTIVE', 0.14, '2026-01-01', '2026-07-01', '2026-01-31')
    `, [closedId, fdPlanId]);

    // 2. Run the cycle for a new date
    const runRes = await client.query("SELECT sp_run_interest_cycle('2026-02-02') AS run_id");
    
    // 3. Assert: exception_count = 1
    const runRow = await client.query("SELECT * FROM interest_run WHERE run_id = $1", [runRes.rows[0].run_id]);
    assert.equal(runRow.rows[0].exception_count, 1);
  });
});

describe('Report totals reconciliation (AC-09)', () => {
  let client;
  let isolated;
  let initialTxnCount = 0;

  before(async () => {
    isolated=await isolatedOpsDatabase('interest_reports');client=isolated.client;
    
    // Seed some data for the reports
    const planRes = await client.query("SELECT fd_plan_id FROM fd_plan WHERE plan_name = '6 Month FD'");
    const fdPlanId = planRes.rows[0].fd_plan_id;
    
    const activeRes = await client.query("SELECT account_id FROM account WHERE status = 'ACTIVE' LIMIT 2");
    
    await client.query("DELETE FROM interest_payout");
    await client.query("DELETE FROM interest_run");
    await client.query("DELETE FROM fixed_deposit");

    for (const row of activeRes.rows) {
      await client.query(`
        INSERT INTO fixed_deposit (
          account_id, fd_plan_id, principal_amount, status,
          interest_rate_at_opening, start_date, maturity_date, next_interest_date
        ) VALUES ($1, $2, 100000, 'ACTIVE', 0.14, '2026-01-01', '2026-07-01', '2026-01-31')
      `, [row.account_id, fdPlanId]);
    }

    const initTxnRes = await client.query(`SELECT COUNT(*) AS cnt FROM transaction WHERE transaction_type = 'INTEREST_CREDIT'`);
    initialTxnCount = Number(initTxnRes.rows[0].cnt);

    await client.query("SELECT sp_run_interest_cycle('2026-02-01')");
  });

  after(async () => {
    await isolated?.close();
  });

  test('RPT-03 total principal matches SUM of active FD principals', async () => {
    const reportTotal = await client.query(`SELECT SUM(principal_amount) AS total FROM vw_rpt03_active_fds`);
    const directTotal = await client.query(`SELECT SUM(principal_amount) AS total FROM fixed_deposit WHERE status = 'ACTIVE'`);
    assert.strictEqual(reportTotal.rows[0].total, directTotal.rows[0].total, 'RPT-03 principal total must match direct query');
  });

  test('RPT-04 total interest matches SUM of interest_payout amounts', async () => {
    const reportTotal = await client.query(`SELECT SUM(total_interest) AS total FROM vw_rpt04_interest_distribution WHERE cycle_date IS NOT NULL AND savings_plan_name IS NOT NULL AND fd_product_name IS NOT NULL AND branch_name IS NOT NULL`);
    const directTotal = await client.query(`SELECT SUM(interest_amount) AS total FROM interest_payout`);
    assert.strictEqual(reportTotal.rows[0].total, directTotal.rows[0].total, 'RPT-04 interest total must match payout records');
  });

  test('interest payout count matches INTEREST_CREDIT transaction count', async () => {
    const payoutCount = await client.query(`SELECT COUNT(*) AS cnt FROM interest_payout`);
    const txnCount = await client.query(`SELECT COUNT(*) AS cnt FROM transaction WHERE transaction_type = 'INTEREST_CREDIT'`);
    assert.strictEqual(Number(payoutCount.rows[0].cnt), Number(txnCount.rows[0].cnt) - initialTxnCount, 'Every payout must have exactly one INTEREST_CREDIT');
  });
});
