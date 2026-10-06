import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../lib/db/index.ts';

test('P02-M04-T01: Transaction Schema & Immutability', async (t) => {
  // Fetch existing seeded dependencies to satisfy FKs
  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM' LIMIT 1`);
  const accountRes = await query('SELECT account_id FROM account LIMIT 1');

  const userId = userRes[0].user_id;
  const channelId = channelRes[0].channel_id;

  const ts = Date.now();
  let accountId;

  if (!accountRes || accountRes.length === 0) {
    const planRes = await query('SELECT plan_id FROM savings_plan LIMIT 1');
    const branchRes = await query('SELECT branch_id FROM branch LIMIT 1');
    const agentRes = await query('SELECT agent_id FROM agent LIMIT 1');
    const newAcct = await query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance)
      VALUES ($1, $2, $3, $4, 1000.00)
      RETURNING account_id;
    `, [`ACC-TEST-${ts}`, planRes[0].plan_id, branchRes[0].branch_id, agentRes[0].agent_id]);
    accountId = newAcct[0].account_id;
  } else {
    accountId = accountRes[0].account_id;
  }

  let validTxnId;

  await t.test('1. Insert valid transaction with amount > 0', async () => {
    const res = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, narration)
      VALUES ($1, $2, $3, $4, 'DEPOSIT', 100.00, 'Test Deposit')
      RETURNING transaction_id;
    `, [accountId, userId, channelId, `TXN-${ts}-1`]);
    validTxnId = res[0].transaction_id;
    assert.ok(validTxnId);
  });

  await t.test('2. amount <= 0 is rejected', async () => {
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, $4, 'DEPOSIT', 0)
      `, [accountId, userId, channelId, `TXN-${ts}-2`]),
      (err) => err.code === '23514' || err.sqlstate === '23514'
    );
  });

  await t.test('3. Invalid transaction_type is rejected', async () => {
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, $4, 'REFUND', 100.00)
      `, [accountId, userId, channelId, `TXN-${ts}-3`]),
      (err) => err.code === '23514' || err.sqlstate === '23514'
    );
  });

  await t.test('4. UPDATE is rejected by role permission or trigger', async () => {
    await assert.rejects(
      query(`UPDATE transaction SET amount = 200.00 WHERE transaction_id = $1`, [validTxnId]),
      (err) =>
        err.code === '42501' ||
        err.sqlstate === '42501' ||
        ((err.code === 'P0001' || err.sqlstate === 'P0001') && err.message?.includes('TRANSACTION_IMMUTABLE'))
    );
  });

  await t.test('5. DELETE is rejected by role permission or trigger', async () => {
    await assert.rejects(
      query(`DELETE FROM transaction WHERE transaction_id = $1`, [validTxnId]),
      (err) =>
        err.code === '42501' ||
        err.sqlstate === '42501' ||
        ((err.code === 'P0001' || err.sqlstate === 'P0001') && err.message?.includes('TRANSACTION_IMMUTABLE'))
    );
  });

  await t.test('6. Non-existent FK is rejected (23503)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, $4, 'DEPOSIT', 100.00)
      `, [fakeId, userId, channelId, `TXN-${ts}-4`]),
      (err) => err.code === '23503' || err.sqlstate === '23503'
    );
  });

  await t.test('7. Deleting referenced transaction_channel is rejected', async () => {
    await assert.rejects(
      query(`DELETE FROM transaction_channel WHERE channel_id = $1`, [channelId]),
      (err) => err.code === '42501' || err.sqlstate === '42501' || err.code === '23503' || err.sqlstate === '23503'
    );
  });
});
