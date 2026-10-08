import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P03-M04-T01: Reference Number & Idempotency Indexes', async (t) => {
  // Fetch existing seeded dependencies to satisfy FKs
  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM' LIMIT 1`);

  const userId = userRes[0].user_id;
  const channelId = channelRes[0].channel_id;

  const ts = Date.now();
  // account is protected by fail-closed RLS (P02-M01): read/insert under an ADMIN context.
  const accountId = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const existing = await tx.query('SELECT account_id FROM account LIMIT 1');
    if (existing.rows.length > 0) return existing.rows[0].account_id;
    const plan = await tx.query('SELECT plan_id FROM savings_plan LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance)
      VALUES ($1, $2, $3, $4, 1000.00)
      RETURNING account_id;
    `, [`ACC-TEST-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    return created.rows[0].account_id;
  });

  await t.test('1. fn_next_transaction_reference() produces unique sequential values', async () => {
    const res1 = await query('SELECT fn_next_transaction_reference() AS ref');
    const res2 = await query('SELECT fn_next_transaction_reference() AS ref');

    const ref1 = res1[0].ref;
    const ref2 = res2[0].ref;

    assert.ok(ref1);
    assert.ok(ref2);
    assert.notEqual(ref1, ref2);
    assert.match(ref1, /^TXN-\d{8}-\d{8}$/);
    assert.match(ref2, /^TXN-\d{8}-\d{8}$/);
  });

  await t.test('2. Duplicate reference_number is rejected (23505)', async () => {
    const uniqueRef = `TXN-DUP-${ts}`;
    await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, narration)
      VALUES ($1, $2, $3, $4, 'DEPOSIT', 50.00, 'First deposit with ref')
    `, [accountId, userId, channelId, uniqueRef]);

    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, narration)
        VALUES ($1, $2, $3, $4, 'DEPOSIT', 75.00, 'Duplicate ref deposit')
      `, [accountId, userId, channelId, uniqueRef]),
      (err) => err.code === '23505' || err.sqlstate === '23505'
    );
  });

  await t.test('3. NULL reference_number is rejected (23502)', async () => {
    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
        VALUES ($1, $2, $3, NULL, 'DEPOSIT', 50.00)
      `, [accountId, userId, channelId]),
      (err) => err.code === '23502' || err.sqlstate === '23502'
    );
  });

  await t.test('4. Duplicate idempotency_key is rejected (23505 on ux_transaction_idempotency)', async () => {
    const idemKey = `idem-${ts}-single`;
    const refA = `TXN-IDEM-A-${ts}`;
    const refB = `TXN-IDEM-B-${ts}`;

    await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
      VALUES ($1, $2, $3, $4, 'DEPOSIT', 25.00, $5)
    `, [accountId, userId, channelId, refA, idemKey]);

    await assert.rejects(
      query(`
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
        VALUES ($1, $2, $3, $4, 'DEPOSIT', 25.00, $5)
      `, [accountId, userId, channelId, refB, idemKey]),
      (err) => err.code === '23505' || err.sqlstate === '23505'
    );
  });

  await t.test('5. Two transactions with idempotency_key IS NULL both succeed', async () => {
    const refNull1 = `TXN-NULL-1-${ts}`;
    const refNull2 = `TXN-NULL-2-${ts}`;

    const res1 = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
      VALUES ($1, $2, $3, $4, 'INTEREST_CREDIT', 10.00, NULL)
      RETURNING transaction_id;
    `, [accountId, userId, channelId, refNull1]);

    const res2 = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
      VALUES ($1, $2, $3, $4, 'INTEREST_CREDIT', 15.00, NULL)
      RETURNING transaction_id;
    `, [accountId, userId, channelId, refNull2]);

    assert.ok(res1[0].transaction_id);
    assert.ok(res2[0].transaction_id);
  });

  await t.test('6. Two transactions with distinct idempotency_keys both succeed', async () => {
    const key1 = `key-1-${ts}`;
    const key2 = `key-2-${ts}`;
    const refDistinct1 = `TXN-DIST-1-${ts}`;
    const refDistinct2 = `TXN-DIST-2-${ts}`;

    const res1 = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
      VALUES ($1, $2, $3, $4, 'DEPOSIT', 30.00, $5)
      RETURNING transaction_id;
    `, [accountId, userId, channelId, refDistinct1, key1]);

    const res2 = await query(`
      INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
      VALUES ($1, $2, $3, $4, 'DEPOSIT', 40.00, $5)
      RETURNING transaction_id;
    `, [accountId, userId, channelId, refDistinct2, key2]);

    assert.ok(res1[0].transaction_id);
    assert.ok(res2[0].transaction_id);
  });
});
