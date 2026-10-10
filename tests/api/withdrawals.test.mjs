import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fdFixture,pool,requireDisposableDatabase,financialSnapshot} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {POST} from '../../app/api/transactions/withdrawals/route.ts';

describe('G-28: real withdrawal API identity, signer evidence and committed rejection audit',()=>{
  let client,fixture,restore,channel,parameters,calendar,today;
  const csrf=randomBytes(32).toString('hex');
  before(async()=>{
    client=await pool.connect();await requireDisposableDatabase(client);
    parameters=(await client.query("SELECT param_key,param_value FROM system_parameter WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')")).rows;
    today=(await client.query("SELECT (now() AT TIME ZONE 'Asia/Colombo')::date::text AS today")).rows[0].today;
    calendar=(await client.query('SELECT is_business_day,open_time::text,close_time::text FROM business_calendar WHERE calendar_date=$1',[today])).rows[0];
    await client.query("UPDATE system_parameter SET param_value=CASE param_key WHEN 'BUSINESS_HOUR_START' THEN '00:00' ELSE '23:59:59.999999' END WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')");
    await client.query('INSERT INTO business_calendar(calendar_date,is_business_day) VALUES($1,true) ON CONFLICT(calendar_date) DO UPDATE SET is_business_day=true,open_time=NULL,close_time=NULL',[today]);
    channel=(await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'")).rows[0].channel_id;
    restore=useCustomerRuntime(pool);
  });
  beforeEach(async()=>{
    fixture=await fdFixture(client);
    await client.query("INSERT INTO joint_mandate(account_id,mandate_type,required_signatories) VALUES($1,'ALL_HOLDERS',2)",[fixture.jointAccount.account_id]);
  });
  after(async()=>{
    await restore?.();
    if(client){
      for(const row of parameters??[])await client.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2',[row.param_value,row.param_key]);
      if(calendar)await client.query('UPDATE business_calendar SET is_business_day=$1,open_time=$2,close_time=$3 WHERE calendar_date=$4',[calendar.is_business_day,calendar.open_time,calendar.close_time,today]);
      else if(today)await client.query('DELETE FROM business_calendar WHERE calendar_date=$1',[today]);
      client.release();
    }
    await pool.end();
  });
  function request(role='customer',extra={},key='WDR-'+randomUUID(),csrfValue=csrf){
    return new NextRequest('http://localhost/api/transactions/withdrawals',{method:'POST',
      headers:{cookie:`mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,'x-csrf-token':csrfValue,
        'content-type':'application/json','idempotency-key':key},
      body:JSON.stringify({accountId:fixture.ownAccount.account_id,amount:'100.00',channelId:channel,...extra})});
  }
  async function success(req,status=201){
    const response=await POST(req);assert.equal(response.status,status,await response.clone().text());return (await response.json()).data;
  }
  test('customer uses linked customer UUID, gets exact balance and replays without another effect',async()=>{
    assert.notEqual(fixture.customerId,fixture.customerLoginId);
    const key='WDR-'+randomUUID();const data=await success(request('customer',{},key));
    assert.equal(data.balanceAfter,'123356.78');assert.match(data.transactionId,/^[a-f0-9-]{36}$/);
    const snapshot=await financialSnapshot(client);
    assert.deepEqual(await success(request('customer',{},key),200),data);
    assert.equal((await POST(request('customer',{amount:'101.00'},key))).status,409);
    assert.deepEqual(await financialSnapshot(client),snapshot);
  });
  test('agent single-holder attestation and manager ALL_HOLDERS array both post',async()=>{
    await success(request('agent',{onBehalfOfCustomerId:fixture.customerId}));
    const data=await success(request('manager',{accountId:fixture.jointAccount.account_id,signerCustomerIds:[fixture.secondCustomerId,fixture.customerId]}));
    assert.equal(data.balanceAfter,'123356.78');
    const audit=(await client.query("SELECT new_values->'signer_customer_ids' AS signers FROM audit_log WHERE entity_id=$1 AND action='WITHDRAWAL'",[data.transactionId])).rows[0];
    assert.deepEqual(audit.signers,[fixture.customerId,fixture.secondCustomerId].sort());
  });
  test('missing, ambiguous, forged, cross-branch and unauthorized requests have no financial or audit effect',async()=>{
    const snapshot=await financialSnapshot(client);
    const denied=[request('agent'),request('customer',{onBehalfOfCustomerId:fixture.customerLoginId}),
      request('customer',{signerCustomerIds:[fixture.customerId,fixture.secondCustomerId]}),
      request('manager',{onBehalfOfCustomerId:fixture.customerId,signerCustomerIds:[fixture.customerId]}),
      request('otherManager',{onBehalfOfCustomerId:fixture.customerId}),
      request('second',{onBehalfOfCustomerId:fixture.customerId}),request('customer',{accountId:fixture.otherAccount.account_id}),request('admin'),request('auditor'),
      request('customer',{},''),request('customer',{},undefined,''),request('customer',{extra:'unknown'})];
    for(const req of denied){const response=await POST(req);assert.ok([400,403,404].includes(response.status),await response.clone().text());
      assert.deepEqual(await financialSnapshot(client),snapshot);}
  });
  test('known financial rejection commits one audit with no balance or ledger change',async()=>{
    await client.query('UPDATE account SET current_balance=1 WHERE account_id=$1',[fixture.ownAccount.account_id]);
    const snapshot=await financialSnapshot(client);const response=await POST(request());
    assert.equal(response.status,409);assert.equal((await response.json()).error.code,'INSUFFICIENT_FUNDS');
    const after=await financialSnapshot(client);assert.equal(after.audit,snapshot.audit+1);
    assert.deepEqual({...after,audit:snapshot.audit},snapshot);
    const audit=(await client.query("SELECT new_values->>'reason' AS reason,user_id FROM audit_log WHERE entity_id=$1 AND action='WITHDRAWAL_REJECTED'",[fixture.ownAccount.account_id])).rows;
    assert.deepEqual(audit,[{reason:'INSUFFICIENT_FUNDS',user_id:fixture.customerLoginId}]);
  });
  test('foreign or incomplete signer evidence rejects mandate and preserves one rejection audit per attempt',async()=>{
    const snapshot=await financialSnapshot(client);
    for(const signers of [[fixture.customerId],[fixture.customerId,fixture.otherCustomerId]]){
      const response=await POST(request('manager',{accountId:fixture.jointAccount.account_id,signerCustomerIds:signers}));
      assert.equal(response.status,409);assert.equal((await response.json()).error.code,'MANDATE_NOT_SATISFIED');
    }
    const after=await financialSnapshot(client);assert.equal(after.audit,snapshot.audit+2);
    assert.deepEqual({...after,audit:snapshot.audit},snapshot);
  });
  test('direct customer balance UPDATE is denied and forged wrapper signer/actor calls fail',async()=>{
    const snapshot=await financialSnapshot(client);
    await client.query('BEGIN');
    try{
      await client.query('SET LOCAL ROLE mims_app');
      await client.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_user_role','CUSTOMER',true),set_config('app.current_branch_id','',true)",[fixture.customerLoginId]);
      assert.equal((await client.query('UPDATE account SET current_balance=2 WHERE account_id=$1',[fixture.ownAccount.account_id])).rowCount,0);
      for(const [actor,signers] of [[fixture.customerLoginId,[fixture.secondCustomerId]],[fixture.agentId,[fixture.customerId]]]){
        await client.query('SAVEPOINT denied_wrapper');
        await assert.rejects(client.query('CALL sp_try_customer_withdrawal($1,100,$2,$3,$4::uuid[],$5,NULL,NULL,NULL,NULL,NULL,NULL)',
          [fixture.ownAccount.account_id,channel,actor,signers,'WDR-'+randomUUID()]),error=>error.code==='42501');
        await client.query('ROLLBACK TO SAVEPOINT denied_wrapper');
      }
    }finally{await client.query('ROLLBACK');}
    assert.deepEqual(await financialSnapshot(client),snapshot);
  });
  test('unexpected posting audit failure rolls back the ledger and balance',async()=>{
    const snapshot=await financialSnapshot(client);
    await client.query(`CREATE FUNCTION test_withdrawal_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='WITHDRAWAL' THEN
      RAISE EXCEPTION 'Synthetic unexpected audit failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$`);
    await client.query('CREATE TRIGGER test_withdrawal_audit_fault BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_withdrawal_audit_fault()');
    try{assert.equal((await POST(request())).status,500);assert.deepEqual(await financialSnapshot(client),snapshot);}
    finally{await client.query('DROP TRIGGER test_withdrawal_audit_fault ON audit_log');await client.query('DROP FUNCTION test_withdrawal_audit_fault()');}
  });
});
