/**
 * tests/db/business-hours-limits.test.mjs
 * P03-M01-T01 — fn_check_business_hours, fn_check_withdrawal_single_limit,
 *               fn_check_withdrawal_daily_limit, fn_get_parameter
 *
 * All tests run in one rolled-back transaction on a disposable schema so they
 * cannot affect the development database.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireDisposableDatabase, pool } from '../helpers/customer-relations.mjs';

describe('P03-M01-T01: business-hour and withdrawal-limit functions', () => {
  let client;

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    await client.query('BEGIN');
    // Ensure a clean slate for system_parameter values we might mutate
    await client.query("SAVEPOINT sp_start");
  });

  after(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  // ── fn_get_parameter ───────────────────────────────────────────────────

  describe('fn_get_parameter', () => {
    test('returns the seeded WITHDRAWAL_SINGLE_LIMIT value', async () => {
      const { rows } = await client.query(
        "SELECT fn_get_parameter('WITHDRAWAL_SINGLE_LIMIT') AS v"
      );
      assert.equal(rows[0].v, '100000.00');
    });

    test('returns the seeded WITHDRAWAL_DAILY_LIMIT value', async () => {
      const { rows } = await client.query(
        "SELECT fn_get_parameter('WITHDRAWAL_DAILY_LIMIT') AS v"
      );
      assert.equal(rows[0].v, '200000.00');
    });

    test('returns NULL for an unknown key', async () => {
      const { rows } = await client.query(
        "SELECT fn_get_parameter('NON_EXISTENT_KEY_XYZ') AS v"
      );
      assert.equal(rows[0].v, null);
    });

    test('reads updated value after an in-transaction UPDATE', async () => {
      await client.query("SAVEPOINT sp_param_update");
      await client.query(
        "UPDATE system_parameter SET param_value = '50000.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'"
      );
      const { rows } = await client.query(
        "SELECT fn_get_parameter('WITHDRAWAL_SINGLE_LIMIT') AS v"
      );
      assert.equal(rows[0].v, '50000.00');
      await client.query("ROLLBACK TO SAVEPOINT sp_param_update");
    });
  });

  // ── fn_check_business_hours / fn_is_business_hour ─────────────────────

  describe('fn_check_business_hours', () => {
    test('returns true for a timestamp during business hours (09:00 Colombo)', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-06-16 09:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, true);
    });

    test('returns false for a timestamp before business hours (07:00 Colombo)', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-06-16 07:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('returns false for a timestamp after business hours (18:00 Colombo)', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-06-16 18:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('returns false for a seeded Poya holiday (2025-01-13)', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-01-13 10:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('returns true for a business day with custom open/close times', async () => {
      await client.query("SAVEPOINT sp_cal");
      await client.query(`
        INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
        VALUES ('2025-07-04', true, '07:00', '13:00', 'TEST-SHORT-DAY')
      `);
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-07-04 08:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, true);
      const { rows: after } = await client.query(
        "SELECT fn_check_business_hours('2025-07-04 14:00:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, true);
      assert.equal(after[0].ok, false);
      await client.query("ROLLBACK TO SAVEPOINT sp_cal");
    });

    test('business hours are data-driven: changing BUSINESS_HOUR_START shifts the boundary', async () => {
      await client.query("SAVEPOINT sp_hours");
      await client.query(
        "UPDATE system_parameter SET param_value = '06:00' WHERE param_key = 'BUSINESS_HOUR_START'"
      );
      const { rows } = await client.query(
        "SELECT fn_check_business_hours('2025-06-16 06:30:00+05:30'::timestamptz) AS ok"
      );
      assert.equal(rows[0].ok, true);
      await client.query("ROLLBACK TO SAVEPOINT sp_hours");
    });
  });

  // ── fn_check_withdrawal_single_limit ──────────────────────────────────

  describe('fn_check_withdrawal_single_limit', () => {
    test('returns true for an amount below the limit', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(50000.00) AS ok"
      );
      assert.equal(rows[0].ok, true);
    });

    test('returns true for an amount equal to the limit (boundary)', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(100000.00) AS ok"
      );
      assert.equal(rows[0].ok, true);
    });

    test('returns false for an amount one cent above the limit', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(100000.01) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('returns false for NULL input', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(NULL::numeric(15,2)) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('limit is data-driven: changing the parameter changes the result', async () => {
      await client.query("SAVEPOINT sp_single");
      await client.query(
        "UPDATE system_parameter SET param_value = '5000.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'"
      );
      const { rows: over } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(5000.01) AS ok"
      );
      const { rows: exact } = await client.query(
        "SELECT fn_check_withdrawal_single_limit(5000.00) AS ok"
      );
      assert.equal(over[0].ok, false);
      assert.equal(exact[0].ok, true);
      await client.query("ROLLBACK TO SAVEPOINT sp_single");
    });
  });

  // ── fn_check_withdrawal_daily_limit ───────────────────────────────────

  describe('fn_check_withdrawal_daily_limit', () => {
    let accountId, planId, branchId, agentId;

    before(async () => {
      // Create a minimal account fixture for daily-limit tests
      const branch = await client.query(
        "INSERT INTO branch (branch_name, branch_code, address, phone) VALUES ('BizRulesBranch', 'BRB01', '1 Test St', '0111000001') RETURNING branch_id"
      );
      branchId = branch.rows[0].branch_id;
      const role = await client.query("SELECT role_id FROM role WHERE role_name = 'AGENT' LIMIT 1");
      const user = await client.query(
        "INSERT INTO app_user (username, password_hash, role_id) VALUES ('brl_agent_01', 'hash', $1) RETURNING user_id",
        [role.rows[0].role_id]
      );
      agentId = user.rows[0].user_id;
      await client.query(
        "INSERT INTO agent (agent_id, branch_id, employee_no, full_name, nic_passport_no, email) VALUES ($1,$2,'EMP-BRL01','Limit Agent','LNIC001','limitagent@example.test')",
        [agentId, branchId]
      );
      const plan = await client.query(
        "SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult' LIMIT 1"
      );
      planId = plan.rows[0].plan_id;
      const acct = await client.query(
        "INSERT INTO account (plan_id, branch_id, account_number, current_balance, opened_date) VALUES ($1,$2,'ACC-BRL-001',500000.00, CURRENT_DATE) RETURNING account_id",
        [planId, branchId]
      );
      accountId = acct.rows[0].account_id;
    });

    test('returns true when no withdrawals exist today', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 50000.00) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, true);
    });

    test('returns true when cumulative total equals the daily limit exactly (boundary)', async () => {
      await client.query("SAVEPOINT sp_daily_exact");
      const channel = await client.query(
        "SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1"
      );
      const channelId = channel.rows[0].channel_id;
      // Insert a committed withdrawal of 150,000 first
      await client.query(
        `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
         VALUES ($1,$2,$3,'REF-BRL-001','WITHDRAWAL',150000.00,now(),350000.00)`,
        [accountId, agentId, channelId]
      );
      // 150,000 used + 50,000 new = 200,000 = limit → true
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 50000.00) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, true);
      await client.query("ROLLBACK TO SAVEPOINT sp_daily_exact");
    });

    test('returns false when cumulative total would exceed the daily limit by one cent', async () => {
      await client.query("SAVEPOINT sp_daily_over");
      const channel = await client.query(
        "SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1"
      );
      const channelId = channel.rows[0].channel_id;
      await client.query(
        `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
         VALUES ($1,$2,$3,'REF-BRL-002','WITHDRAWAL',150000.00,now(),350000.00)`,
        [accountId, agentId, channelId]
      );
      // 150,000 + 50,000.01 = 200,000.01 > 200,000 → false
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 50000.01) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, false);
      await client.query("ROLLBACK TO SAVEPOINT sp_daily_over");
    });

    test('returns false for NULL account_id', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit(NULL::uuid, 100.00) AS ok"
      );
      assert.equal(rows[0].ok, false);
    });

    test('returns false for NULL amount', async () => {
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, NULL::numeric(15,2)) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, false);
    });

    test('daily limit is data-driven: lowering the parameter changes the result', async () => {
      await client.query("SAVEPOINT sp_daily_param");
      await client.query(
        "UPDATE system_parameter SET param_value = '1000.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'"
      );
      // 1,500 > 1,000 → false
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 1500.00) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, false);
      // 999.99 <= 1,000 → true
      const { rows: ok } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 999.99) AS ok",
        [accountId]
      );
      assert.equal(ok[0].ok, true);
      await client.query("ROLLBACK TO SAVEPOINT sp_daily_param");
    });

    test('only counts WITHDRAWAL type rows, not deposits', async () => {
      await client.query("SAVEPOINT sp_daily_type");
      const channel = await client.query(
        "SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1"
      );
      const channelId = channel.rows[0].channel_id;
      // Insert a large DEPOSIT — should not count toward the daily withdrawal total
      await client.query(
        `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
         VALUES ($1,$2,$3,'REF-BRL-003','DEPOSIT',999999.00,now(),1499999.00)`,
        [accountId, agentId, channelId]
      );
      const { rows } = await client.query(
        "SELECT fn_check_withdrawal_daily_limit($1::uuid, 100000.00) AS ok",
        [accountId]
      );
      assert.equal(rows[0].ok, true);
      await client.query("ROLLBACK TO SAVEPOINT sp_daily_type");
    });
  });
});
