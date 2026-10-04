import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../lib/db/index.ts';

test('P02-M04-T01: Transaction Schema & Immutability', async (t) => {
  // Fetch existing seeded dependencies to satisfy FKs
  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM' LIMIT 1`);
  const accountRes = await query('SELECT account_id FROM account LIMIT 1');

  if (accountRes.rows.length === 0) {
    throw new Error('Test aborted: No account seed data found. Ensure P02-M03-T01 is fully merged and seeded.');
  }

  const userId = userRes.rows[0].user_id;
  const channelId = channelRes.rows[0].channel_id;
  const accountId = accountRes.rows[0].account_id;

  let validTxnId;

  await t.test('1. Insert valid transaction with amount > 0', async () => {
    const res = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, narration)
      VALUES ($1, $2, $3, 'TXN-001', 'DEPOSIT', 100.00, 'Test Deposit')
      RETURNING transaction_id;
    `, [accountId, userId, channelId]);
    validTxnId = res.rows[0].transaction_id;
    assert.ok(validTxnId);
  });

  await t.test('2. amount <= 0 is rejected', async () => {
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, 'TXN-002', 'DEPOSIT', 0)
      `, [accountId, userId, channelId]),
      (err) => err.code === '23514' // Check constraint violation
    );
  });

  await t.test('3. Invalid transaction_type is rejected', async () => {
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, 'TXN-003', 'REFUND', 100.00)
      `, [accountId, userId, channelId]),
      (err) => err.code === '23514'
    );
  });

  await t.test('4. UPDATE is rejected by the trigger', async () => {
    await assert.rejects(
      query(`UPDATE transaction SET amount = 200.00 WHERE transaction_id = $1`, [validTxnId]),
      (err) => err.code === 'P0001' && err.message.includes('TRANSACTION_IMMUTABLE')
    );
  });

  await t.test('5. DELETE is rejected by the trigger', async () => {
    await assert.rejects(
      query(`DELETE FROM transaction WHERE transaction_id = $1`, [validTxnId]),
      (err) => err.code === 'P0001' && err.message.includes('TRANSACTION_IMMUTABLE')
    );
  });

  await t.test('6. Non-existent FK is rejected (23503)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, 'TXN-004', 'DEPOSIT', 100.00)
      `, [fakeId, userId, channelId]),
      (err) => err.code === '23503'
    );
  });

  await t.test('7. Deleting referenced transaction_channel is rejected', async () => {
    await assert.rejects(
      query(`DELETE FROM transaction_channel WHERE channel_id = $1`, [channelId]),
      (err) => err.code === '23503'
    );
  });
});