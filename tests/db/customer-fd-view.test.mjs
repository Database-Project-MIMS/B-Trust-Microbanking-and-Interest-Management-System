import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fdFixture,financialSnapshot,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {setRlsContext} from '../../lib/db/rls-context.ts';

describe('P04-M02-T01: caller-RLS FD view and read grants',()=>{
  let client,fixture;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);});
  beforeEach(async()=>{fixture=await fdFixture(client);});
  after(async()=>{client?.release();await pool.end();});
  async function runtime(actor,work){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE mims_app');
    if(actor)await setRlsContext(client,actor);return await work(client);
  }finally{await client.query('ROLLBACK');}}
  const actor=(userId=fixture.agentId,roleName='AGENT',branchId=fixture.branchId)=>({userId,roleName,branchId});
  const view=client=>client.query('SELECT customer_id,fd_id FROM vw_customer_fd_summary');
  test('security-invoker/barrier view is bound after 0480 and can be rebound without data loss',async()=>{
    const relation=(await client.query("SELECT reloptions FROM pg_class WHERE oid='vw_customer_fd_summary'::regclass")).rows[0];
    assert.ok(relation.reloptions.includes('security_invoker=true'));assert.ok(relation.reloptions.includes('security_barrier=true'));
    const baseline=await financialSnapshot(client);
    await client.query(readFileSync('database/views/customer-fd-summary.sql','utf8'));
    await client.query(readFileSync('database/views/customer-fd-summary.sql','utf8'));
    assert.deepEqual(await financialSnapshot(client),baseline);
  });
  test('direct view reads without RLS context are empty',async()=>{
    assert.deepEqual((await runtime(null,view)).rows,[]);
  });
  test('direct agent view reads conceal unassigned customers and retain own joint FD once',async()=>{
    const rows=(await runtime(actor(),view)).rows;
    assert.ok(rows.length===4);assert.ok(rows.every(row=>row.customer_id===fixture.customerId));
    assert.equal(rows.filter(row=>row.fd_id===fixture.jointId).length,1);
  });
  test('direct manager view reads conceal customer/account rows in another branch',async()=>{
    const rows=(await runtime(actor(fixture.managerId,'BRANCH_MANAGER'),view)).rows;
    assert.ok(rows.every(row=>row.customer_id!==fixture.otherCustomerId));assert.equal(rows.length,5);
  });
  test('direct CUSTOMER view reads only self despite joint-account co-holders',async()=>{
    const rows=(await runtime(actor(fixture.customerLoginId,'CUSTOMER',null),view)).rows;
    assert.equal(rows.length,4);assert.ok(rows.every(row=>row.customer_id===fixture.customerId));
  });
  test('FD reads are scoped; agent lifecycle updates affect no rows and bootstrap/delete are denied',async()=>{
    const rows=(await runtime(actor(),tx=>tx.query('SELECT fd_id FROM fixed_deposit'))).rows;
    assert.equal(rows.length,4);assert.ok(!rows.some(row=>row.fd_id===fixture.otherId));
    // Metadata SELECT is now needed for the runtime FD DTO; UPDATE is RLS-hidden for an agent.
    assert.equal((await runtime(actor(),tx=>tx.query('UPDATE fixed_deposit SET status=\'CLOSED\' RETURNING fd_id'))).rowCount,0);
    for(const sql of [
      'DELETE FROM fixed_deposit','SELECT fn_install_customer_fd_summary()'])
      await assert.rejects(runtime(actor(),tx=>tx.query(sql)),error=>error.code==='42501');
    const permissions=(await client.query(`SELECT
      has_table_privilege('mims_app','fixed_deposit','INSERT') AS insert,
      has_table_privilege('mims_app','fixed_deposit','UPDATE') AS update,
      has_table_privilege('mims_app','vw_customer_fd_summary','UPDATE') AS view_update`)).rows[0];
    assert.deepEqual(permissions,{insert:true,update:false,view_update:false});
  });
  test('bankwide view has one row per actual customer/FD relation, with exact snapshot values',async()=>{
    const result=await runtime(actor(fixture.auditorId,'AUDITOR',null),tx=>tx.query(
      'SELECT customer_id,fd_id,principal_amount::text,interest_rate_at_opening::text FROM vw_customer_fd_summary WHERE customer_id=ANY($1::uuid[])',
      [[fixture.customerId,fixture.secondCustomerId,fixture.otherCustomerId]]));
    assert.equal(result.rows.length,6);assert.equal(result.rows.filter(row=>row.fd_id===fixture.jointId).length,2);
    const active=result.rows.find(row=>row.fd_id===fixture.activeId);assert.equal(active.principal_amount,'9999999999999.99');assert.equal(active.interest_rate_at_opening,'0.1375');
  });
});
