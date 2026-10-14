import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fdFixture,pool,requireDisposableDatabase,financialSnapshot} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {POST as transfer} from '../../app/api/transactions/transfers/route.ts';
import {POST as deposit} from '../../app/api/transactions/deposits/route.ts';
import {POST as withdraw} from '../../app/api/transactions/withdrawals/route.ts';
import {GET as transaction} from '../../app/api/transactions/[id]/route.ts';
import {GET as account} from '../../app/api/accounts/[id]/route.ts';
import {getPostingChoices} from '../../services/transaction-service.ts';

describe('P06-M04-T03: owned-source customer transfers and Cash/Cheque methods',()=>{
  let owner,fixture,restore,hours,calendar,today;
  const csrf=randomBytes(32).toString('hex');
  before(async()=>{
    owner=await pool.connect();await requireDisposableDatabase(owner);
    hours=(await owner.query("SELECT param_key,param_value FROM system_parameter WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')")).rows;
    today=(await owner.query("SELECT (now() AT TIME ZONE 'Asia/Colombo')::date::text AS today")).rows[0].today;
    calendar=(await owner.query('SELECT is_business_day,open_time::text,close_time::text FROM business_calendar WHERE calendar_date=$1',[today])).rows[0];
    await owner.query("UPDATE system_parameter SET param_value=CASE param_key WHEN 'BUSINESS_HOUR_START' THEN '00:00' ELSE '23:59:59.999999' END WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')");
    await owner.query('INSERT INTO business_calendar(calendar_date,is_business_day) VALUES($1,true) ON CONFLICT(calendar_date) DO UPDATE SET is_business_day=true,open_time=NULL,close_time=NULL',[today]);
    restore=useCustomerRuntime(pool);
  });
  beforeEach(async()=>{fixture=await fdFixture(owner);});
  after(async()=>{
    await restore?.();
    if(owner){
      for(const row of hours??[])await owner.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2',[row.param_value,row.param_key]);
      if(calendar)await owner.query('UPDATE business_calendar SET is_business_day=$1,open_time=$2,close_time=$3 WHERE calendar_date=$4',[calendar.is_business_day,calendar.open_time,calendar.close_time,today]);
      else if(today)await owner.query('DELETE FROM business_calendar WHERE calendar_date=$1',[today]);
      owner.release();
    }
    await pool.end();
  });
  const body=()=>({sourceAccountId:fixture.ownAccount.account_id,destinationAccountNumber:fixture.otherAccount.account_number,amount:'12.34',narration:'Synthetic customer transfer'});
  function request(path,value,role='customer',key=randomUUID(),csrfValue=csrf){
    return new NextRequest('http://localhost'+path,{method:value===undefined?'GET':'POST',
      headers:{cookie:`mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,'content-type':'application/json','x-csrf-token':csrfValue,'idempotency-key':key},
      ...(value===undefined?{}:{body:JSON.stringify(value)})});
  }
  const send=(value=body(),role='customer',key=randomUUID())=>transfer(request('/api/transactions/transfers',value,role,key));
  test('cross-branch customer transfer commits equal legs and returns only owned financial information',async()=>{
    const response=await send();assert.equal(response.status,201,await response.clone().text());
    const receipt=(await response.json()).data;
    assert.deepEqual(Object.keys(receipt).sort(),['debitTransactionId','sourceBalance','transferGroupId']);
    assert.equal(receipt.sourceBalance,'123444.44');
    const legs=(await owner.query(`SELECT t.transaction_type,t.account_id,t.amount,t.balance_after,t.branch_id,c.channel_name
      FROM transaction t JOIN transaction_channel c USING(channel_id) WHERE transfer_group_id=$1 ORDER BY transaction_type`,[receipt.transferGroupId])).rows;
    assert.equal(legs.length,2);assert.equal(legs[0].amount,'12.34');assert.equal(legs[1].amount,'12.34');
    assert.equal(legs[0].balance_after,'123469.12');assert.equal(legs[0].branch_id,fixture.otherBranchId);
    assert.ok(legs.every(leg=>leg.channel_name==='ONLINE'));
    const credit=(await owner.query("SELECT transaction_id FROM transaction WHERE transfer_group_id=$1 AND transaction_type='TRANSFER_IN'",[receipt.transferGroupId])).rows[0].transaction_id;
    assert.equal((await transaction(request(`/api/transactions/${credit}`),{params:Promise.resolve({id:credit})})).status,404);
    assert.equal((await account(request(`/api/accounts/${fixture.otherAccount.account_id}`),{params:Promise.resolve({id:fixture.otherAccount.account_id})})).status,404);
  });
  test('concurrent identical requests have one effect; retry is payload bound',async()=>{
    const key=randomUUID(),value=body();
    const results=await Promise.all([send(value,'customer',key),send(value,'customer',key)]);
    assert.deepEqual(results.map(result=>result.status).sort(),[200,201]);
    assert.deepEqual(await results[0].json(),await results[1].json());
    const snapshot=await financialSnapshot(owner);
    for(const extra of [{amount:'13.00'},{narration:'Changed'},{destinationAccountNumber:fixture.jointAccount.account_number}]){
      assert.ok([403,409].includes((await send({...value,...extra},'customer',key)).status));
      assert.deepEqual(await financialSnapshot(owner),snapshot);
    }
  });
  test('distinct concurrent transfers cannot overspend a shared source account',async()=>{
    await owner.query('UPDATE account SET current_balance=50000 WHERE account_id=$1',[fixture.ownAccount.account_id]);
    const results=await Promise.all([send({...body(),amount:'30000.00'}),send({...body(),amount:'30000.00'})]);
    assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);
    const balances=(await owner.query('SELECT account_id,current_balance FROM account WHERE account_id IN($1,$2)',
      [fixture.ownAccount.account_id,fixture.otherAccount.account_id])).rows;
    assert.equal(balances.find(row=>row.account_id===fixture.ownAccount.account_id).current_balance,'20000.00');
    assert.equal(balances.find(row=>row.account_id===fixture.otherAccount.account_id).current_balance,'153456.78');
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM transaction WHERE account_id=$1 AND transaction_type='TRANSFER_OUT'",[fixture.ownAccount.account_id])).rows[0].n,1);
  });
  test('foreign source, own destination and asserted signers/actor cannot move money',async()=>{
    const snapshot=await financialSnapshot(owner);
    for(const extra of [{sourceAccountId:fixture.otherAccount.account_id},{sourceAccountId:randomUUID()},
      {destinationAccountNumber:fixture.ownAccount.account_number},{destinationAccountNumber:fixture.jointAccount.account_number},
      {signerCustomerIds:[fixture.customerId,fixture.secondCustomerId]},{actor:fixture.agentId},{destinationAccountId:fixture.otherAccount.account_id}]){
      assert.ok([400,403].includes((await send({...body(),...extra})).status));
      assert.deepEqual(await financialSnapshot(owner),snapshot);
    }
    assert.equal((await send({...body(),destinationAccountNumber:'missing-synthetic-recipient'})).status,404);
    assert.deepEqual(await financialSnapshot(owner),snapshot);
  });
  test('joint ANY_ONE permits self; ALL_HOLDERS never accepts forged approvals',async()=>{
    await owner.query("INSERT INTO joint_mandate(account_id,mandate_type,required_signatories) VALUES($1,'ANY_ONE',1)",[fixture.jointAccount.account_id]);
    assert.equal((await send({...body(),sourceAccountId:fixture.jointAccount.account_id})).status,201);
    await owner.query("UPDATE joint_mandate SET mandate_type='ALL_HOLDERS',required_signatories=2 WHERE account_id=$1",[fixture.jointAccount.account_id]);
    const snapshot=await financialSnapshot(owner);
    assert.equal((await send({...body(),sourceAccountId:fixture.jointAccount.account_id})).status,409);
    assert.deepEqual(await financialSnapshot(owner),snapshot);
  });
  test('frozen source/destination, insufficient funds and minimum balance reject atomically',async()=>{
    for(const [id,status] of [[fixture.ownAccount.account_id,'FROZEN'],[fixture.otherAccount.account_id,'FROZEN']]){
      await owner.query('UPDATE account SET status=$2 WHERE account_id=$1',[id,status]);const snapshot=await financialSnapshot(owner);
      assert.equal((await send()).status,409);assert.deepEqual(await financialSnapshot(owner),snapshot);
      await owner.query("UPDATE account SET status='ACTIVE' WHERE account_id=$1",[id]);
    }
    for(const balance of ['1.00','1005.00']){
      await owner.query('UPDATE account SET current_balance=$2 WHERE account_id=$1',[fixture.ownAccount.account_id,balance]);
      const snapshot=await financialSnapshot(owner);assert.equal((await send()).status,409);assert.deepEqual(await financialSnapshot(owner),snapshot);
    }
  });
  test('CSRF, missing keys, invalid amounts, legacy channels and unsupported methods fail closed',async()=>{
    const snapshot=await financialSnapshot(owner);
    assert.equal((await transfer(request('/api/transactions/transfers',body(),'customer',randomUUID(),''))).status,403);
    assert.equal((await send(body(),'customer','')).status,400);
    for(const amount of ['0.00','0.001','NaN','10000000000000.00'])assert.equal((await send({...body(),amount})).status,400);
    const posting={accountId:fixture.ownAccount.account_id,amount:'1.23'};
    for(const extra of [{method:'BRANCH_COUNTER'},{method:'ONLINE'},{method:'cash'},{method:'CARD'},{channelId:randomUUID()},{}]){
      assert.equal((await deposit(request('/api/transactions/deposits',{...posting,...extra},'manager'))).status,400);
      assert.equal((await withdraw(request('/api/transactions/withdrawals',{...posting,signerCustomerIds:[fixture.customerId],...extra},'manager'))).status,400);
    }
    assert.deepEqual(await financialSnapshot(owner),snapshot);
  });
  test('Cash and Cheque persist on deposits and withdrawals, including method-bound replay',async()=>{
    for(const method of ['CASH','CHEQUE']){
      for(const [route,handler,extra] of [['deposits',deposit,{}],['withdrawals',withdraw,{signerCustomerIds:[fixture.customerId]}]]){
        const value={accountId:fixture.ownAccount.account_id,amount:'1.23',method,...extra},key=randomUUID();
        const response=await handler(request(`/api/transactions/${route}`,value,'manager',key));assert.equal(response.status,201,await response.clone().text());
        const receipt=(await response.json()).data;
        assert.equal((await owner.query('SELECT c.channel_name FROM transaction t JOIN transaction_channel c USING(channel_id) WHERE transaction_id=$1',[receipt.transactionId])).rows[0].channel_name,method);
        assert.equal((await handler(request(`/api/transactions/${route}`,value,'manager',key))).status,200);
        assert.equal((await handler(request(`/api/transactions/${route}`,{...value,method:method==='CASH'?'CHEQUE':'CASH'},'manager',key))).status,409);
      }
    }
  });
  test('choices expose only active owned source accounts and Cash/Cheque methods',async()=>{
    const choices=await getPostingChoices({userId:fixture.customerLoginId,roleName:'CUSTOMER',branchId:null});
    assert.deepEqual(choices.methods,[{method:'CASH',label:'Cash'},{method:'CHEQUE',label:'Cheque'}]);
    assert.deepEqual(choices.ownAccounts.map(row=>row.accountId).sort(),[fixture.ownAccount.account_id,fixture.jointAccount.account_id].sort());
  });
  test('audit fault rolls back both balances and both legs',async()=>{
    const snapshot=await financialSnapshot(owner);
    await owner.query(`CREATE FUNCTION test_customer_transfer_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='TRANSFER_POSTED' THEN RAISE EXCEPTION 'Synthetic transfer audit fault' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$`);
    await owner.query('CREATE TRIGGER test_customer_transfer_fault BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_customer_transfer_fault()');
    try{assert.equal((await send()).status,500);assert.deepEqual(await financialSnapshot(owner),snapshot);}
    finally{await owner.query('DROP TRIGGER test_customer_transfer_fault ON audit_log');await owner.query('DROP FUNCTION test_customer_transfer_fault()');}
  });
});
