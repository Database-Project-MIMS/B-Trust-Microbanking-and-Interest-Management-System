import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(); } catch { /* ignore */ }
}

const { withTransaction } = await import('../../lib/db/index.ts');
const { setRlsContext } = await import('../../lib/db/rls-context.ts');

const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

/**
 * Calculates percentile from an array of numbers.
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * P06-M04-T02: Posting Performance Under Load (NFR-PERF-02, NFR-PERF-04).
 *
 * Requirements:
 * - NFR-PERF-02: Deposit and withdrawal posting latency < 3 seconds (p95).
 * - NFR-PERF-04: Concurrent operation under connection contention maintains
 *   transactional integrity without lost updates, deadlocks, or unhandled errors.
 * - SRS §6.7: Ledger queries and index scans hold under EXPLAIN ANALYZE.
 */
test('P06-M04-T02: Posting Performance Under Load (NFR-PERF-02, NFR-PERF-04)', async (t) => {
  const ownerClient = new pg.Client({ connectionString: ownerUrl });
  await ownerClient.connect();

  let adminUserId, agentUserId, branchId, channelId;
  let savedBusinessStart, savedBusinessEnd, savedSingleLimit, savedDailyLimit;
  const createdAccountIds = [];

  try {
    // 1. Ensure business hours and withdrawal limits are permissive for the performance suite
    const startRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
    const endRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
    const singleLimitRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
    const dailyLimitRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`);

    savedBusinessStart = startRes.rows[0]?.param_value || '08:30';
    savedBusinessEnd = endRes.rows[0]?.param_value || '17:00';
    savedSingleLimit = singleLimitRes.rows[0]?.param_value || '100000.00';
    savedDailyLimit = dailyLimitRes.rows[0]?.param_value || '200000.00';

    await ownerClient.query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
    await ownerClient.query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);
    await ownerClient.query(`UPDATE system_parameter SET param_value = '500000.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
    await ownerClient.query(`UPDATE system_parameter SET param_value = '1000000.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`);

    await ownerClient.query(`
      INSERT INTO business_calendar (calendar_date, is_business_day)
      VALUES (CURRENT_DATE, true)
      ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = true
    `);

    // Fetch existing seeded staff and channel
    const adminRes = await ownerClient.query(`
      SELECT u.user_id FROM app_user u
      JOIN role r ON r.role_id = u.role_id
      WHERE r.role_name = 'ADMIN' AND u.status = 'ACTIVE' LIMIT 1
    `);
    adminUserId = adminRes.rows[0].user_id;

    const agentRes = await ownerClient.query(`
      SELECT a.agent_id, a.branch_id FROM agent a
      JOIN app_user u ON u.user_id = a.agent_id
      WHERE u.status = 'ACTIVE' LIMIT 1
    `);
    agentUserId = agentRes.rows[0].agent_id;
    branchId = agentRes.rows[0].branch_id;

    const channelRes = await ownerClient.query(`
      SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1
    `);
    channelId = channelRes.rows[0].channel_id;

    const planRes = await ownerClient.query(`
      SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult' LIMIT 1
    `);
    const planId = planRes.rows[0].plan_id;

    // Helper to provision customer and account
    async function provisionAccount(initialBalance = '10000.00') {
      const suffix = randomBytes(4).toString('hex');
      const custRes = await ownerClient.query(`
        INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email, status)
        VALUES ($1, $2, $3, $4, '1990-05-15', $5, 'ACTIVE')
        RETURNING customer_id
      `, [
        branchId,
        `PERF-C-${suffix}`,
        `90${Date.now().toString().slice(-7)}V`,
        `Perf Customer ${suffix}`,
        `perf.${suffix}@test.invalid`
      ]);
      const customerId = custRes.rows[0].customer_id;

      const accRes = await ownerClient.query(`
        INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        RETURNING account_id
      `, [
        `ACC-PERF-${suffix}`,
        planId,
        branchId,
        agentUserId,
        initialBalance
      ]);
      const accountId = accRes.rows[0].account_id;
      createdAccountIds.push(accountId);

      await ownerClient.query(`
        INSERT INTO account_holder (account_id, customer_id, holder_type)
        VALUES ($1, $2, 'PRIMARY')
      `, [accountId, customerId]);

      // Assign agent to customer so AGENT role is authorized for withdrawals
      await ownerClient.query(`
        INSERT INTO customer_agent (customer_id, agent_id, assigned_date, is_active)
        VALUES ($1, $2, CURRENT_DATE, true)
      `, [customerId, agentUserId]);

      return { accountId, customerId, initialBalance };
    }

    // Helper to post a deposit via withTransaction using application role
    async function executeDeposit(accountId, amount) {
      const start = performance.now();
      const idempotencyKey = randomUUID();
      const res = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId: agentUserId, roleName: 'AGENT', branchId });
        const callRes = await tx.query(
          `CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`,
          [accountId, amount, channelId, agentUserId, idempotencyKey, 'Performance Benchmark Deposit']
        );
        return callRes.rows[0];
      });
      const duration = performance.now() - start;
      return { ok: true, duration, data: res };
    }

    // Helper to attempt a withdrawal via withTransaction using application role
    async function executeWithdrawal(accountId, customerId, amount) {
      const start = performance.now();
      const idempotencyKey = randomUUID();
      try {
        const res = await withTransaction(async (tx) => {
          await setRlsContext(tx, { userId: adminUserId, roleName: 'ADMIN', branchId: null });
          const callRes = await tx.query(
            `CALL sp_try_post_withdrawal($1, $2, $3, $4, $5::uuid[], $6, $7, NULL, NULL, NULL, NULL, NULL)`,
            [accountId, amount, channelId, adminUserId, [customerId], idempotencyKey, 'Performance Benchmark Withdrawal']
          );
          return callRes.rows[0];
        });
        const duration = performance.now() - start;
        const rejected = res.p_rejection_code !== null;
        return {
          ok: !rejected,
          rejected,
          code: res.p_rejection_code,
          duration,
          data: res
        };
      } catch (err) {
        const duration = performance.now() - start;
        return {
          ok: false,
          unexpected: true,
          error: err.message,
          code: err.code,
          duration
        };
      }
    }

    // =========================================================================
    // Test 1: Sequential Baseline (NFR-PERF-02: posting < 3 s)
    // =========================================================================
    await t.test('1. Sequential baseline: time N deposits sequentially, asserting p95 < 3s', async () => {
      const N = 25;
      const accounts = [];
      for (let i = 0; i < N; i++) {
        accounts.push(await provisionAccount('5000.00'));
      }

      const durations = [];
      for (let i = 0; i < N; i++) {
        const result = await executeDeposit(accounts[i].accountId, '250.00');
        assert.equal(result.ok, true, `Deposit ${i + 1} must succeed`);
        durations.push(result.duration);
      }

      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const p50 = percentile(durations, 50);
      const p90 = percentile(durations, 90);
      const p95 = percentile(durations, 95);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Assert SLA requirement: NFR-PERF-02 requires < 3000 ms (3 seconds)
      assert.ok(p95 < 3000, `Sequential p95 latency (${p95.toFixed(2)}ms) must be < 3000ms`);
      assert.ok(max < 3000, `Sequential max latency (${max.toFixed(2)}ms) must be < 3000ms`);

      // Verify all accounts received exactly 1 deposit and balance equals 5250.00
      for (let i = 0; i < N; i++) {
        const balRes = await ownerClient.query(
          `SELECT current_balance::text AS bal FROM account WHERE account_id = $1`,
          [accounts[i].accountId]
        );
        assert.equal(balRes.rows[0].bal, '5250.00', `Account balance must reflect deposit`);
      }
    });

    // =========================================================================
    // Test 2: Concurrent Load Across Mixed Accounts (NFR-PERF-02, NFR-PERF-04)
    // =========================================================================
    await t.test('2. Concurrent load: fire concurrent deposit & withdrawal requests across contended and uncontended accounts', async () => {
      // Provision 2 highly contended accounts and 10 independent accounts
      const contendedAcc1 = await provisionAccount('10000.00');
      const contendedAcc2 = await provisionAccount('1500.00'); // Low balance to trigger business rejections
      const independentAccs = [];
      for (let i = 0; i < 8; i++) {
        independentAccs.push(await provisionAccount('5000.00'));
      }

      const operations = [];

      // 10 concurrent deposits on contendedAcc1 (lock contention, all must succeed)
      for (let i = 0; i < 10; i++) {
        operations.push(() => executeDeposit(contendedAcc1.accountId, '100.00'));
      }

      // 10 concurrent withdrawals of 400.00 on contendedAcc2 (balance 1500, minimum balance 500, allows exactly 2 wins)
      for (let i = 0; i < 10; i++) {
        operations.push(() => executeWithdrawal(contendedAcc2.accountId, contendedAcc2.customerId, '400.00'));
      }

      // 8 concurrent deposits on independent accounts (uncontended)
      for (let i = 0; i < 8; i++) {
        const acc = independentAccs[i];
        operations.push(() => executeDeposit(acc.accountId, '500.00'));
      }

      // 8 concurrent withdrawals on independent accounts (uncontended)
      for (let i = 0; i < 8; i++) {
        const acc = independentAccs[i];
        operations.push(() => executeWithdrawal(acc.accountId, acc.customerId, '200.00'));
      }

      // Execute all 36 operations concurrently
      const startTime = performance.now();
      const results = await Promise.all(operations.map(fn => fn()));
      const totalElapsed = performance.now() - startTime;

      const durations = results.map(r => r.duration);
      const p50 = percentile(durations, 50);
      const p95 = percentile(durations, 95);
      const max = Math.max(...durations);

      const successful = results.filter(r => r.ok).length;
      const businessRejections = results.filter(r => r.rejected).length;
      const unexpectedFailures = results.filter(r => r.unexpected).length;

      // Assertions
      const unexpList = results.filter(r => r.unexpected).map(r => r.error);
      assert.equal(unexpectedFailures, 0, `There must be 0 unexpected failures or deadlocks: ${unexpList.slice(0, 3).join(', ')}`);
      assert.ok(p95 < 3000, `Concurrent p95 latency (${p95.toFixed(2)}ms) must be < 3000ms`);
      assert.ok(successful > 0, `Successful operations must be recorded`);
      assert.ok(businessRejections > 0, `Contended account with shortfall must cleanly reject without crashing`);

      // Ledger reconciliation on contendedAcc1: 10000.00 + 10 * 100.00 = 11000.00
      const rec1 = await ownerClient.query(`
        SELECT a.current_balance::text AS bal,
               COALESCE(SUM(t.amount), 0)::text AS sum_ledger
        FROM account a
        LEFT JOIN transaction t ON t.account_id = a.account_id
        WHERE a.account_id = $1
        GROUP BY a.account_id, a.current_balance
      `, [contendedAcc1.accountId]);
      assert.equal(rec1.rows[0].bal, '11000.00', `Contended deposits must all safely serialize`);
      assert.equal(rec1.rows[0].sum_ledger, '1000.00', `Sum of ledger rows must match exactly`);

      // Ledger reconciliation on contendedAcc2: balance must never drop below minimum
      const rec2 = await ownerClient.query(`
        SELECT current_balance FROM account WHERE account_id = $1
      `, [contendedAcc2.accountId]);
      assert.ok(Number(rec2.rows[0].current_balance) >= 500, `Contended withdrawals must never breach minimum balance`);
    });

    // =========================================================================
    // Test 3: Index Usage & Query Execution Plan (SRS §6.7, NFR-PERF-04)
    // =========================================================================
    await t.test('3. Query plans: EXPLAIN ANALYZE confirms index scans on transaction table', async () => {
      const sampleAccount = createdAccountIds[0];

      // Simulate production table scale where sequential scan is disabled/disfavored
      await ownerClient.query(`SET enable_seqscan = off`);

      // Statement lookup query: must use index on (account_id, transaction_date)
      const planStatement = await ownerClient.query(`
        EXPLAIN (ANALYZE, FORMAT JSON)
        SELECT transaction_id, reference_number, amount, balance_after, transaction_date
        FROM transaction
        WHERE account_id = $1
        ORDER BY transaction_date DESC, ledger_seq DESC
        LIMIT 20
      `, [sampleAccount]);

      const planStatementText = JSON.stringify(planStatement.rows[0]);
      // Either Index Scan, Index Only Scan, or Bitmap Index Scan
      const usesIndex = planStatementText.includes('Index Scan') || planStatementText.includes('Bitmap Index Scan') || planStatementText.includes('Index Only Scan');
      assert.ok(usesIndex, `Statement lookup query must use an index scan on transaction`);

      // Idempotency lookup query: must use ux_transaction_idempotency
      const testKey = randomUUID();
      const planIdempotency = await ownerClient.query(`
        EXPLAIN (ANALYZE, FORMAT JSON)
        SELECT transaction_id FROM transaction WHERE idempotency_key = $1
      `, [testKey]);

      const planIdempotencyText = JSON.stringify(planIdempotency.rows[0]);
      assert.ok(
        planIdempotencyText.includes('Index Scan') || planIdempotencyText.includes('Bitmap Index Scan'),
        `Idempotency lookup query must use index scan on ux_transaction_idempotency`
      );

      // Reference number lookup query: must use transaction_reference_number_key
      const planRef = await ownerClient.query(`
        EXPLAIN (ANALYZE, FORMAT JSON)
        SELECT transaction_id FROM transaction WHERE reference_number = $1
      `, ['TX-99999999-9999']);

      const planRefText = JSON.stringify(planRef.rows[0]);
      assert.ok(
        planRefText.includes('Index Scan') || planRefText.includes('Bitmap Index Scan'),
        `Reference lookup query must use index scan on transaction.reference_number`
      );

      await ownerClient.query(`SET enable_seqscan = on`);
    });

  } finally {
    // Restore system parameters
    try {
      if (savedBusinessStart && savedBusinessEnd) {
        await ownerClient.query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [savedBusinessStart]);
        await ownerClient.query(`UPDATE system_parameter SET param_value = $2 WHERE param_key = 'BUSINESS_HOUR_END'`, [savedBusinessEnd]);
      }
      if (savedSingleLimit && savedDailyLimit) {
        await ownerClient.query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`, [savedSingleLimit]);
        await ownerClient.query(`UPDATE system_parameter SET param_value = $2 WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`, [savedDailyLimit]);
      }
    } catch { /* ignore cleanup errors */ }

    await ownerClient.end();
  }
});
