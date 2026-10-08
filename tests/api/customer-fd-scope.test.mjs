import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {fdFixture,fdRequest,financialSnapshot,pool,requireDisposableDatabase,useCustomerRuntime} from '../helpers/customer-fixed-deposits.mjs';
const {GET}=await import('../../app/api/customers/[id]/fixed-deposits/route.ts');

describe('P04-M02-T02: FD authorization transitions with live sessions',()=>{
  let client,fixture,restore;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);restore=useCustomerRuntime(pool);});
  beforeEach(async()=>{fixture=await fdFixture(client);});
  after(async()=>{await restore?.();client?.release();await pool.end();});
  const read=(id,token)=>GET(fdRequest(id,token),{params:Promise.resolve({id})});
  async function denied(id,token,status){
    const response=await read(id,token);assert.equal(response.status,status);
    const body=await response.json();assert.ok(body.error.code);
    assert.ok(!('data' in body));assert.ok(!/SELECT |postgresql:|constraint|password|stack/i.test(body.error.message));
    return body;
  }
  async function ids(id,token){
    const response=await read(id,token);assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    return (await response.json()).data.fixedDeposits.map(fd=>fd.fdId);
  }
  test('an existing manager session follows a transfer, losing old branch and gaining new branch',async()=>{
    assert.ok((await ids(fixture.customerId,fixture.tokens.manager)).includes(fixture.activeId));
    await denied(fixture.otherCustomerId,fixture.tokens.manager,404);
    await client.query('UPDATE agent SET branch_id=$1 WHERE agent_id=$2',[fixture.otherBranchId,fixture.managerId]);
    const baseline=await financialSnapshot(client);
    await denied(fixture.customerId,fixture.tokens.manager,404);
    assert.deepEqual(await ids(fixture.otherCustomerId,fixture.tokens.manager),[fixture.otherId]);
    assert.deepEqual(await financialSnapshot(client),baseline);
  });
  test('the same session follows stored role changes instead of retaining earlier access',async()=>{
    await denied(fixture.secondCustomerId,fixture.tokens.agent,404);
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='BRANCH_MANAGER') WHERE user_id=$1",[fixture.agentId]);
    assert.deepEqual(await ids(fixture.secondCustomerId,fixture.tokens.agent),[fixture.jointId]);
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='CUSTOMER') WHERE user_id=$1",[fixture.agentId]);
    await denied(fixture.customerId,fixture.tokens.agent,404);
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='ADMIN') WHERE user_id=$1",[fixture.agentId]);
    await denied(fixture.customerId,fixture.tokens.agent,403);
  });
  test('changing a self-service link removes old customer access and limits the new joint holder',async()=>{
    assert.equal((await ids(fixture.customerId,fixture.tokens.customer)).length,4);
    await client.query('UPDATE customer SET app_user_id=NULL WHERE customer_id=$1',[fixture.customerId]);
    await client.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2',[fixture.customerLoginId,fixture.secondCustomerId]);
    const baseline=await financialSnapshot(client);
    await denied(fixture.customerId,fixture.tokens.customer,404);
    assert.deepEqual(await ids(fixture.secondCustomerId,fixture.tokens.customer),[fixture.jointId]);
    assert.deepEqual(await financialSnapshot(client),baseline);
  });
  test('sessions cannot outlive active role/user/profile requirements',async()=>{
    const missingId=await fixture.staff('CUSTOMER');
    const missingToken=await fixture.session(missingId);
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='AGENT') WHERE user_id=$1",[missingId]);
    await denied(fixture.customerId,missingToken,401);
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1",[fixture.agentId]);
    await denied(fixture.customerId,fixture.tokens.agent,401);
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[fixture.centralId]);
    await denied(fixture.customerId,fixture.tokens.central,401);
    try{
      await client.query("UPDATE role SET status='INACTIVE' WHERE role_name='AUDITOR'");
      await denied(fixture.customerId,fixture.tokens.auditor,401);
    }finally{await client.query("UPDATE role SET status='ACTIVE' WHERE role_name='AUDITOR'");}
  });
});
