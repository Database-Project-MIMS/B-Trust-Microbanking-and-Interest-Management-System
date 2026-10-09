import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fdFixture,pool,requireDisposableDatabase,financialSnapshot} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {POST} from '../../app/api/transactions/[id]/reverse/route.ts';

describe('G-27: real manager-only reversal API and durable key control',()=>{
  let client,fixture,restore,original;
  const csrf=randomBytes(32).toString('hex');
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);restore=useCustomerRuntime(pool);});
  beforeEach(async()=>{
    fixture=await fdFixture(client);
    original=(await client.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,
      reference_number,transaction_type,amount,balance_after,agent_id,branch_id)
      SELECT $1,$2,channel_id,$3,'DEPOSIT',100,123456.78,$2,$4 FROM transaction_channel
      WHERE channel_name='BRANCH_COUNTER' RETURNING transaction_id`,
      [fixture.ownAccount.account_id,fixture.agentId,'REV-'+randomUUID(),fixture.branchId])).rows[0].transaction_id;
  });
  after(async()=>{await restore?.();client?.release();await pool.end();});
  function request(role='manager',key='REV-'+randomUUID(),body={reason:'Synthetic correction'},id=original,csrfValue=csrf){
    return new NextRequest('http://localhost/api/transactions/'+id+'/reverse',{method:'POST',
      headers:{cookie:`mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,'x-csrf-token':csrfValue,
        'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)});
  }
  test('manager gets real control UUID, exact balance and same-key replay without another effect',async()=>{
    const key='REV-'+randomUUID();
    const first=await POST(request('manager',key));assert.equal(first.status,201,await first.clone().text());
    const data=(await first.json()).data;assert.match(data.reversalId,/^[a-f0-9-]{36}$/);
    assert.equal(data.balanceAfter,'123356.78');
    const snapshot=await financialSnapshot(client);
    const replay=await POST(request('manager',key));assert.equal(replay.status,201);
    assert.deepEqual((await replay.json()).data,data);assert.deepEqual(await financialSnapshot(client),snapshot);
    for(const req of [request('manager',key,{reason:'Changed request'}),request()]){
      assert.equal((await POST(req)).status,409);assert.deepEqual(await financialSnapshot(client),snapshot);
    }
  });
  test('concurrent identical keys return one compensating entry and one control row',async()=>{
    const key='REV-'+randomUUID();const responses=await Promise.all([POST(request('manager',key)),POST(request('manager',key))]);
    assert.ok(responses.every(response=>response.status===201));
    const rows=await Promise.all(responses.map(response=>response.json()));assert.deepEqual(rows[0].data,rows[1].data);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM transaction_reversal WHERE original_transaction_id=$1',[original])).rows[0].n,1);
  });
  test('ADMIN/agent/auditor/customer, cross-branch, CSRF, malformed UUID and missing key are rejected without effects',async()=>{
    const snapshot=await financialSnapshot(client);
    const denied=[...['admin','agent','auditor','customer'].map(role=>request(role)),request('otherManager'),
      request('manager',''),request('manager',undefined,undefined,original,''),request('manager',undefined,undefined,'bad-uuid')];
    for(const req of denied){const response=await POST(req);assert.ok([400,403,404].includes(response.status),await response.clone().text());
      assert.deepEqual(await financialSnapshot(client),snapshot);}
  });
  test('reversal overdraft rejects the complete operation',async()=>{
    await client.query('UPDATE account SET current_balance=1 WHERE account_id=$1',[fixture.ownAccount.account_id]);
    const snapshot=await financialSnapshot(client);assert.equal((await POST(request())).status,409);
    assert.deepEqual(await financialSnapshot(client),snapshot);
  });
});
