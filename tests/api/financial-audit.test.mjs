/**
 * tests/api/financial-audit.test.mjs
 * P03-M01-T03 — Financial operation audit writers
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireDisposableDatabase, pool } from '../helpers/customer-relations.mjs';
import { randomUUID } from 'node:crypto';

const {
  auditDeposit,
  auditWithdrawal,
  auditRejectedWithdrawal,
  auditReversal,
  auditInterestCredit,
} = await import('../../services/audit-service.ts');

describe('P03-M01-T03: Financial Audit Service Writers', () => {
  let client;
  let userId;
  
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    
    // Setup a dummy user for the user_id foreign key constraint
    userId = randomUUID();
    const roleId = (await client.query("SELECT role_id FROM role LIMIT 1")).rows[0].role_id;
    await client.query(
      "INSERT INTO app_user (user_id, username, password_hash, role_id) VALUES ($1, $2, 'hash', $3)",
      [userId, `audit_test_${userId.slice(0, 8)}`, roleId]
    );
  });

  after(async () => {
    await client.query("DELETE FROM app_user WHERE user_id = $1", [userId]);
    client.release();
    await pool.end();
  });

  test('auditDeposit writes an audit event with DEPOSIT action', async () => {
    await client.query('BEGIN');
    try {
      const transactionId = randomUUID();
      const accountId = randomUUID();
      
      await auditDeposit({
        userId,
        accountId,
        transactionId,
        amount: "150.00",
        balanceAfter: "1150.00",
        ipAddress: "127.0.0.1",
      }, client);

      const res = await client.query("SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'DEPOSIT'", [transactionId]);
      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.actor_type, 'USER');
      assert.equal(row.entity_type, 'transaction');
      assert.equal(row.new_values.amount, "150.00");
      assert.equal(row.new_values.balance_after, "1150.00");
    } finally {
      await client.query('ROLLBACK');
    }
  });

  test('auditWithdrawal writes an audit event with WITHDRAWAL action', async () => {
    await client.query('BEGIN');
    try {
      const transactionId = randomUUID();
      const accountId = randomUUID();
      
      await auditWithdrawal({
        userId,
        accountId,
        transactionId,
        amount: "50.00",
        balanceAfter: "1100.00",
      }, client);

      const res = await client.query("SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'WITHDRAWAL'", [transactionId]);
      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.actor_type, 'USER');
      assert.equal(row.entity_type, 'transaction');
      assert.equal(row.new_values.amount, "50.00");
    } finally {
      await client.query('ROLLBACK');
    }
  });

  test('auditRejectedWithdrawal writes an audit event but no ledger row (simulated)', async () => {
    await client.query('BEGIN');
    try {
      const accountId = randomUUID();
      
      await auditRejectedWithdrawal({
        userId,
        accountId,
        amount: "500000.00",
        reason: "INSUFFICIENT_FUNDS",
      }, client);

      const res = await client.query("SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'REJECTED_WITHDRAWAL'", [accountId]);
      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.entity_type, 'account');
      assert.equal(row.new_values.rejection_reason, "INSUFFICIENT_FUNDS");
    } finally {
      await client.query('ROLLBACK');
    }
  });

  test('auditReversal writes an audit event with reason', async () => {
    await client.query('BEGIN');
    try {
      const transactionId = randomUUID();
      const originalTransactionId = randomUUID();
      
      await auditReversal({
        userId,
        reversalTransactionId: transactionId,
        originalTransactionId,
        reason: "Teller error",
      }, client);

      const res = await client.query("SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'REVERSAL'", [transactionId]);
      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.entity_type, 'transaction');
      assert.equal(row.new_values.reason, "Teller error");
    } finally {
      await client.query('ROLLBACK');
    }
  });

  test('auditInterestCredit writes an event with actor_type SYSTEM', async () => {
    await client.query('BEGIN');
    try {
      const transactionId = randomUUID();
      const accountId = randomUUID();
      
      await auditInterestCredit({
        accountId,
        transactionId,
        amount: "15.00",
        balanceAfter: "1015.00",
      }, client);

      const res = await client.query("SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'INTEREST_CREDIT'", [transactionId]);
      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.user_id, null);
      assert.equal(row.actor_type, 'SYSTEM');
      assert.equal(row.entity_type, 'transaction');
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
