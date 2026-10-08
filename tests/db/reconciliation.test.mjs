import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, requireDisposableDatabase, createFixture } from '../helpers/customer-relations.mjs';

describe('P05-M04-T03: Reconciliation Views (D-1, D-2)', () => {
  let client, fixture, accountId;

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    fixture = await createFixture(client);
    
    // Create an account
    accountId = (await client.query(
      `INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id)
       SELECT $1, plan_id, $2, $3 FROM savings_plan WHERE plan_name = 'Children' RETURNING account_id`,
      [`ACT-${randomUUID().slice(0, 8)}`, fixture.branchId, fixture.agentId]
    )).rows[0].account_id;

    const channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM'")).rows[0].channel_id;
    const adminId = await fixture.staff('ADMIN');

    let currentBalance = 0;

    async function insertTx({ amount, type, date = '2026-09-01T12:00:00Z', isReversal = false, origTxId = null }) {
      const numAmount = parseFloat(amount);
      if (type === 'DEPOSIT' || type === 'INTEREST_CREDIT') {
        currentBalance += numAmount;
      } else if (type === 'WITHDRAWAL') {
        currentBalance -= numAmount;
      } else if (type === 'REVERSAL') {
        // Find original type to compute running balance correctly
        const res = await client.query('SELECT transaction_type FROM transaction WHERE transaction_id = $1', [origTxId]);
        const origType = res.rows[0].transaction_type;
        if (origType === 'DEPOSIT' || origType === 'INTEREST_CREDIT') {
          currentBalance -= numAmount;
        } else {
          currentBalance += numAmount;
        }
      }
      
      const txId = (await client.query(
        `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
           transaction_type, amount, transaction_date, agent_id, branch_id, balance_after)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING transaction_id`,
        [accountId, adminId, channelId, `ACT-${randomUUID()}`, type, amount, date, fixture.agentId, fixture.branchId, currentBalance.toFixed(2)]
      )).rows[0].transaction_id;

      if (isReversal && origTxId) {
        await client.query(
          `INSERT INTO transaction_reversal (original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id)
           VALUES ($1, $2, 'test', $3)`,
          [origTxId, txId, adminId]
        );
      }

      await client.query(
        `UPDATE account SET current_balance = $1 WHERE account_id = $2`,
        [currentBalance.toFixed(2), accountId]
      );

      return txId;
    }

    // Insert sequence:
    // Deposit 100
    const t1 = await insertTx({ amount: '100.00', type: 'DEPOSIT', date: '2026-09-01T10:00:00Z' });
    // Withdrawal 20
    const t2 = await insertTx({ amount: '20.00', type: 'WITHDRAWAL', date: '2026-09-01T11:00:00Z' });
    // Deposit 50
    const t3 = await insertTx({ amount: '50.00', type: 'DEPOSIT', date: '2026-09-01T12:00:00Z' });
    // Reversal of Deposit 50
    const t4 = await insertTx({ amount: '50.00', type: 'REVERSAL', date: '2026-09-01T13:00:00Z', isReversal: true, origTxId: t3 });
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  after(async () => {
    client?.release();
    await pool.end();
  });

  test('vw_reconciliation_balance.discrepancy = 0 for correctly seeded sequence', async () => {
    const { rows } = await client.query('SELECT discrepancy FROM vw_reconciliation_balance WHERE account_id = $1', [accountId]);
    assert.equal(rows.length, 1);
    assert.equal(parseFloat(rows[0].discrepancy), 0);
  });

  test('stored_balance_after matches computed_running_balance in vw_reconciliation_running_balance', async () => {
    const { rows } = await client.query('SELECT stored_balance_after, computed_running_balance FROM vw_reconciliation_running_balance WHERE account_id = $1', [accountId]);
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(parseFloat(row.stored_balance_after), parseFloat(row.computed_running_balance));
    }
  });

  test('Deliberately corrupting current_balance correctly reports a non-zero discrepancy', async () => {
    // Deliberately corrupt
    await client.query('UPDATE account SET current_balance = current_balance + 99.99 WHERE account_id = $1', [accountId]);

    const { rows } = await client.query('SELECT discrepancy FROM vw_reconciliation_balance WHERE account_id = $1', [accountId]);
    assert.equal(rows.length, 1);
    assert.equal(parseFloat(rows[0].discrepancy), 99.99);
  });
});
