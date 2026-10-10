import {after,before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fdFixture,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {setRlsContext} from '../../lib/db/rls-context.ts';

describe('P06-M02-T03: controlled FD entry cannot bypass financial guards',()=>{
  let client,fixture,account,channel;
  before(async()=>{
    client=await pool.connect();await requireDisposableDatabase(client);fixture=await fdFixture(client);
    account=await fixture.account([fixture.customerId]);
    channel=(await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'")).rows[0].channel_id;
  });
  after(async()=>{client?.release();await pool.end();});
  async function runtime(role,user,work){
    await client.query('BEGIN');
    try{await client.query('SET LOCAL ROLE mims_app');await setRlsContext(client,{roleName:role,userId:user,branchId:fixture.branchId});return await work();}
    finally{await client.query('ROLLBACK');}
  }
  const open=(amount,user=fixture.agentId)=>client.query('SELECT sp_open_fd_controlled($1,$2,$3,$4,$5) AS id',[account.account_id,fixture.planId,amount,user,channel]);
  test('minimum principal and insufficient funds reject direct SQL and retain the original balance',async()=>{
    for(const amount of ['0.01','999999.99'])await assert.rejects(runtime('AGENT',fixture.agentId,()=>open(amount)),e=>e.code==='P0001');
    assert.equal((await client.query('SELECT current_balance FROM account WHERE account_id=$1',[account.account_id])).rows[0].current_balance,'123456.78');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM fixed_deposit WHERE account_id=$1',[account.account_id])).rows[0].n,0);
  });
  test('read-only roles and mismatched posting identities cannot invoke the controlled operation',async()=>{
    await assert.rejects(runtime('AUDITOR',fixture.auditorId,()=>open('100000.00',fixture.auditorId)),e=>e.code==='42501');
    await assert.rejects(runtime('AGENT',fixture.agentId,()=>open('100000.00',fixture.secondAgentId)),e=>e.code==='42501');
  });
  test('runtime control cannot overwrite principal or the opening-rate snapshot',async()=>{
    for(const column of ['principal_amount','interest_rate_at_opening']){
      await assert.rejects(runtime('CENTRAL_OPS',fixture.centralId,()=>client.query(
        `UPDATE fixed_deposit SET ${column}=1 WHERE fd_id=$1`,[fixture.activeId])),e=>e.code==='42501');
    }
  });
  test('receipt uniqueness and payload hash constraints reject direct duplicate or malformed controls',async()=>{
    const key='DB-'+randomUUID();
    await client.query('BEGIN');
    try{
      await client.query('INSERT INTO fd_opening_request(actor_user_id,idempotency_key,payload_hash,fd_id) VALUES($1,$2,$3,$4)',[fixture.agentId,key,'a'.repeat(64),fixture.activeId]);
      for(const [hash,expected] of [['a'.repeat(64),'23505'],['bad','23514']]){
        await client.query('SAVEPOINT expected_failure');
        await assert.rejects(client.query('INSERT INTO fd_opening_request(actor_user_id,idempotency_key,payload_hash,fd_id) VALUES($1,$2,$3,$4)',[fixture.agentId,key,hash,fixture.activeId]),e=>e.code===expected);
        await client.query('ROLLBACK TO SAVEPOINT expected_failure');
      }
    }finally{await client.query('ROLLBACK');}
  });
});
