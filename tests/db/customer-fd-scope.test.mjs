import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fdFixture,financialSnapshot,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {setRlsContext} from '../../lib/db/rls-context.ts';

describe('P04-M02-T02: direct runtime FD context and scope backstop',()=>{
  let client,fixture;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);});
  beforeEach(async()=>{fixture=await fdFixture(client);});
  after(async()=>{client?.release();await pool.end();});
  const actor=(userId=fixture.agentId,roleName='AGENT',branchId=fixture.branchId)=>({userId,roleName,branchId});
  async function runtime(context,work){
    await client.query('BEGIN');
    try{
      await client.query('SET LOCAL ROLE mims_app');
      if(context)await setRlsContext(client,context);
      return await work(client);
    }finally{await client.query('ROLLBACK');}
  }
  async function listing(context){return runtime(context,async tx=>({
    base:(await tx.query('SELECT fd_id FROM fixed_deposit')).rows,
    view:(await tx.query('SELECT customer_id,fd_id FROM vw_customer_fd_summary')).rows,
  }));}
  async function hidden(context){assert.deepEqual(await listing(context),{base:[],view:[]});}

  test('actor guard is restrictive SELECT-only, invoker/stable, with least-privilege execution',async()=>{
    const policy=(await client.query(`SELECT polpermissive,polcmd FROM pg_policy
      WHERE polrelid='fixed_deposit'::regclass AND polname='fixed_deposit_customer_listing_actor_guard'`)).rows[0];
    assert.deepEqual(policy,{polpermissive:false,polcmd:'r'});
    const fn=(await client.query(`SELECT prosecdef,provolatile FROM pg_proc
      WHERE oid='fn_customer_fd_actor_is_current()'::regprocedure`)).rows[0];
    assert.deepEqual(fn,{prosecdef:false,provolatile:'s'});
    const grants=(await client.query(`SELECT
      has_function_privilege('mims_app','fn_customer_fd_actor_is_current()','EXECUTE') AS guard,
      has_function_privilege('mims_app','fn_install_customer_fd_scope_guard()','EXECUTE') AS install,
      has_table_privilege('mims_app','fixed_deposit','UPDATE') AS write`)).rows[0];
    assert.deepEqual(grants,{guard:true,install:false,write:false});
    await assert.rejects(runtime(actor(),tx=>tx.query('SELECT fn_install_customer_fd_scope_guard()')),e=>e.code==='42501');
  });
  test('role-only bankwide context, missing staff branch and nonexistent identities reveal nothing',async()=>{
    await hidden(null);
    await runtime(null,async tx=>{
      await tx.query("SELECT set_config('app.current_user_role','AUDITOR',true)");
      assert.equal((await tx.query('SELECT count(*)::int AS n FROM fixed_deposit')).rows[0].n,0);
      assert.equal((await tx.query('SELECT count(*)::int AS n FROM vw_customer_fd_summary')).rows[0].n,0);
    });
    await hidden(actor(fixture.managerId,'BRANCH_MANAGER',null));
    await hidden(actor(randomUUID(),'AUDITOR',null));
    await hidden(actor(randomUUID(),'AGENT'));
  });
  test('role escalation and forged branch are rejected below the service',async()=>{
    await hidden(actor(fixture.agentId,'AUDITOR',null));
    await hidden(actor(fixture.agentId,'BRANCH_MANAGER'));
    await hidden(actor(fixture.auditorId,'CENTRAL_OPS',null));
    await hidden(actor(fixture.otherManagerId,'BRANCH_MANAGER',fixture.branchId));
    await hidden(actor(fixture.adminId,'ADMIN',null));
  });
  test('deactivated user or role invalidates a previously valid SQL context',async()=>{
    assert.equal((await listing(actor())).base.length,4);
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[fixture.agentId]);
    await hidden(actor());
    try{
      await client.query("UPDATE role SET status='INACTIVE' WHERE role_name='AUDITOR'");
      await hidden(actor(fixture.auditorId,'AUDITOR',null));
    }finally{await client.query("UPDATE role SET status='ACTIVE' WHERE role_name='AUDITOR'");}
  });
  test('inactive staff, inactive branch and missing profile fail closed',async()=>{
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1",[fixture.agentId]);
    await hidden(actor());
    await client.query("UPDATE agent SET status='INACTIVE' WHERE branch_id=$1",[fixture.branchId]);
    await client.query("UPDATE branch SET status='INACTIVE' WHERE branch_id=$1",[fixture.branchId]);
    await hidden(actor(fixture.managerId,'BRANCH_MANAGER'));
    const missingId=await fixture.staff('CUSTOMER');
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='BRANCH_MANAGER') WHERE user_id=$1",[missingId]);
    await hidden(actor(missingId,'BRANCH_MANAGER'));
  });
  test('a transfer rejects stale branch context and current branch cannot expose old-branch FDs',async()=>{
    assert.equal((await listing(actor())).base.length,4);
    await client.query('UPDATE agent SET branch_id=$1 WHERE agent_id=$2',[fixture.otherBranchId,fixture.agentId]);
    await hidden(actor());
    await hidden(actor(fixture.agentId,'AGENT',fixture.otherBranchId));
  });
  test('current assignments and both branches constrain direct view/base reads',async()=>{
    const crossAccount=await fixture.account([fixture.customerId],fixture.otherBranchId);
    const crossId=await fixture.deposit(crossAccount.account_id);
    const manager=await listing(actor(fixture.managerId,'BRANCH_MANAGER'));
    assert.ok(!manager.base.some(row=>row.fd_id===crossId));
    await client.query('UPDATE customer_agent SET is_active=false,end_date=CURRENT_DATE WHERE customer_id=$1',[fixture.customerId]);
    await hidden(actor());
    await fixture.assignment({agent_id:fixture.secondAgentId});
    const assigned=await listing(actor(fixture.secondAgentId));
    assert.ok(assigned.view.some(row=>row.customer_id===fixture.customerId));
    assert.ok(!assigned.base.some(row=>row.fd_id===crossId));
    await client.query('UPDATE customer SET branch_id=$1 WHERE customer_id=$2',[fixture.otherBranchId,fixture.customerId]);
    const moved=await listing(actor(fixture.secondAgentId));
    assert.ok(moved.view.every(row=>row.customer_id!==fixture.customerId));
    assert.ok(!moved.base.some(row=>row.fd_id===fixture.activeId));
  });
  test('bankwide role remains bankwide with a retained inactive staff profile',async()=>{
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='CENTRAL_OPS') WHERE user_id=$1",[fixture.agentId]);
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1",[fixture.agentId]);
    const current=await listing(actor(fixture.agentId,'CENTRAL_OPS',fixture.branchId));
    assert.ok(current.base.some(row=>row.fd_id===fixture.otherId));
    assert.ok(current.view.some(row=>row.customer_id===fixture.otherCustomerId));
    await hidden(actor());
  });
  test('self login link revocation removes direct FD access without leaking a co-holder',async()=>{
    const context=actor(fixture.customerLoginId,'CUSTOMER',null);
    const self=await listing(context);
    assert.equal(self.view.length,4);assert.ok(self.view.every(row=>row.customer_id===fixture.customerId));
    await client.query('UPDATE customer SET app_user_id=NULL WHERE customer_id=$1',[fixture.customerId]);
    await hidden(context);
  });
  test('COMMIT and ROLLBACK clear borrowed-client scope; binders preserve guard and financial state',async()=>{
    const baseline=await financialSnapshot(client);
    await client.query('BEGIN');await client.query('SET LOCAL ROLE mims_app');await setRlsContext(client,actor());
    assert.equal((await client.query('SELECT count(*)::int AS n FROM fixed_deposit')).rows[0].n,4);
    await client.query('COMMIT');await hidden(null);
    await listing(actor(fixture.auditorId,'AUDITOR',null));await hidden(null);
    await client.query(readFileSync('database/views/customer-fd-summary.sql','utf8'));
    await client.query(readFileSync('database/views/customer-fd-summary.sql','utf8'));
    await hidden(actor(fixture.agentId,'AUDITOR',null));
    assert.deepEqual(await financialSnapshot(client),baseline);
  });
});
