import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { checkBusinessHours, checkWithdrawalLimits, OutsideBusinessHoursError, LimitExceededError } from '../../services/business-rules-service.ts';

test('P03-M01-T01: Business Hours & Withdrawal Limits', async (t) => {
  // Save original hours
  const origStartRows = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
  const origEndRows = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
  const origStart = origStartRows[0].param_value;
  const origEnd = origEndRows[0].param_value;

  const origSingleRows = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
  const origDailyRows = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`);
  const origSingle = origSingleRows[0].param_value;
  const origDaily = origDailyRows[0].param_value;

  try {
    await t.test('deposit during business hours → allowed', async () => {
      await query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
      await query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);
      // Should not throw
      await assert.doesNotReject(() => checkBusinessHours());
    });

    await t.test('deposit outside business hours → OutsideBusinessHoursError', async () => {
      await query(`UPDATE system_parameter SET param_value = '23:58' WHERE param_key = 'BUSINESS_HOUR_START'`);
      await query(`UPDATE system_parameter SET param_value = '23:59' WHERE param_key = 'BUSINESS_HOUR_END'`);
      await assert.rejects(
        () => checkBusinessHours(),
        (err: unknown) => {
          assert.ok(err instanceof OutsideBusinessHoursError);
          assert.equal((err as OutsideBusinessHoursError).code, 'OUTSIDE_BUSINESS_HOURS');
          return true;
        }
      );
    });

    await t.test('withdrawal over single limit → LimitExceededError (single)', async () => {
      // Set single limit to 500
      await query(`UPDATE system_parameter SET param_value = '500.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
      // Get any account id for the test (this will not have real transactions)
      const accounts = await query(`SELECT account_id FROM account LIMIT 1`);
      const accountId = accounts[0]?.account_id;
      if (!accountId) return; // skip if no account seeded

      await assert.rejects(
        () => checkWithdrawalLimits(accountId, '600.00'),
        (err: unknown) => {
          assert.ok(err instanceof LimitExceededError);
          assert.equal((err as LimitExceededError).code, 'LIMIT_EXCEEDED');
          return true;
        }
      );
    });

    await t.test('withdrawal under limits → allowed', async () => {
      await query(`UPDATE system_parameter SET param_value = '100000.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
      await query(`UPDATE system_parameter SET param_value = '200000.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`);
      const accounts = await query(`SELECT account_id FROM account LIMIT 1`);
      const accountId = accounts[0]?.account_id;
      if (!accountId) return;

      await assert.doesNotReject(() => checkWithdrawalLimits(accountId, '500.00'));
    });

    await t.test('limits are read from system_parameter, not hardcoded', async () => {
      await query(`UPDATE system_parameter SET param_value = '1.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
      const accounts = await query(`SELECT account_id FROM account LIMIT 1`);
      const accountId = accounts[0]?.account_id;
      if (!accountId) return;

      // Even 2.00 should exceed limit of 1.00, proving it's not hardcoded
      await assert.rejects(
        () => checkWithdrawalLimits(accountId, '2.00'),
        (err: unknown) => err instanceof LimitExceededError
      );
    });
  } finally {
    // Restore original parameter values
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [origStart]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [origEnd]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`, [origSingle]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT'`, [origDaily]);
  }
});
