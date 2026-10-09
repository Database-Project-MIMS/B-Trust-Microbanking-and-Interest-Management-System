import { after,before,beforeEach,describe,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fdFixture,pool,requireDisposableDatabase,financialSnapshot } from '../helpers/customer-fixed-deposits.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import * as fd from '../../app/api/fixed-deposits/route.ts';
import * as quote from '../../app/api/fixed-deposits/quote/route.ts';
import * as runs from '../../app/api/interest-runs/route.ts';
import { GET as rpt03 } from '../../app/api/reports/active-fds/route.ts';
import { GET as rpt04 } from '../../app/api/reports/interest-distribution/route.ts';

describe('G-26: complete FD and independently committed interest API under mims_app',()=>{
  let client,fixture,restore,account;
  const csrf=randomBytes(32).toString('hex');
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);restore=useCustomerRuntime(pool);});
  beforeEach(async()=>{fixture=await fdFixture(client);account=await fixture.account([fixture.customerId]);});
  after(async()=>{await restore?.();client?.release();await pool.end();});
  function request(method,path,body,role='agent',key=`FD-${randomUUID()}`,csrfValue=csrf){
    return new NextRequest('http://localhost'+path,{method,headers:{cookie:`mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,
      'x-csrf-token':csrfValue,'content-type':'application/json','idempotency-key':key},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
  }
  const body=()=>({accountId:account.account_id,fdPlanId:fixture.planId,principalAmount:'100000.00'});
  const post=(value=body(),role='agent',key)=>fd.POST(request('POST','/api/fixed-deposits',value,role,key));
  async function success(response,status){assert.equal(response.status,status,await response.clone().text());return (await response.json()).data;}
  async function balance(id){return (await client.query('SELECT current_balance FROM account WHERE account_id=$1',[id])).rows[0].current_balance;}
  test('quote is SQL-exact and read-only; opening posts one debit, FD, receipt and audit; retry returns same FD',async()=>{
    const original=await financialSnapshot(client);
    const preview=await success(await quote.GET(request('GET','/api/fixed-deposits/quote?'+new URLSearchParams(body()))),200);
    assert.equal(preview.balanceAfter,'23456.78');assert.deepEqual(await financialSnapshot(client),original);
    const key=`FD-${randomUUID()}`;
    const first=await success(await post(body(),'agent',key),201);
    assert.equal(first.principalAmount,'100000.00');
    assert.equal(first.rate,(await client.query('SELECT interest_rate FROM fd_plan WHERE fd_plan_id=$1',[fixture.planId])).rows[0].interest_rate);
    const afterState=await financialSnapshot(client);
    assert.equal(await balance(account.account_id),'23456.78');
    const again=await success(await post(body(),'agent',key),200);assert.equal(again.fdId,first.fdId);
    assert.deepEqual(await financialSnapshot(client),afterState);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM fd_opening_request WHERE fd_id=$1',[first.fdId])).rows[0].n,1);
    const conflict=await post({...body(),principalAmount:'100001.00'},'agent',key);
    assert.equal(conflict.status,409);assert.deepEqual(await financialSnapshot(client),afterState);
  });
  test('two keys racing one account create exactly one active FD and principal debit',async()=>{
    const beforeState=await financialSnapshot(client);
    const responses=await Promise.all([post(),post()]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    const result=await financialSnapshot(client);assert.equal(result.ledger-beforeState.ledger,1);
    assert.equal(await balance(account.account_id),'23456.78');
  });
  test('bad scope, CSRF, minimum, inactive product and insufficient balance cannot leave partial financial state',async()=>{
    const original=await financialSnapshot(client);
    for(const response of [await post(body(),'otherManager'),await post(body(),'auditor'),
      await fd.POST(request('POST','/api/fixed-deposits',body(),'agent',undefined,'')),
      await post({...body(),principalAmount:'0.01'}),await post({...body(),principalAmount:'999999.99'})]){
      assert.ok([400,403,404,409].includes(response.status));assert.deepEqual(await financialSnapshot(client),original);
    }
    const inactive=(await client.query(`INSERT INTO fd_plan(plan_name,tenure_months,interest_rate,status)
      VALUES($1,6,0.12,'INACTIVE') RETURNING fd_plan_id`,[`Inactive-${randomUUID()}`])).rows[0].fd_plan_id;
    try {
      assert.equal((await post({...body(),fdPlanId:inactive})).status,409);
      assert.deepEqual(await financialSnapshot(client),original);
    } finally {await client.query('DELETE FROM fd_plan WHERE fd_plan_id=$1',[inactive]);}
  });
  test('customer listing contains held FDs only and manager report totals are exact scoped SQL totals',async()=>{
    const listing=await success(await fd.GET(request('GET','/api/fixed-deposits',undefined,'customer')),200);
    assert.ok(listing.rows.every(row=>[fixture.ownAccount.account_id,fixture.jointAccount.account_id].includes(row.accountId)));
    const report=await success(await rpt03(request('GET','/api/reports/active-fds?branchId='+fixture.branchId,undefined,'manager')),200);
    const expected=(await client.query(`SELECT sum(principal_amount)::text AS principal FROM vw_rpt03_active_fds WHERE branch_id=$1`,[fixture.branchId])).rows[0].principal;
    assert.equal(report.grandTotal.principal_amount,expected);
    assert.ok(report.rows.every(row=>row.branch_id===fixture.branchId));
    assert.equal((await rpt03(request('GET','/api/reports/active-fds?branchId='+fixture.otherBranchId,undefined,'manager'))).status,403);
  });
  test('per-FD failure rolls back its ledger/balance/date while earlier successful payout commits; replay duplicates nothing',async()=>{
    const other=await fixture.account([fixture.customerId]);
    const ids=[await fixture.deposit(account.account_id,'ACTIVE','100000.00','1901-01-01'),
      await fixture.deposit(other.account_id,'ACTIVE','100000.00','1901-01-01')].sort();
    const failed=ids[1],successful=ids[0];
    await client.query('UPDATE fixed_deposit SET interest_rate_at_opening=0.12 WHERE fd_id=ANY($1::uuid[])',[ids]);
    await client.query(`CREATE FUNCTION public.test_interest_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.fd_id='${failed}'::uuid THEN RAISE EXCEPTION 'synthetic payout fault'; END IF; RETURN NEW; END $$`);
    await client.query('CREATE TRIGGER test_interest_fault BEFORE INSERT ON interest_payout FOR EACH ROW EXECUTE FUNCTION public.test_interest_fault()');
    try{
      const result=await success(await runs.POST(request('POST','/api/interest-runs',{cycleDate:'1901-01-31',dryRun:false},'central')),200);
      assert.equal(result.fdCount,1);assert.equal(result.exceptionCount,1);assert.equal(result.totalInterest,'986.30');
      const states=(await client.query(`SELECT fd_id,next_interest_date::text,current_balance FROM fixed_deposit
        JOIN account USING(account_id) WHERE fd_id=ANY($1::uuid[]) ORDER BY fd_id`,[ids])).rows;
      assert.equal(states.find(row=>row.fd_id===successful).current_balance,'124443.08');
      assert.equal(states.find(row=>row.fd_id===failed).current_balance,'123456.78');
      assert.equal(states.find(row=>row.fd_id===failed).next_interest_date,'1901-01-31');
      const snapshot=await financialSnapshot(client);
      const replay=await success(await runs.POST(request('POST','/api/interest-runs',{cycleDate:'1901-01-31',dryRun:false},'central')),200);
      assert.equal(replay.replayed,true);assert.equal(replay.runId,result.runId);
      const afterState=await financialSnapshot(client);assert.equal(afterState.ledger,snapshot.ledger);
      assert.deepEqual(afterState.balances,snapshot.balances);assert.deepEqual(afterState.deposits,snapshot.deposits);
      const report=await success(await rpt04(request('GET','/api/reports/interest-distribution?from=1901-01-31&to=1901-01-31',undefined,'manager')),200);
      assert.equal(report.grandTotal.total_interest,'986.30');
      const csv=await rpt04(request('GET','/api/reports/interest-distribution?from=1901-01-31&to=1901-01-31&format=csv',undefined,'manager'));
      assert.equal(csv.status,200);assert.match(await csv.text(),/986\.30/);
    }finally{await client.query('DROP TRIGGER test_interest_fault ON interest_payout');await client.query('DROP FUNCTION public.test_interest_fault()');}
  });
  test('a failure finalizing the run cannot roll back its independently committed distribution',async()=>{
    const fdId=await fixture.deposit(account.account_id,'ACTIVE','100000.00','1902-01-01');
    await client.query('UPDATE fixed_deposit SET interest_rate_at_opening=0.12 WHERE fd_id=$1',[fdId]);
    await client.query(`CREATE FUNCTION public.test_run_finalize_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.cycle_date='1902-01-31' AND NEW.status='COMPLETED' THEN RAISE EXCEPTION 'synthetic finalize fault' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$`);
    await client.query('CREATE TRIGGER test_run_finalize_fault BEFORE UPDATE ON interest_run FOR EACH ROW EXECUTE FUNCTION public.test_run_finalize_fault()');
    try{
      assert.equal((await runs.POST(request('POST','/api/interest-runs',{cycleDate:'1902-01-31',dryRun:false},'central'))).status,500);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM interest_payout WHERE fd_id=$1 AND cycle_date=$2',[fdId,'1902-01-31'])).rows[0].n,1);
      assert.equal(await balance(account.account_id),'124443.08');
      assert.equal((await runs.POST(request('POST','/api/interest-runs',{cycleDate:'1902-01-31',dryRun:false},'central'))).status,409);
    }finally{await client.query('DROP TRIGGER test_run_finalize_fault ON interest_run');await client.query('DROP FUNCTION public.test_run_finalize_fault()');}
  });
  test('dry run creates no run, payout or balance change; legacy owner-only entries cannot be called by runtime',async()=>{
    const original=await financialSnapshot(client);
    const result=await success(await runs.POST(request('POST','/api/interest-runs',{cycleDate:'1903-01-31',dryRun:true},'central')),200);
    assert.equal(result.status,'DRY_RUN');
    const current=await financialSnapshot(client);assert.equal(current.ledger,original.ledger);assert.deepEqual(current.balances,original.balances);
    await client.query('BEGIN');
    try{
      await client.query('SET LOCAL ROLE mims_app');
      await assert.rejects(client.query('SELECT sp_run_interest_cycle($1,NULL)',['1904-01-31']),error=>error.code==='42501');
    }finally{await client.query('ROLLBACK');}
  });
});
