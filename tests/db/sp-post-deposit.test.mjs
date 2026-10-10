import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P03-M04-T02: sp_post_deposit routine', async (t) => {
  // Fetch existing seeded dependencies to satisfy FKs
  const userRes = await query("SELECT u.user_id FROM app_user u JOIN role r ON r.role_id=u.role_id WHERE r.role_name='ADMIN' LIMIT 1");
  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1`);

  const userId = userRes[0].user_id;
  const channelId = channelRes[0].channel_id;

  const ts = Date.now();

  // Ensure current time is within business hours via system_parameter (mims_app has UPDATE on system_parameter)
  const origStartRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
  const origEndRes = await query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
  const origStart = origStartRes[0]?.param_value || '08:30';
  const origEnd = origEndRes[0]?.param_value || '17:00';

  await query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
  await query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);

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
    `, [`ACC-DEP-ACT-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    return created.rows[0].account_id;
  });

  // Create a frozen account
  const frozenAccountId = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id FROM savings_plan LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'FROZEN', 500.00)
      RETURNING account_id;
    `, [`ACC-DEP-FRZ-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    return created.rows[0].account_id;
  });

  // Helper to call sp_post_deposit
  async function callPostDeposit(client, {
    accountId = activeAccountId,
    amount = '250.00',
    chnId = channelId,
    usrId = userId,
    idemKey = null,
    narration = 'Test Deposit'
  }) {
    const res = await client.query(`
      CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL);
    `, [accountId, amount, chnId, usrId, idemKey, narration]);
    return res.rows[0];
  }

  try {
    await t.test('1. Valid deposit posts, balance_after and account.current_balance agree exactly', async () => {
      const postRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostDeposit(tx, {
          accountId: activeAccountId,
          amount: '200.00',
          narration: 'First deposit'
        });
      });

      assert.ok(postRes.p_transaction_id);
      assert.ok(postRes.p_reference_number);
      assert.equal(Number(postRes.p_balance_after), 1200.00);

      const [acc] = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        const res = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
        return res.rows;
      });
      assert.equal(Number(acc.current_balance), 1200.00);

      // Verify ledger row exists with balance_after
      const [txn] = await withTransaction(async tx=>{await setRlsContext(tx,{userId,branchId:null,roleName:'ADMIN'});return (await tx.query('SELECT amount,balance_after,transaction_type FROM transaction WHERE transaction_id=$1',[postRes.p_transaction_id])).rows;});
      assert.equal(Number(txn.amount), 200.00);
      assert.equal(Number(txn.balance_after), 1200.00);
      assert.equal(txn.transaction_type, 'DEPOSIT');

      // Verify audit log row
      const [audit] = await query(`
        SELECT action, new_values FROM audit_log
        WHERE entity_id = $1 AND entity_type = 'transaction'
      `, [postRes.p_transaction_id]);
      assert.ok(audit);
      assert.equal(audit.action, 'DEPOSIT');
      assert.equal(Number(audit.new_values.balance_after), 1200.00);
    });

    await t.test('2. Depositing into a FROZEN or CLOSED account is rejected (ACCOUNT_NOT_ACTIVE)', async () => {
      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostDeposit(tx, {
            accountId: frozenAccountId,
            amount: '100.00'
          });
        }),
        (err) => err.message?.includes('ACCOUNT_NOT_ACTIVE') || err.constraint === 'ck_deposit_account_active'
      );

      // Assert no transaction row created for frozen account
      const txns = await query('SELECT * FROM transaction WHERE account_id = $1', [frozenAccountId]);
      assert.equal(txns.length, 0);
    });

    await t.test('3. Repeating same idempotency_key returns original transaction, no duplicate credit', async () => {
      const idemKey = `idem-dep-${ts}`;

      const firstPost = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostDeposit(tx, {
          accountId: activeAccountId,
          amount: '300.00',
          idemKey,
          narration: 'Idempotent deposit run'
        });
      });

      const secondPost = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostDeposit(tx, {
          accountId: activeAccountId,
          amount: '300.00',
          idemKey,
          narration: 'Idempotent deposit run'
        });
      });

      // Must return the exact same transaction id, reference, and balance_after
      assert.equal(secondPost.p_transaction_id, firstPost.p_transaction_id);
      assert.equal(secondPost.p_reference_number, firstPost.p_reference_number);
      assert.equal(Number(secondPost.p_balance_after), Number(firstPost.p_balance_after));

      // Assert balance is credited only ONCE (1200 + 300 = 1500)
      const [acc] = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        const res = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
        return res.rows;
      });
      assert.equal(Number(acc.current_balance), 1500.00);

      // Exactly 1 transaction row for this key
      const ledgerRows = await withTransaction(async tx=>{await setRlsContext(tx,{userId,branchId:null,roleName:'ADMIN'});return (await tx.query('SELECT transaction_id FROM transaction WHERE idempotency_key=$1',[idemKey])).rows;});
      assert.equal(ledgerRows.length, 1);
    });

    await t.test('4. Two deposits with idempotency_key IS NULL post independently', async () => {
      const resA = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostDeposit(tx, {
          accountId: activeAccountId,
          amount: '50.00',
          idemKey: null
        });
      });

      const resB = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        return await callPostDeposit(tx, {
          accountId: activeAccountId,
          amount: '75.00',
          idemKey: null
        });
      });

      assert.notEqual(resA.p_transaction_id, resB.p_transaction_id);
      assert.notEqual(resA.p_reference_number, resB.p_reference_number);
      assert.equal(Number(resA.p_balance_after), 1550.00);
      assert.equal(Number(resB.p_balance_after), 1625.00);
    });

    await t.test('5. Deposit outside business hours is rejected (OUTSIDE_BUSINESS_HOURS)', async () => {
      // Simulate closed hours by setting BUSINESS_HOUR_START & END to a past minute
      await query(`UPDATE system_parameter SET param_value = '01:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
      await query(`UPDATE system_parameter SET param_value = '01:01' WHERE param_key = 'BUSINESS_HOUR_END'`);

      try {
        await assert.rejects(
          withTransaction(async (tx) => {
            await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
            await callPostDeposit(tx, {
              accountId: activeAccountId,
              amount: '100.00'
            });
          }),
          (err) => err.message?.includes('OUTSIDE_BUSINESS_HOURS') || err.constraint === 'ck_deposit_business_hours'
        );
      } finally {
        // Restore all-day open hours for remaining assertions
        await query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
        await query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);
      }
    });

    await t.test('6. Atomicity: failure during transaction rolls back both ledger and account balance', async () => {
      const balanceBefore = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        const res = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
        return Number(res.rows[0].current_balance);
      });

      await assert.rejects(
        withTransaction(async (tx) => {
          await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
          await callPostDeposit(tx, {
            accountId: activeAccountId,
            amount: '100.00',
            narration: 'Atomic rollback deposit'
          });
          // Intentionally throw inside transaction boundary
          throw new Error('SIMULATED_FAILURE_AFTER_DEPOSIT');
        }),
        (err) => err.message === 'SIMULATED_FAILURE_AFTER_DEPOSIT'
      );

      const balanceAfter = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        const res = await tx.query('SELECT current_balance FROM account WHERE account_id = $1', [activeAccountId]);
        return Number(res.rows[0].current_balance);
      });

      assert.equal(balanceAfter, balanceBefore);

      const abortedTxns = await query(`
        SELECT * FROM transaction
        WHERE account_id = $1 AND narration = 'Atomic rollback deposit'
      `, [activeAccountId]);
      assert.equal(abortedTxns.length, 0);
    });
  } finally {
    // Restore original parameters
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [origStart]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [origEnd]);
  }
});
