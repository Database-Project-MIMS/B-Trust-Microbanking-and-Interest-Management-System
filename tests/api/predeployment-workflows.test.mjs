import {after,before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fdFixture,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {POST as login} from '../../app/api/auth/login/route.ts';
import {POST as transfer} from '../../app/api/transactions/transfers/route.ts';
import {POST as reverse} from '../../app/api/transactions/[id]/reverse/route.ts';
import {POST as withdraw} from '../../app/api/transactions/withdrawals/route.ts';
import {POST as deposit} from '../../app/api/transactions/deposits/route.ts';
import {POST as verify} from '../../app/api/customer-documents/[id]/verify/route.ts';
import {GET as statement} from '../../app/api/accounts/[id]/transactions/route.ts';
import {POST as close} from '../../app/api/accounts/[id]/close/route.ts';
import {runReconciliationCheck} from '../../services/reconciliation-service.ts';
describe('Predeployment: real runtime deposit, document and statement contracts',()=>{
  let owner,fixture,restore,account,channel,hours;
  const csrf=randomBytes(32).toString('hex');
  before(async()=>{owner=await pool.connect();await requireDisposableDatabase(owner);fixture=await fdFixture(owner);
    account=await fixture.account([fixture.customerId]);channel=(await owner.query("SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'")).rows[0].channel_id;
    hours=(await owner.query("SELECT param_key,param_value FROM system_parameter WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')")).rows;
    await owner.query("UPDATE system_parameter SET param_value='00:00' WHERE param_key='BUSINESS_HOUR_START'");
    await owner.query("UPDATE system_parameter SET param_value='23:59:59' WHERE param_key='BUSINESS_HOUR_END'");
    restore=useCustomerRuntime(pool);});
  after(async()=>{await restore?.();if(owner&&hours)for(const row of hours)await owner.query('UPDATE system_parameter SET param_value=$2 WHERE param_key=$1',[row.param_key,row.param_value]);owner?.release();await pool.end();});
  function request(path,body,role='agent',key=randomUUID(),token=csrf){return new NextRequest('http://localhost'+path,{method:body===undefined?'GET':'POST',
    headers:{cookie:`mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,'x-csrf-token':token,'content-type':'application/json','idempotency-key':key},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});}
  const payload=()=>({accountId:account.account_id,channelId:channel,amount:'1.23',narration:'predeployment deposit'});
  test('altered amount, narration, account and actor cannot reuse a deposit receipt',async()=>{
    const key=randomUUID();const first=await deposit(request('/api/transactions/deposits',payload(),'agent',key));assert.equal(first.status,201,await first.clone().text());
    const result=(await first.json()).data;
    const replay=await deposit(request('/api/transactions/deposits',payload(),'agent',key));assert.equal(replay.status,200);assert.deepEqual((await replay.json()).data,result);
    const other=await fixture.account([fixture.customerId]);
    for(const value of [{...payload(),amount:'2.34'},{...payload(),narration:'altered'},{...payload(),accountId:other.account_id}]){
      const response=await deposit(request('/api/transactions/deposits',value,'agent',key));assert.equal(response.status,409);assert.equal((await response.json()).error.code,'IDEMPOTENCY_KEY_REUSED');}
    assert.equal((await deposit(request('/api/transactions/deposits',payload(),'manager',key))).status,409);
    const stored=(await owner.query('SELECT agent_id,branch_id,amount FROM transaction WHERE transaction_id=$1',[result.transactionId])).rows[0];
    assert.equal(stored.agent_id,fixture.agentId);assert.equal(stored.branch_id,fixture.branchId);assert.equal(stored.amount,'1.23');
  });
  test('concurrent identical deposit requests return one 201 and one 200 with exactly one credit',async()=>{
    const key=randomUUID(),before=(await owner.query('SELECT current_balance::text FROM account WHERE account_id=$1',[account.account_id])).rows[0].current_balance;
    const responses=await Promise.all([deposit(request('/api/transactions/deposits',payload(),'agent',key)),deposit(request('/api/transactions/deposits',payload(),'agent',key))]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.deepEqual(await responses[0].json(),await responses[1].json());
    assert.equal((await owner.query('SELECT current_balance=$2::numeric+1.23 AS valid FROM account WHERE account_id=$1',[account.account_id,before])).rows[0].valid,true);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM transaction WHERE idempotency_key=$1',[key])).rows[0].n,1);
  });
  test('invalid exact money and extra fields fail before ledger effects',async()=>{
    for(const value of ['0.00','0.001','NaN','Infinity','10000000000000.00'])assert.equal((await deposit(request('/api/transactions/deposits',{...payload(),amount:value}))).status,400);
    assert.equal((await deposit(request('/api/transactions/deposits',{...payload(),unexpected:true}))).status,400);
  });
  test('verification works under mims_app, replay is stable and foreign branch/CSRF cannot verify',async()=>{
    const doc=(await owner.query("INSERT INTO customer_document(customer_id,doc_type,file_path) VALUES($1,'NIC','synthetic/predeploy.pdf') RETURNING doc_id",[fixture.customerId])).rows[0].doc_id;
    const path=`/api/customer-documents/${doc}/verify`,context={params:Promise.resolve({id:doc})};
    assert.equal((await verify(request(path,{},'otherManager'),context)).status,403);
    assert.equal((await verify(request(path,{},'manager',undefined,''),context)).status,403);
    const first=await verify(request(path,{},'manager'),context);assert.equal(first.status,200,await first.clone().text());
    const replay=await verify(request(path,{},'manager'),context);assert.deepEqual(await replay.json(),await first.json());
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM audit_log WHERE entity_id=$1 AND entity_type='customer_document'",[doc])).rows[0].n,1);
  });
  test('statement rejects duplicate/unknown filters and uses posting order even with inverted timestamps',async()=>{
    for(const suffix of ['?page=1&page=2','?other=1'])assert.equal((await statement(request(`/api/accounts/${account.account_id}/transactions${suffix}`))).status,400);
    const response=await statement(request(`/api/accounts/${account.account_id}/transactions`));assert.equal(response.status,200);
    const expected=(await owner.query('SELECT transaction_id FROM transaction WHERE account_id=$1 ORDER BY ledger_seq DESC LIMIT 20',[account.account_id])).rows.map(r=>r.transaction_id);
    assert.deepEqual((await response.json()).data.map(r=>r.transactionId),expected);
    assert.equal((await statement(request(`/api/accounts/${randomUUID()}/transactions`))).status,404);
  });
  test('staff transfer is paired, replay bound, scoped, reversible as a pair and counted in daily limits',async()=>{
    const src=await fixture.account([fixture.customerId]),dst=await fixture.account([fixture.customerId]);
    const body={sourceAccountId:src.account_id,destinationAccountId:dst.account_id,amount:'12.34',signerCustomerIds:[fixture.customerId],narration:'staff transfer'};
    const key=randomUUID();const first=await transfer(request('/api/transactions/transfers',body,'manager',key));assert.equal(first.status,201,await first.clone().text());
    const receipt=(await first.json()).data;
    const retry=await transfer(request('/api/transactions/transfers',body,'manager',key));assert.equal(retry.status,200);assert.deepEqual((await retry.json()).data,receipt);
    assert.equal((await transfer(request('/api/transactions/transfers',{...body,amount:'23.45'},'manager',key))).status,409);
    assert.equal((await transfer(request('/api/transactions/transfers',body,'customer'))).status,403);
    assert.equal((await transfer(request('/api/transactions/transfers',{...body,destinationAccountId:fixture.otherAccount.account_id},'manager'))).status,403);
    const pair=(await owner.query("SELECT count(*)::int AS n,sum(CASE WHEN transaction_type='TRANSFER_OUT' THEN -amount ELSE amount END)::text AS net FROM transaction WHERE transfer_group_id=$1",[receipt.transferGroupId])).rows[0];assert.deepEqual(pair,{n:2,net:'0.00'});
    const reversalKey=randomUUID(),path=`/api/transactions/${receipt.debitTransactionId}/reverse`,ctx={params:Promise.resolve({id:receipt.debitTransactionId})};
    const reversed=await reverse(request(path,{reason:'Correct transfer'},'manager',reversalKey),ctx);assert.equal(reversed.status,201,await reversed.clone().text());
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM transaction_reversal WHERE original_transaction_id IN($1,$2)',[receipt.debitTransactionId,receipt.creditTransactionId])).rows[0].n,2);
    assert.equal((await owner.query('SELECT current_balance::text AS b FROM account WHERE account_id=$1',[src.account_id])).rows[0].b,'123456.78');
    const limit=(await owner.query("SELECT param_value FROM system_parameter WHERE param_key='WITHDRAWAL_DAILY_LIMIT'")).rows[0].param_value;
    try {await owner.query("UPDATE system_parameter SET param_value='15.00' WHERE param_key='WITHDRAWAL_DAILY_LIMIT'");
      assert.equal((await withdraw(request('/api/transactions/withdrawals',{accountId:src.account_id,channelId:channel,amount:'3.00',signerCustomerIds:[fixture.customerId]},'manager'))).status,409);
    }finally{await owner.query("UPDATE system_parameter SET param_value=$1 WHERE param_key='WITHDRAWAL_DAILY_LIMIT'",[limit]);}
  });
  test('browser Host origin is accepted even if Next normalizes the internal request URL; foreign origins fail',async()=>{
    for(const [origin,status] of [['http://127.0.0.1:34567',401],['https://foreign.example',403]]){
      const r=await login(new NextRequest('http://localhost/api/auth/login',{method:'POST',headers:{host:'127.0.0.1:34567',origin,'content-type':'application/json'},body:JSON.stringify({username:'missing-'+randomUUID(),password:'synthetic-login-negative'})}));assert.equal(r.status,status,await r.clone().text());
    }
  });
  test('account closure rejects unpaid accrued interest with a safe conflict response',async()=>{
    const a=await fixture.account([fixture.customerId]);await owner.query("UPDATE account SET opened_date='2006-01-01',current_balance=0 WHERE account_id=$1",[a.account_id]);
    await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,balance_after,branch_id)
      VALUES($1,$2,$3,$4,'DEPOSIT',36500,'2006-01-01T00:00:00+05:30',36500,$5),
      ($1,$2,$3,$6,'WITHDRAWAL',36500,'2006-01-02T00:00:00+05:30',0,$5)`,[a.account_id,fixture.managerId,channel,randomUUID(),fixture.branchId,randomUUID()]);
    const path=`/api/accounts/${a.account_id}/close`,r=await close(request(path,{},'manager'),{params:Promise.resolve({id:a.account_id})});
    assert.equal(r.status,409,await r.clone().text());assert.equal((await r.json()).error.code,'UNSETTLED_SAVINGS_INTEREST');
    assert.equal((await owner.query('SELECT status FROM account WHERE account_id=$1',[a.account_id])).rows[0].status,'ACTIVE');
  });
  test('reconciliation service returns real bank-wide counts and rejects staff',async()=>{
    const id=(await owner.query("SELECT u.user_id FROM app_user u JOIN role r ON r.role_id=u.role_id WHERE r.role_name='CENTRAL_OPS' AND u.status='ACTIVE' LIMIT 1")).rows[0].user_id;
    const report=await runReconciliationCheck({userId:id,roleName:'CENTRAL_OPS',branchId:null});
    assert.equal(report.totalAccounts,(await owner.query('SELECT count(*)::int AS n FROM account')).rows[0].n);
    await assert.rejects(()=>runReconciliationCheck({userId:fixture.agentId,roleName:'AGENT',branchId:fixture.branchId}),{code:'NOT_AUTHORIZED'});
  });
});
