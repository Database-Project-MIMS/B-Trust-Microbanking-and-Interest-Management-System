/**
 * tests/api/business-rules.test.mjs
 * P03-M01-T01 — enforceBusinessHours(), enforceWithdrawalLimits(),
 *               getParameter() from services/business-rules-service.ts
 *
 * These are service-level tests exercising the TypeScript functions against
 * a real disposable database so the full chain (service → DB function →
 * system_parameter / business_calendar) is verified.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireDisposableDatabase, pool } from '../helpers/customer-relations.mjs';

// Import the service under test. Next.js 'server-only' is shimmed by the test runtime.
const {
  enforceBusinessHours,
  enforceWithdrawalLimits,
  getParameter,
} = await import('../../services/business-rules-service.ts');

describe('P03-M01-T01: business-rules-service', () => {
  let client;
  let today, originalCalendar, originalParameters;

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    today = (await client.query("SELECT (now() AT TIME ZONE 'Asia/Colombo')::date::text AS today")).rows[0].today;
    originalCalendar = (await client.query('SELECT is_business_day, open_time, close_time, description FROM business_calendar WHERE calendar_date=$1::date', [today])).rows[0];
    originalParameters = (await client.query("SELECT param_key, param_value FROM system_parameter WHERE param_key IN ('WITHDRAWAL_SINGLE_LIMIT', 'WITHDRAWAL_DAILY_LIMIT')")).rows;
  });

  after(async () => {
    if (originalCalendar) {
      await client.query('UPDATE business_calendar SET is_business_day=$2, open_time=$3, close_time=$4, description=$5 WHERE calendar_date=$1::date',
        [today, originalCalendar.is_business_day, originalCalendar.open_time, originalCalendar.close_time, originalCalendar.description]);
    } else {
      await client.query('DELETE FROM business_calendar WHERE calendar_date=$1::date', [today]);
    }
    for (const parameter of originalParameters ?? []) {
      await client.query('UPDATE system_parameter SET param_value=$2 WHERE param_key=$1', [parameter.param_key, parameter.param_value]);
    }
    client.release();
    await pool.end();
  });

  // ── getParameter ────────────────────────────────────────────────────────

  describe('getParameter()', () => {
    test('returns string value for a known parameter', async () => {
      const val = await getParameter('WITHDRAWAL_SINGLE_LIMIT');
      assert.ok(val !== null);
      assert.ok(Number(val) > 0);
    });

    test('returns null for an unknown parameter key', async () => {
      const val = await getParameter('TOTALLY_UNKNOWN_PARAM_XYZ');
      assert.equal(val, null);
    });
  });

  // ── enforceBusinessHours ────────────────────────────────────────────────

  describe('enforceBusinessHours()', () => {
    test('uses the Colombo business date and full-day calendar hours', async () => {
      // Ensure today is marked as a business day with permissive hours so CI passes
      await client.query(`
        INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
        VALUES ($1::date, true, '00:00', '24:00', 'TEST-BR-OPEN')
        ON CONFLICT (calendar_date) DO UPDATE SET is_business_day=true, open_time='00:00', close_time='24:00', description='TEST-BR-OPEN'
      `, [today]);
      // Should not throw
      await assert.doesNotReject(() => enforceBusinessHours());
    });

    test('throws OUTSIDE_BUSINESS_HOURS when today is a holiday', async () => {
      // Mark today closed
      await client.query(`
        INSERT INTO business_calendar (calendar_date, is_business_day, description)
        VALUES ($1::date, false, 'TEST-BR-HOLIDAY')
        ON CONFLICT (calendar_date) DO UPDATE SET is_business_day=false, description='TEST-BR-HOLIDAY'
      `, [today]);
      await assert.rejects(
        () => enforceBusinessHours(),
        (err) => {
          assert.equal(err.code, 'OUTSIDE_BUSINESS_HOURS');
          assert.equal(err.status, 409);
          return true;
        }
      );
      // Restore
      await client.query(
        "DELETE FROM business_calendar WHERE calendar_date = $1::date AND description = 'TEST-BR-HOLIDAY'",
        [today]
      );
    });
  });

  // ── enforceWithdrawalLimits ─────────────────────────────────────────────

  describe('enforceWithdrawalLimits()', () => {
    let accountId, agentId, channelId;

    before(async () => {
      // Minimal account for limit tests
      const branch = await client.query(
        "INSERT INTO branch (branch_name, branch_code, address, district, phone) VALUES ('BRTest','BRTST','1 St','Colombo','0110000001') RETURNING branch_id"
      );
      const branchId = branch.rows[0].branch_id;
      const role = await client.query("SELECT role_id FROM role WHERE role_name='AGENT' LIMIT 1");
      const user = await client.query(
        "INSERT INTO app_user (username, password_hash, role_id) VALUES ('brtest_agent','hash',$1) RETURNING user_id",
        [role.rows[0].role_id]
      );
      agentId = user.rows[0].user_id;
      await client.query(
        "INSERT INTO agent (agent_id,branch_id,employee_no,full_name,nic_passport_no,email,date_of_birth,gender,phone,address,hired_date) VALUES ($1,$2,'EMP-BRT01','BR Test Agent','BRNIC01','brtest@example.test','1990-01-01','OTHER','0710000000','1 Test Agent Road','2025-01-01')",
        [agentId, branchId]
      );
      const plan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name='Adult' LIMIT 1");
      const acct = await client.query(
        "INSERT INTO account (plan_id,branch_id,opened_by_agent_id,account_number,current_balance,opened_date) VALUES ($1,$2,$3,'ACC-BRT-001',999999.00,CURRENT_DATE) RETURNING account_id",
        [plan.rows[0].plan_id, branchId, agentId]
      );
      accountId = acct.rows[0].account_id;
      const ch = await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER' LIMIT 1");
      channelId = ch.rows[0].channel_id;
    });

    test('does not throw for a normal withdrawal within both limits', async () => {
      // Use a real pool client that wraps a tx executor
      const { withTransaction } = await import('../../lib/db/with-transaction.ts');
      await assert.doesNotReject(() =>
        withTransaction(async (tx) => {
          await enforceWithdrawalLimits(tx, accountId, '1000.00');
        })
      );
    });

    test('throws SINGLE_LIMIT_EXCEEDED for an amount over 100,000', async () => {
      const { withTransaction } = await import('../../lib/db/with-transaction.ts');
      await assert.rejects(
        () => withTransaction(async (tx) => {
          await enforceWithdrawalLimits(tx, accountId, '100000.01');
        }),
        (err) => {
          assert.equal(err.code, 'SINGLE_LIMIT_EXCEEDED');
          assert.equal(err.status, 409);
          return true;
        }
      );
    });

    test('throws DAILY_LIMIT_EXCEEDED when existing withdrawals + new amount exceeds 200,000', async () => {
      // First insert a large committed withdrawal for today
      await client.query(
        `INSERT INTO transaction (account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,balance_after)
         VALUES ($1,$2,$3,'REF-BRT-SVC-01','WITHDRAWAL',150000.00,now(),849999.00)`,
        [accountId, agentId, channelId]
      );
      const { withTransaction } = await import('../../lib/db/with-transaction.ts');
      await assert.rejects(
        () => withTransaction(async (tx) => {
          // 150,000 committed + 50,000.01 new = 200,000.01 > limit
          await enforceWithdrawalLimits(tx, accountId, '50000.01');
        }),
        (err) => {
          assert.equal(err.code, 'DAILY_LIMIT_EXCEEDED');
          assert.equal(err.status, 409);
          return true;
        }
      );
      // The synthetic posting stays in this disposable DB; immutability remains enabled.
    });

    test('limits are data-driven: lowering WITHDRAWAL_SINGLE_LIMIT rejects a previously-allowed amount', async () => {
      await client.query(
        "UPDATE system_parameter SET param_value='500.00' WHERE param_key='WITHDRAWAL_SINGLE_LIMIT'"
      );
      const { withTransaction } = await import('../../lib/db/with-transaction.ts');
      await assert.rejects(
        () => withTransaction(async (tx) => {
          await enforceWithdrawalLimits(tx, accountId, '500.01');
        }),
        (err) => {
          assert.equal(err.code, 'SINGLE_LIMIT_EXCEEDED');
          return true;
        }
      );
      // Restore
      await client.query(
        "UPDATE system_parameter SET param_value='100000.00' WHERE param_key='WITHDRAWAL_SINGLE_LIMIT'"
      );
    });
  });
});
