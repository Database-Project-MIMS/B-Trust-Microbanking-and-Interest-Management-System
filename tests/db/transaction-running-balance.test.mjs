import test from 'node:test';
import assert from 'node:assert/strict';
import { query, withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

test('P04-M04-T02: Transaction running balance is monotonic', async (t) => {
  const ts = Date.now();
  const userRes = await query("SELECT u.user_id FROM app_user u JOIN role r ON r.role_id=u.role_id WHERE r.role_name='ADMIN' AND u.status='ACTIVE' AND r.status='ACTIVE' LIMIT 1");
  const userId = userRes[0].user_id;

  const channelRes = await query(`SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1`);
  const channelId = channelRes[0].channel_id;

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
  const { accountId, customerId } = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
    const plan = await tx.query('SELECT plan_id, min_balance FROM savings_plan WHERE max_holders = 1 LIMIT 1');
    const branch = await tx.query('SELECT branch_id FROM branch LIMIT 1');
    const agent = await tx.query('SELECT agent_id FROM agent LIMIT 1');
    
    const cust = await tx.query(`
      INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
      VALUES ($1, $2, $3, 'Test Customer Run', '1990-01-01', '123 Test St', $4)
      RETURNING customer_id;
    `, [`CUST-R-${ts}`, `NIC-R-${ts}`, `test-r-${ts}@example.com`, branch.rows[0].branch_id]);
    const cId = cust.rows[0].customer_id;
    
    const created = await tx.query(`
      INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 50000.00)
      RETURNING account_id;
    `, [`ACC-RUN-${ts}`, plan.rows[0].plan_id, branch.rows[0].branch_id, agent.rows[0].agent_id]);
    const aId = created.rows[0].account_id;
    
    await tx.query(`
      INSERT INTO account_holder (account_id, customer_id, holder_type)
      VALUES ($1, $2, 'PRIMARY')
    `, [aId, cId]);
    
    return { accountId: aId, customerId: cId };
  });

  const dummyFdId = '00000000-0000-0000-0000-000000000000';

  async function callPostDeposit(client, aId, amount) {
    const res = await client.query(`CALL sp_post_deposit($1, $2, $3, $4, $5, 'Dep', NULL, NULL, NULL, NULL);`,
      [aId, amount, channelId, userId, 'idem-d-' + Date.now() + Math.random()]
    );
    return res.rows[0];
  }

  async function callPostWithdrawal(client, aId, amount, reqCustId) {
    const res = await client.query(`CALL sp_post_withdrawal($1::uuid, $2::numeric, $3::uuid, $4::uuid, $5::uuid, $6::varchar, 'W/d', NULL, NULL, NULL, NULL);`,
      [aId, amount, channelId, userId, reqCustId, 'idem-w-' + Date.now() + Math.random()]
    );
    return res.rows[0];
  }

  async function callPostInterest(client, aId, amount) {
    const res = await client.query(`CALL sp_post_interest_credit($1, $2, $3, $4, NULL, NULL, NULL);`,
      [aId, amount, dummyFdId, '2026-10-01']
    );
    return res.rows[0];
  }

  try {
    await t.test('1. Execute a sequence of deposit, withdrawal, interest credit, and check monotonicity', async () => {
      // 1. Deposit 5,000
      await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        await callPostDeposit(tx, accountId, '5000.00');
      });

      // 2. Withdrawal 2,000
      await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        await callPostWithdrawal(tx, accountId, '2000.00', customerId);
      });

      // 3. Interest Credit 150
      await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        await callPostInterest(tx, accountId, '150.00');
      });
      
      // 4. Another Deposit 1,000
      await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId, branchId: null, roleName: 'ADMIN' });
        await callPostDeposit(tx, accountId, '1000.00');
      });

      // Fetch all ledger rows for this account ordered by created_at or transaction_id
      const rows = await withTransaction(async tx=>{
        await setRlsContext(tx,{userId,branchId:null,roleName:'ADMIN'});
        return (await tx.query(`SELECT transaction_type,amount,balance_after FROM transaction
          WHERE account_id=$1 ORDER BY ledger_seq`,[accountId])).rows;
      });

      assert.equal(rows.length, 4, 'Should have exactly 4 ledger rows');

      assert.deepEqual(rows.map(row=>[row.transaction_type,row.amount,row.balance_after]),[
        ['DEPOSIT','5000.00','55000.00'],['WITHDRAWAL','2000.00','53000.00'],
        ['INTEREST_CREDIT','150.00','53150.00'],['DEPOSIT','1000.00','54150.00'],
      ]);
    });
  } finally {
    // Revert settings
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [origStart]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [origEnd]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'SINGLE_WITHDRAWAL_LIMIT'`, [origSingleLimit]);
    await query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'DAILY_WITHDRAWAL_LIMIT'`, [origDailyLimit]);
    
    // Cleanup omitted because test runner leaves test DB alone
  }
});
