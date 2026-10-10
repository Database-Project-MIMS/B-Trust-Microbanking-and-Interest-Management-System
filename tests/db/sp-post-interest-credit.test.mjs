import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P04-M04-T01: sp_post_interest_credit routine', async (t) => {
  const ts = Date.now();

  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const userId = userRes[0].user_id;

  // Create an active test account under ADMIN context
  const activeAccountId = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id FROM savings_plan LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 1000.00)
      RETURNING account_id;
    `, [`ACC-INT-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    return created.rows[0].account_id;
  });

  const dummyFdId = randomUUID(); // Distinct fixture identity across independently posted test credits.
  
  async function callPostInterest(client, accountId, amount, fdId, cycleDate) {
    const res = await client.query(`
      CALL sp_post_interest_credit($1, $2, $3, $4, NULL, NULL, NULL);
    `, [accountId, amount, fdId, cycleDate]);
    return res.rows[0];
  }

  async function adminQuery(text, params) {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query(text, params);
      return res.rows;
    });
  }

  try {
    await t.test('1. Valid interest credit posts, balance_after and account.current_balance agree exactly', async () => {
      const postRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostInterest(tx, activeAccountId, '50.00', dummyFdId, '2026-10-01');
      });

      assert.ok(postRes.p_transaction_id);
      assert.ok(postRes.p_reference_number);
      assert.equal(Number(postRes.p_balance_after), 1050.00);

      const [acc] = await adminQuery('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
      assert.equal(Number(acc.current_balance), 1050.00);

      const [txn] = await adminQuery('SELECT amount, balance_after, transaction_type, channel_id FROM transaction WHERE transaction_id = $1', [postRes.p_transaction_id]);
      assert.equal(Number(txn.amount), 50.00);
      assert.equal(Number(txn.balance_after), 1050.00);
      assert.equal(txn.transaction_type, 'INTEREST_CREDIT');

      // 2. channel_id is always the SYSTEM channel
      const [channel] = await adminQuery('SELECT channel_name FROM transaction_channel WHERE channel_id = $1', [txn.channel_id]);
      assert.equal(channel.channel_name, 'SYSTEM');

      // 3. audit_log.actor_type = 'SYSTEM'
      const [audit] = await adminQuery(`
        SELECT actor_type, new_values FROM audit_log
        WHERE entity_id = $1 AND entity_type = 'transaction'
      `, [postRes.p_transaction_id]);
      assert.ok(audit, 'Audit log row should exist');
      assert.equal(audit.actor_type, 'SYSTEM');
      assert.equal(audit.new_values.amount, 50.00);
      assert.equal(audit.new_values.cycle_date, '2026-10-01');
    });

    await t.test('4. The transaction is immutable exactly like any other row', async () => {
      const postRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostInterest(tx, activeAccountId, '10.00', randomUUID(), '2026-10-01');
      });

      await assert.rejects(
        adminQuery('UPDATE transaction SET amount = 20 WHERE transaction_id = $1', [postRes.p_transaction_id]),
        (err) => err.sqlstate === '42501' || err.sqlstate === 'P0001'
      );
    });

    await t.test('5. The same FD/cycle rejects a duplicate credit without a second balance effect', async () => {
      const fdId2 = randomUUID();
      const p1 = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostInterest(tx, activeAccountId, '5.00', fdId2, '2026-11-01');
      });
      await assert.rejects(withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostInterest(tx, activeAccountId, '5.00', fdId2, '2026-11-01');
      }), error => error.sqlstate === '23505');
      assert.ok(p1.p_transaction_id);

      const [acc] = await adminQuery('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
      // Started 1000, +50 (test1), +10 (test4), +5 (first attempt); replay rolls back.
      assert.equal(acc.current_balance, '1065.00');
    });

  } finally {
    // Cleanup
    const delRes = await query(`SELECT account_id FROM account WHERE account_number LIKE 'ACC-INT-%'`);
    if (delRes.length > 0) {
      const ids = delRes.map(r => `'${r.account_id}'`).join(',');
      await query('ALTER TABLE transaction DISABLE TRIGGER trg_financial_transaction_immutable');
      await query(`DELETE FROM transaction WHERE account_id IN (${ids})`);
      await query('ALTER TABLE transaction ENABLE TRIGGER trg_financial_transaction_immutable');
      await query(`DELETE FROM account WHERE account_id IN (${ids})`);
    }
  }
});
