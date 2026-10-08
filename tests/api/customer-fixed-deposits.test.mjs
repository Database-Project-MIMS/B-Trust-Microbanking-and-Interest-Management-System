import { after,before,beforeEach,describe,test } from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fdFixture,fdRequest,financialSnapshot,pool,requireDisposableDatabase,useCustomerRuntime} from '../helpers/customer-fixed-deposits.mjs';
const {GET}=await import('../../app/api/customers/[id]/fixed-deposits/route.ts');
const {getCustomerFixedDeposits}=await import('../../services/customer-service.ts');

describe('P04-M02-T01: customer FD listing with real runtime sessions',()=>{
  let client,fixture,restore;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);restore=useCustomerRuntime(pool);});
  beforeEach(async()=>{fixture=await fdFixture(client);});
  after(async()=>{await restore?.();client?.release();await pool.end();});
  const read=(id=fixture.customerId,token=fixture.tokens.agent,query='')=>GET(fdRequest(id,token,query),{params:Promise.resolve({id})});
  async function denied(operation,status){const response=await operation();assert.equal(response.status,status);const data=await response.json();
    assert.ok(data.error.code);assert.ok(!/SELECT |INSERT |postgresql:|constraint|stack|password/i.test(data.error.message));return data;}
  test('lists exact principal/snapshot rate/dates, all statuses and joint FD once in newest-first order',async()=>{
    const baseline=await financialSnapshot(client);const response=await read();assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');const data=(await response.json()).data;
    assert.equal(data.customerId,fixture.customerId);
    assert.deepEqual(data.fixedDeposits.map(fd=>fd.fdId),[fixture.jointId,fixture.activeId,fixture.maturedId,fixture.closedId]);
    const active=data.fixedDeposits[1];assert.equal(active.principalAmount,'9999999999999.99');assert.equal(active.interestRateAtOpening,'0.1375');
    assert.equal(active.startDate,'2026-09-03');assert.equal(active.maturityDate,'2027-03-03');assert.equal(active.nextInterestDate,'2026-10-03');
    assert.deepEqual(data.fixedDeposits.map(fd=>fd.status),['ACTIVE','ACTIVE','MATURED','CLOSED']);
    assert.ok(data.fixedDeposits.every(fd=>!('fullName' in fd)&&!('customerId' in fd)&&!('branchId' in fd)));
    assert.deepEqual(await financialSnapshot(client),baseline);
  });
  test('joint holder sees the shared deposit without another holder profile',async()=>{
    const response=await read(fixture.secondCustomerId,fixture.tokens.second);assert.equal(response.status,200);
    assert.deepEqual((await response.json()).data.fixedDeposits.map(fd=>fd.fdId),[fixture.jointId]);
    await denied(()=>read(fixture.secondCustomerId),404);
  });
  test('manager sees own branch and bankwide roles see another branch',async()=>{
    assert.equal((await read(fixture.customerId,fixture.tokens.manager)).status,200);
    for(const role of ['central','auditor']){
      const response=await read(fixture.otherCustomerId,fixture.tokens[role]);assert.equal(response.status,200);
      assert.deepEqual((await response.json()).data.fixedDeposits.map(fd=>fd.fdId),[fixture.otherId]);
    }
    await denied(()=>read(fixture.customerId,fixture.tokens.otherManager),404);
    await denied(()=>read(fixture.otherCustomerId,fixture.tokens.manager),404);
  });
  test('CUSTOMER may read only the optional-login-linked self, including a joint FD',async()=>{
    const response=await read(fixture.customerId,fixture.tokens.customer);assert.equal(response.status,200);
    assert.equal((await response.json()).data.fixedDeposits.length,4);
    await denied(()=>read(fixture.secondCustomerId,fixture.tokens.customer),404);
    await denied(()=>read(randomUUID(),fixture.tokens.customer),404);
  });
  test('unlinked CUSTOMER and disallowed ADMIN fail closed',async()=>{
    const token=await fixture.session(await fixture.staff('CUSTOMER'));
    await denied(()=>read(fixture.customerId,token),404);await denied(()=>read(fixture.customerId,fixture.tokens.admin),403);
  });
  test('authorized customer without accounts or FDs returns an explicit empty list',async()=>{
    const response=await read(fixture.emptyCustomerId);assert.equal(response.status,200);
    assert.deepEqual((await response.json()).data,{customerId:fixture.emptyCustomerId,fixedDeposits:[]});
  });
  test('unknown and out-of-scope customer responses are identical',async()=>{
    const missing=await denied(()=>read(randomUUID()),404);const hidden=await denied(()=>read(fixture.otherCustomerId),404);
    assert.deepEqual(missing,hidden);
  });
  test('invalid UUID and client scope/query injection are rejected',async()=>{
    await denied(()=>read('not-a-uuid'),400);
    for(const query of ['?branchId='+fixture.otherBranchId,'?roleName=AUDITOR','?status=ACTIVE','?page=1&page=2','?q=%27%3B--']) await denied(()=>read(fixture.customerId,fixture.tokens.agent,query),400);
    assert.equal((await read(fixture.customerId.toUpperCase())).status,200);
  });
  test('missing, forged, expired and revoked sessions cannot read',async()=>{
    await denied(()=>read(fixture.customerId,null),401);await denied(()=>read(fixture.customerId,'forged'),401);
    await client.query("UPDATE user_session SET expires_at=now()-interval '1 second' WHERE user_id=$1",[fixture.agentId]);await denied(()=>read(),401);
    fixture.tokens.agent=await fixture.session(fixture.agentId);
    await client.query('UPDATE user_session SET revoked_at=now() WHERE user_id=$1',[fixture.agentId]);await denied(()=>read(),401);
  });
  test('assignment ending and branch transfer remove agent access immediately',async()=>{
    await client.query('UPDATE customer_agent SET is_active=false,end_date=CURRENT_DATE WHERE customer_id=$1',[fixture.customerId]);
    await denied(()=>read(),404);await fixture.assignment({agent_id:fixture.secondAgentId});
    assert.equal((await read(fixture.customerId,fixture.tokens.second)).status,200);
    await client.query('UPDATE agent SET branch_id=$1 WHERE agent_id=$2',[fixture.otherBranchId,fixture.secondAgentId]);
    await denied(()=>read(fixture.customerId,fixture.tokens.second),404);
  });
  test('customer and account branch must both match manager scope',async()=>{
    const crossAccount=await fixture.account([fixture.customerId],fixture.otherBranchId);
    const crossFd=await fixture.deposit(crossAccount.account_id);
    const response=await read(fixture.customerId,fixture.tokens.manager);assert.equal(response.status,200);
    assert.deepEqual((await response.json()).data.fixedDeposits.map(fd=>fd.fdId),[fixture.jointId,fixture.activeId,fixture.maturedId,fixture.closedId]);
    const bank=await read(fixture.customerId,fixture.tokens.central);
    assert.ok((await bank.json()).data.fixedDeposits.some(fd=>fd.fdId===crossFd));
  });
  test('snapshot rate survives a later product-rate change',async()=>{
    const previous=(await client.query('SELECT interest_rate FROM fd_plan WHERE fd_plan_id=$1',[fixture.planId])).rows[0].interest_rate;
    try{await client.query('UPDATE fd_plan SET interest_rate=0.15 WHERE fd_plan_id=$1',[fixture.planId]);
      const response=await read();assert.ok((await response.json()).data.fixedDeposits.every(fd=>fd.interestRateAtOpening==='0.1375'));
    }finally{await client.query('UPDATE fd_plan SET interest_rate=$1 WHERE fd_plan_id=$2',[previous,fixture.planId]);}
  });
  test('service rejects forged role/branch and inactive stored caller/profile/branch',async()=>{
    const actor={userId:fixture.agentId,roleName:'AGENT',branchId:fixture.branchId};
    for(const forged of [{...actor,roleName:'AUDITOR'},{...actor,branchId:fixture.otherBranchId}]) await assert.rejects(getCustomerFixedDeposits(fixture.customerId,forged),error=>error.status===403);
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1",[fixture.agentId]);
    await assert.rejects(getCustomerFixedDeposits(fixture.customerId,actor),error=>error.status===403);
    await client.query("UPDATE agent SET status='INACTIVE' WHERE branch_id=$1",[fixture.branchId]);
    await client.query("UPDATE branch SET status='INACTIVE' WHERE branch_id=$1",[fixture.branchId]);
    await assert.rejects(getCustomerFixedDeposits(fixture.customerId,actor),error=>error.status===403);
    await client.query("UPDATE branch SET status='ACTIVE' WHERE branch_id=$1",[fixture.branchId]);
    await client.query("UPDATE agent SET status='ACTIVE' WHERE agent_id=$1",[fixture.agentId]);
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[fixture.agentId]);
    await assert.rejects(getCustomerFixedDeposits(fixture.customerId,actor),error=>error.status===403);
  });
});
