import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, createFixture, requireDisposableDatabase } from '../helpers/customer-relations.mjs';
import { randomUUID } from 'node:crypto';
import { setRlsContext } from '../../lib/db/rls-context.ts';
import {
  auditDeposit, auditWithdrawal, auditRejectedWithdrawal, auditReversal
} from '../../services/audit-service.ts';

test('P03-M01-T03: Financial Audit Event Helpers', async (t) => {
  const client = await pool.connect();
  await requireDisposableDatabase(client);
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.current_user_role', 'ADMIN', true)");
    const fixture = await createFixture(client);
    const userId = await fixture.staff('ADMIN');
    await setRlsContext(client, { userId, branchId: null, roleName: 'ADMIN' });
    const { rows: plans } = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name='Adult'");
    const { rows: accounts } = await client.query(
      "INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance) VALUES ($1,$2,$3,$4,0) RETURNING account_id",
      ['AUD-' + randomUUID(), plans[0].plan_id, fixture.branchId, fixture.agentId]);
    const accountId = accounts[0].account_id;
    const fakeTransactionId = randomUUID();
    const fakeReversalId = randomUUID();
    const ipAddress = '127.0.0.1';
    const query = async (sql, params) => (await client.query(sql, params)).rows;
    const withTransaction = async operation => operation(client);

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
      `SELECT action, new_values FROM audit_log WHERE action = 'REJECTED_WITHDRAWAL' AND entity_id = $1`,
      [accountId]
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

  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
