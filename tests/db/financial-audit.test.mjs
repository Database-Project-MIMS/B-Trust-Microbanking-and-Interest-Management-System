import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction, pool } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';
import {
  auditDeposit, auditWithdrawal, auditRejectedWithdrawal, auditReversal
} from '../../services/audit-service.ts';

test('P03-M01-T03: Financial Audit Event Helpers', async (t) => {
  // Get a user and account for testing
  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const accountRes = await query('SELECT account_id FROM account LIMIT 1');

  const userId = userRes[0].user_id;
  const accountId = accountRes[0].account_id;
  const fakeTransactionId = '00000000-0000-0000-0000-c0ffee000001';
  const fakeReversalId = '00000000-0000-0000-0000-c0ffee000002';
  const ipAddress = '127.0.0.1';

  // Clean up any audit rows created by this test
  const cleanup = async () => {
    await query(
      `DELETE FROM audit_log WHERE ip_address = $1 AND entity_type = 'transaction'
         AND action IN ('DEPOSIT', 'WITHDRAWAL', 'REJECTED_WITHDRAWAL', 'REVERSAL')`,
      [ipAddress]
    );
  };
  await cleanup();

  await t.test('Deposit creates DEPOSIT audit event with amount and balance_after', async () => {
    await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      await auditDeposit({ userId, accountId, transactionId: fakeTransactionId, amount: '500.00', balanceAfter: '1500.00', ipAddress }, tx);
    });

    const rows = await query(
      `SELECT action, new_values FROM audit_log WHERE entity_id = $1 AND action = 'DEPOSIT'`,
      [fakeTransactionId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'DEPOSIT');
    const vals = rows[0].new_values;
    assert.equal(vals.amount, '500.00');
    assert.equal(vals.balance_after, '1500.00');
  });

  await t.test('Withdrawal creates WITHDRAWAL audit event', async () => {
    await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      await auditWithdrawal({ userId, accountId, transactionId: fakeTransactionId, amount: '200.00', balanceAfter: '1300.00', ipAddress }, tx);
    });

    const rows = await query(
      `SELECT action, new_values FROM audit_log WHERE entity_id = $1 AND action = 'WITHDRAWAL'`,
      [fakeTransactionId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'WITHDRAWAL');
    assert.equal(rows[0].new_values.amount, '200.00');
  });

  await t.test('Rejected withdrawal creates REJECTED_WITHDRAWAL event with NO ledger row', async () => {
    const countBefore = (await query(`SELECT count(*)::int AS n FROM transaction WHERE account_id = $1`, [accountId]))[0].n;

    await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      await auditRejectedWithdrawal({ userId, accountId, amount: '9999.00', reason: 'LIMIT_EXCEEDED', ipAddress }, tx);
    });

    // Audit log row must exist
    const auditRows = await query(
      `SELECT action, new_values FROM audit_log WHERE action = 'REJECTED_WITHDRAWAL' AND ip_address = $1`,
      [ipAddress]
    );
    assert.ok(auditRows.length >= 1);
    assert.equal(auditRows[0].action, 'REJECTED_WITHDRAWAL');
    assert.equal(auditRows[0].new_values.rejection_reason, 'LIMIT_EXCEEDED');

    // NO ledger row should have been added (FR-WD-05)
    const countAfter = (await query(`SELECT count(*)::int AS n FROM transaction WHERE account_id = $1`, [accountId]))[0].n;
    assert.equal(countAfter, countBefore);
  });

  await t.test('Reversal creates REVERSAL audit event with original transaction ID and reason', async () => {
    await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      await auditReversal({ userId, originalTransactionId: fakeTransactionId, reversalTransactionId: fakeReversalId, reason: 'Customer requested', ipAddress }, tx);
    });

    const rows = await query(
      `SELECT action, new_values FROM audit_log WHERE entity_id = $1 AND action = 'REVERSAL'`,
      [fakeReversalId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].new_values.original_transaction_id, fakeTransactionId);
    assert.equal(rows[0].new_values.reason, 'Customer requested');
  });

  await cleanup();
  await pool.end();
});
