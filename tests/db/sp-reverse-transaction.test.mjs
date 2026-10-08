import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P03-M04-T04: sp_reverse_transaction', async (t) => {
  const userRes = await query("SELECT u.user_id FROM app_user u JOIN role r ON r.role_id=u.role_id WHERE r.role_name='ADMIN' AND u.status='ACTIVE' AND r.status='ACTIVE' LIMIT 1");
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1`);

  const userId = userRes[0].user_id;
  const channelId = channelRes[0].channel_id;

  const ts = Date.now();

  const origStartRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
  const origEndRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
  const origStart = origStartRes[0]?.param_value || '08:30';
  const origEnd = origEndRes[0]?.param_value || '17:00';

  await query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
  await query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);

  // Setup one active account
  const { accountId, customerId } = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id, min_balance FROM savings_plan WHERE max_holders = 1 LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    
    const cust = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer Rev', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-R-${ts}`, `NIC-R-${ts}`, `test-r-${ts}@example.com`, branch.rows[0].branch_id]);
    const cid = cust.rows[0].customer_id;
    
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 5000.00)
      RETURNING account_id;
    `, [`ACC-REV-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    const aid = created.rows[0].account_id;
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'PRIMARY')
    `, [aid, cid]);
    
    return { accountId: aid, customerId: cid };
  });

  async function postDeposit(amount, idemKey) {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query(`CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`, 
        [accountId, amount, channelId, userId, idemKey, 'Dep']);
      return res.rows[0];
    });
  }

  async function postWithdrawal(amount, idemKey) {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query(`CALL sp_post_withdrawal($1::uuid, $2::numeric, $3::uuid, $4::uuid, $5::uuid, $6::varchar, $7::varchar, NULL, NULL, NULL, NULL)`,
        [accountId, amount, channelId, userId, customerId, idemKey, 'Wth']);
      return res.rows[0];
    });
  }

  async function reverseTransaction(txnId, reason = 'Mistake') {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query(`CALL sp_reverse_transaction($1, $2, $3, NULL, NULL, NULL)`, 
        [txnId, reason, userId]);
      return res.rows[0];
    });
  }

  async function getAccountBalance(accId) {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [accId]);
      return Number(res.rows[0].current_balance);
    });
  }

  async function getTransaction(txnId) {
    return await withTransaction(async (tx) => {
      await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
      const res = await tx.query('SELECT * FROM transaction WHERE transaction_id = $1', [txnId]);
      return res.rows[0];
    });
  }

  try {
    await t.test('1. Reversing a valid POSTED deposit creates a compensating REVERSAL row and restores balance', async () => {
      const dep = await postDeposit('1000.00', `dep1-${ts}`);
      const depTxn = await getTransaction(dep.p_transaction_id);
      
      const rev = await reverseTransaction(dep.p_transaction_id);
      const revTxn = await getTransaction(rev.p_reversal_transaction_id);
      
      assert.equal(revTxn.transaction_type, 'REVERSAL');
      assert.equal(Number(revTxn.amount), 1000.00);
      assert.equal(Number(revTxn.balance_after), Number(depTxn.balance_after) - 1000.00);

      const bal = await getAccountBalance(accountId);
      assert.equal(bal, Number(revTxn.balance_after));
    });

    await t.test('2. Reversing a valid POSTED withdrawal restores the withdrawn amount', async () => {
      const wth = await postWithdrawal('500.00', `wth1-${ts}`);
      const wthTxn = await getTransaction(wth.p_transaction_id);
      
      const rev = await reverseTransaction(wth.p_transaction_id);
      const revTxn = await getTransaction(rev.p_reversal_transaction_id);
      
      assert.equal(revTxn.transaction_type, 'REVERSAL');
      assert.equal(Number(revTxn.amount), 500.00);
      assert.equal(Number(revTxn.balance_after), Number(wthTxn.balance_after) + 500.00);

      const bal = await getAccountBalance(accountId);
      assert.equal(bal, Number(revTxn.balance_after));
    });

    await t.test('3. The original transaction row is never modified', async () => {
      const dep = await postDeposit('300.00', `dep2-${ts}`);
      const before = await getTransaction(dep.p_transaction_id);
      
      await reverseTransaction(dep.p_transaction_id);
      
      const after = await getTransaction(dep.p_transaction_id);
      assert.deepEqual(before, after);
    });

    await t.test('4. Reversing an already-reversed transaction -> ALREADY_REVERSED', async () => {
      const dep = await postDeposit('200.00', `dep3-${ts}`);
      await reverseTransaction(dep.p_transaction_id);
      
      await assert.rejects(
        reverseTransaction(dep.p_transaction_id),
        (err) => err.message?.includes('ALREADY_REVERSED')
      );
    });

    await t.test('5. A second transaction_reversal row is rejected by UNIQUE constraint', async () => {
      const dep = await postDeposit('150.00', `dep4-${ts}`);
      const rev = await reverseTransaction(dep.p_transaction_id);
      
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await tx.query(`INSERT INTO transaction_reversal (original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id) VALUES ($1, $2, 'force', $3)`, [dep.p_transaction_id, rev.p_reversal_transaction_id, userId]);
        }),
        (err) => err.code === 'UNIQUE_VIOLATION' || err.constraint === 'ux_transaction_reversal_original' || err.constraint === 'transaction_reversal_original_transaction_id_key'
      );
    });

    await t.test('6. Reversing a non-existent transaction ID -> clean error', async () => {
      await assert.rejects(
        reverseTransaction('123e4567-e89b-12d3-a456-426614174000'),
        (err) => err.message?.includes('TRANSACTION_NOT_FOUND')
      );
    });

  } finally {
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [origStart]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [origEnd]);
  }
});
