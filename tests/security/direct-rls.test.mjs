import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fdFixture,pool,requireDisposableDatabase } from '../helpers/customer-fixed-deposits.mjs';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';
import { setRlsContext } from '../../lib/db/rls-context.ts';

describe('P06-M01-T03: direct login as mims_app bypasses every service', () => {
  let owner, runtime, fixture, ids;
  before(async () => {
    owner = await pool.connect(); await requireDisposableDatabase(owner);
    fixture = await fdFixture(owner);
    ids = [];
    for (const account of [fixture.ownAccount,fixture.otherAccount]) {
      ids.push((await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,
        reference_number,transaction_type,amount,balance_after)
        SELECT $1,$2,channel_id,$3,'DEPOSIT',1,123456.78 FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'
        RETURNING transaction_id`,[account.account_id,fixture.agentId,`RLS-${randomUUID()}`])).rows[0].transaction_id);
    }
    // Authenticate using the runtime URL itself, not SET ROLE from an owner login.
    const url = new URL(process.env.DATABASE_MIGRATION_URL);
    url.username = 'mims_app';
    runtime = createMigrationClient(url.href); await runtime.connect();
    const role = (await runtime.query(`SELECT current_user AS name,rolsuper,rolbypassrls
      FROM pg_roles WHERE rolname=current_user`)).rows[0];
    assert.deepEqual(role,{ name:'mims_app',rolsuper:false,rolbypassrls:false });
  });
  after(async () => { await runtime?.end(); owner?.release(); await pool.end(); });
  async function scope(roleName, branchId, userId, work) {
    await runtime.query('BEGIN');
    try { await setRlsContext(runtime,{roleName:roleName ?? '',branchId:branchId ?? null,userId:userId ?? ''}); return await work(); }
    finally { await runtime.query('ROLLBACK'); }
  }
  async function visible() {
    return {
      customers:(await runtime.query('SELECT customer_id FROM customer WHERE customer_id=ANY($1::uuid[]) ORDER BY customer_id',[[fixture.customerId,fixture.otherCustomerId]])).rows.length,
      accounts:(await runtime.query('SELECT account_id FROM account WHERE account_id=ANY($1::uuid[])',[[fixture.ownAccount.account_id,fixture.otherAccount.account_id]])).rows.length,
      ledger:(await runtime.query('SELECT transaction_id FROM transaction WHERE transaction_id=ANY($1::uuid[])',[ids])).rows.length,
    };
  }
  test('customer, account and transaction RLS is enabled and runtime owns none',async () => {
    const rows=(await runtime.query(`SELECT relname,relrowsecurity,pg_get_userbyid(relowner) AS owner
      FROM pg_class WHERE oid=ANY(ARRAY['customer'::regclass,'account'::regclass,'transaction'::regclass])`)).rows;
    assert.equal(rows.length,3); for(const row of rows){assert.equal(row.relrowsecurity,true);assert.notEqual(row.owner,'mims_app');}
  });
  for(const role of ['AGENT','BRANCH_MANAGER']) test(`${role} sees one branch only`,async () => {
    assert.deepEqual(await scope(role,fixture.branchId,fixture.agentId,visible),{customers:1,accounts:1,ledger:1});
    await scope(role,fixture.branchId,fixture.agentId,async () => {
      assert.equal((await runtime.query('SELECT transaction_id FROM transaction WHERE transaction_id=$1',[ids[1]])).rowCount,0);
    });
  });
  for(const [role,userId] of [['ADMIN','adminId'],['CENTRAL_OPS','centralId'],['AUDITOR','auditorId']])
    test(`${role} legitimately reads both branches`,async()=>{
      assert.deepEqual(await scope(role,null,fixture[userId],visible),{customers:2,accounts:2,ledger:2});
    });
  test('missing context and branch fail closed; context cannot survive transaction reuse',async()=>{
    assert.deepEqual(await scope(null,null,null,visible),{customers:0,accounts:0,ledger:0});
    assert.deepEqual(await scope('AGENT',null,fixture.agentId,visible),{customers:0,accounts:0,ledger:0});
    assert.deepEqual(await visible(),{customers:0,accounts:0,ledger:0});
  });
  test('CUSTOMER sees only held-account ledger; SYSTEM context alone sees none',async()=>{
    assert.deepEqual(await scope('CUSTOMER',null,fixture.customerLoginId,visible),{customers:1,accounts:1,ledger:1});
    assert.deepEqual(await scope('SYSTEM',null,null,visible),{customers:0,accounts:0,ledger:0});
  });
  test('AUDITOR cannot insert ledger and runtime cannot update/delete posted rows or bypass RLS',async()=>{
    for(const statement of ['UPDATE transaction SET narration=$1 WHERE transaction_id=$2',
      'DELETE FROM transaction WHERE transaction_id=$1',
      'ALTER TABLE transaction DISABLE ROW LEVEL SECURITY']){
      await scope('AUDITOR',null,fixture.auditorId,async()=>{
        await assert.rejects(runtime.query(statement,statement.startsWith('ALTER')?[]:statement.startsWith('DELETE')?[ids[0]]:['Synthetic',ids[0]]),e=>e.code==='42501');
      });
    }
    await scope('AUDITOR',null,fixture.auditorId,async()=>{
      await assert.rejects(runtime.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,
        reference_number,transaction_type,amount) SELECT $1,$2,channel_id,$3,'DEPOSIT',1
        FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'`,[fixture.ownAccount.account_id,fixture.auditorId,`RLS-${randomUUID()}`]),e=>e.code==='42501');
    });
  });
});
