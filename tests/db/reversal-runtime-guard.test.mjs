import {after,before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fdFixture,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {setRlsContext} from '../../lib/db/rls-context.ts';
describe('G-27: direct SQL reversal actor and control-row backstops',()=>{
  let client,fixture;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);fixture=await fdFixture(client);});
  after(async()=>{client?.release();await pool.end();});
  async function runtime(role,user,work){await client.query('BEGIN');try{
    await client.query('SET LOCAL ROLE mims_app');await setRlsContext(client,{roleName:role,userId:user,branchId:fixture.branchId});return await work();
  }finally{await client.query('ROLLBACK');}}
  test('legacy and keyed entry both reject non-managers and forged manager context before looking up a transaction',async()=>{
    for(const [role,user] of [['AGENT',fixture.agentId],['ADMIN',fixture.adminId],['BRANCH_MANAGER',fixture.agentId]]){
      for(const sql of ['CALL sp_reverse_transaction($1,$2,$3,NULL,NULL,NULL)',
        "CALL sp_reverse_transaction_controlled($1,$2,$3,'SQL-guard',NULL,NULL,NULL)"])
        await assert.rejects(runtime(role,user,()=>client.query(sql,[randomUUID(),'Synthetic',user])),e=>e.code==='42501');
    }
  });
  test('agent cannot fabricate a reversal control link using raw INSERT',async()=>{
    const ids=[];
    for(let i=0;i<2;i++)ids.push((await client.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount)
      SELECT $1,$2,channel_id,$3,'DEPOSIT',1 FROM transaction_channel WHERE channel_name='BRANCH_COUNTER' RETURNING transaction_id`,
      [fixture.ownAccount.account_id,fixture.agentId,'RAW-'+randomUUID()])).rows[0].transaction_id);
    await assert.rejects(runtime('AGENT',fixture.agentId,()=>client.query('INSERT INTO transaction_reversal(original_transaction_id,reversal_transaction_id,reason,reversed_by_user_id) VALUES($1,$2,$3,$4)',[...ids,'Synthetic',fixture.agentId])),e=>e.code==='42501');
  });
});
