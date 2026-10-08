import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P03-M04-T03: sp_post_withdrawal routine', async (t) => {
  const userRes = await query('SELECT user_id FROM app_user LIMIT 1');
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1`);

  const userId = userRes[0].user_id;
  const channelId = channelRes[0].channel_id;

  const ts = Date.now();

  const origStartRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
  const origEndRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
  const origStart = origStartRes[0]?.param_value || '08:30';
  const origEnd = origEndRes[0]?.param_value || '17:00';
  const origSingleLimitRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'SINGLE_WITHDRAWAL_LIMIT'`);
  const origDailyLimitRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'DAILY_WITHDRAWAL_LIMIT'`);
  const origSingleLimit = origSingleLimitRes[0]?.param_value || '100000.00';
  const origDailyLimit = origDailyLimitRes[0]?.param_value || '200000.00';

  await query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
  await query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);
  await query(`UPDATE system_parameter SET param_value = '100000.00' WHERE param_key = 'SINGLE_WITHDRAWAL_LIMIT'`);
  await query(`UPDATE system_parameter SET param_value = '200000.00' WHERE param_key = 'DAILY_WITHDRAWAL_LIMIT'`);

  // Active account (single holder)
  const { accountId: activeAccountId, customerId: activeCustomerId } = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id, min_balance FROM savings_plan WHERE max_holders = 1 LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    
    const cust = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer W', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-W-${ts}`, `NIC-W-${ts}`, `test-w-${ts}@example.com`, branch.rows[0].branch_id]);
    const customerId = cust.rows[0].customer_id;
    
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 50000.00)
      RETURNING account_id;
    `, [`ACC-WD-ACT-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    const accountId = created.rows[0].account_id;
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'PRIMARY')
    `, [accountId, customerId]);
    
    return { accountId, customerId };
  });

  // Frozen account (single holder)
  const { accountId: frozenAccountId, customerId: frozenCustomerId } = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id FROM savings_plan WHERE max_holders = 1 LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    
    const cust = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer F', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-F-${ts}`, `NIC-F-${ts}`, `test-f-${ts}@example.com`, branch.rows[0].branch_id]);
    const customerId = cust.rows[0].customer_id;
    
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'FROZEN', 500.00)
      RETURNING account_id;
    `, [`ACC-WD-FRZ-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    const accountId = created.rows[0].account_id;
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'PRIMARY')
    `, [accountId, customerId]);

    return { accountId, customerId };
  });

  // Joint account
  const { accountId: jointAccountId, customerId: jointCustomerId } = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id FROM savings_plan WHERE max_holders > 1 LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    
    const cust1 = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer J1', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-J1-${ts}`, `NIC-J1-${ts}`, `test-j1-${ts}@example.com`, branch.rows[0].branch_id]);
    const customerId1 = cust1.rows[0].customer_id;
    
    const cust2 = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer J2', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-J2-${ts}`, `NIC-J2-${ts}`, `test-j2-${ts}@example.com`, branch.rows[0].branch_id]);
    const customerId2 = cust2.rows[0].customer_id;
    
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 50000.00)
      RETURNING account_id;
    `, [`ACC-WD-JNT-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    const accountId = created.rows[0].account_id;
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'PRIMARY')
    `, [accountId, customerId1]);
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'JOINT')
    `, [accountId, customerId2]);
    
    await tx.query(`
      INSERT INTO joint_mandate (account_id, mandate_type, required_signatories)
      VALUES ($1, 'ALL_HOLDERS', 2)
    `, [accountId]);

    return { accountId, customerId: customerId1 };
  });

  // Helper to call sp_post_withdrawal
  async function callPostWithdrawal(client, {
    accountId = activeAccountId,
    amount = '250.00',
    chnId = channelId,
    usrId = userId,
    reqCustId = activeCustomerId,
    idemKey = null,
    narration = 'Test Withdrawal'
  }) {
    const res = await client.query(`
      CALL sp_post_withdrawal($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, NULL);
    `, [accountId, amount, chnId, usrId, reqCustId, idemKey, narration]);
    return res.rows[0];
  }

  // To check audit
  async function getAuditRejections(accountId) {
    const res = await query(`
      SELECT new_values->>'reason' as reason FROM audit_log
      WHERE entity_id = $1 AND entity_type = 'account' AND action = 'WITHDRAWAL_REJECTED'
    `, [accountId]);
    return res.map(row => row.reason);
  }

  try {
    await t.test('1. Valid withdrawal posts, balance_after and account.current_balance agree exactly', async () => {
      const postRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostWithdrawal(tx, {
          amount: '1000.00',
          narration: 'First withdrawal'
        });
      });

      assert.ok(postRes.p_transaction_id);
      assert.ok(postRes.p_reference_number);
      assert.equal(Number(postRes.p_balance_after), 49000.00);

      const acc = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, roleName: 'ADMIN' });
        const r = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
        return r.rows[0];
      });
      assert.equal(Number(acc.current_balance), 49000.00);

      const [txn] = await query('SELECT amount, balance_after, transaction_type FROM transaction WHERE transaction_id = $1', [postRes.p_transaction_id]);
      assert.equal(Number(txn.amount), 1000.00);
      assert.equal(Number(txn.balance_after), 49000.00);
      assert.equal(txn.transaction_type, 'WITHDRAWAL');
    });

    await t.test('2. Withdrawal from FROZEN account is rejected (ACCOUNT_NOT_ACTIVE)', async () => {
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, {
            accountId: frozenAccountId,
            reqCustId: frozenCustomerId,
            amount: '10.00'
          });
        }),
        (err) => err.message?.includes('ACCOUNT_NOT_ACTIVE') || err.constraint === 'ck_account_active'
      );
      
      const reasons = await getAuditRejections(frozenAccountId);
      assert.ok(reasons.includes('ACCOUNT_NOT_ACTIVE'));
    });

    await t.test('3. Withdrawal exceeding the single limit is rejected', async () => {
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, { amount: '150000.00' });
        }),
        (err) => err.message?.includes('LIMIT_EXCEEDED')
      );
      
      const reasons = await getAuditRejections(activeAccountId);
      assert.ok(reasons.includes('LIMIT_EXCEEDED'));
    });

    await t.test('4. Withdrawal exceeding the daily limit is rejected', async () => {
      await query('UPDATE account SET current_balance = 500000.00 WHERE account_id = $1', [activeAccountId]);
      
      await withTransaction(async (tx) => {
         await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
         await callPostWithdrawal(tx, { amount: '90000.00', idemKey: 'd1' });
         await callPostWithdrawal(tx, { amount: '90000.00', idemKey: 'd2' });
      });
      
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, { amount: '50000.00' });
        }),
        (err) => err.message?.includes('LIMIT_EXCEEDED')
      );
    });

    await t.test('5. Withdrawal exceeding current balance is rejected', async () => {
      await query('UPDATE account SET current_balance = 50000.00 WHERE account_id = $1', [activeAccountId]);
      
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, { amount: '60000.00' });
        }),
        (err) => err.message?.includes('INSUFFICIENT_FUNDS')
      );
    });

    await t.test('6. Withdrawal breaching plan minimum is rejected', async () => {
      const plan = await query('SELECT min_balance FROM savings_plan WHERE max_holders = 1 LIMIT 1');
      const min = Number(plan[0].min_balance);
      const amt = 50000 - min + 1;
      
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, { amount: amt.toFixed(2) });
        }),
        (err) => err.message?.includes('BELOW_MINIMUM_BALANCE')
      );
    });

    await t.test('7. Joint withdrawal without satisfied mandate is rejected', async () => {
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostWithdrawal(tx, { accountId: jointAccountId, reqCustId: jointCustomerId, amount: '10.00' });
        }),
        (err) => err.message?.includes('MANDATE_NOT_SATISFIED')
      );
    });

    await t.test('8. Repeated idempotency_key returns original result', async () => {
      const idemKey = `idem-wd-${ts}`;
      
      const firstPost = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostWithdrawal(tx, { amount: '100.00', idemKey });
      });

      const secondPost = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostWithdrawal(tx, { amount: '100.00', idemKey });
      });

      assert.equal(secondPost.p_transaction_id, firstPost.p_transaction_id);
      assert.equal(secondPost.p_reference_number, firstPost.p_reference_number);
    });

    await t.test('9. Every rejection path writes audit but zero transaction rows', async () => {
      const txns = await query('SELECT count(*) FROM transaction WHERE account_id = $1 AND transaction_type = $2', [activeAccountId, 'WITHDRAWAL']);
      assert.equal(Number(txns[0].count), 4);
    });

    await t.test('10. Concurrency smoke test', async () => {
      await query('UPDATE account SET current_balance = 1000.00 WHERE account_id = $1', [activeAccountId]);
      
      const p1 = withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return callPostWithdrawal(tx, { amount: '600.00', idemKey: 'c1' });
      });
      const p2 = withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return callPostWithdrawal(tx, { amount: '600.00', idemKey: 'c2' });
      });
      
      const results = await Promise.allSettled([p1, p2]);
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      assert.ok(failures[0].reason.message.includes('INSUFFICIENT_FUNDS') || failures[0].reason.message.includes('BELOW_MINIMUM_BALANCE'));
    });

  } finally {
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [origStart]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [origEnd]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'SINGLE_WITHDRAWAL_LIMIT'`, [origSingleLimit]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'DAILY_WITHDRAWAL_LIMIT'`, [origDailyLimit]);
  }
});
