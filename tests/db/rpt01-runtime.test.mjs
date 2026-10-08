import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createActivityFixture, pool, requireDisposableDatabase } from '../helpers/agent-activity.mjs';

describe('P05-M02-T02 aggregate-only database authorization and accounting', () => {
  let client, fixture;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => { await client.query('BEGIN'); fixture = await createActivityFixture(client); });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });
  async function context(role = 'BRANCH_MANAGER', user = fixture.managerId, branch = fixture.branchId) {
    await client.query(`SELECT set_config('app.current_user_id',$1,true),
      set_config('app.current_user_role',$2,true),set_config('app.current_branch_id',$3,true)`, [user, role, branch ?? '']);
  }
  async function report(branch = null, from = '2026-09-01', to = from, agent = fixture.agentId) {
    return (await client.query(`SELECT agent_id,branch_id,transaction_count::text,
      deposit_total::text,withdrawal_total::text,interest_total::text,
      reversal_credit::text,reversal_debit::text,unresolved_reversal_count::text,net_total::text
      FROM fn_rpt01_rows($1,$2,$3,$4) ORDER BY employee_no,branch_id NULLS FIRST`, [from,to,branch,agent])).rows;
  }
  async function denied(operation, code = '42501') {
    await client.query('SAVEPOINT denied');
    try { await assert.rejects(operation, { code }); }
    finally { await client.query('ROLLBACK TO SAVEPOINT denied'); }
  }
  async function ledger(type, amount, date) {
    return (await client.query(`INSERT INTO transaction
      (account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,
       amount,transaction_date,agent_id,branch_id)
      SELECT $1,$2,channel_id,$3,$4,$5,$6,$7,$8 FROM transaction_channel
      WHERE channel_name='SYSTEM' RETURNING transaction_id`,
      [fixture.accountId,fixture.adminId,'RPT-'+randomUUID(),type,amount,date,fixture.agentId,fixture.branchId])).rows[0].transaction_id;
  }
  async function linked(originalType, amount) {
    const original = await ledger(originalType, amount, '2026-08-30T12:00:00Z');
    const reversal = await ledger('REVERSAL', amount, '2026-09-04T12:00:00Z');
    await client.query(`INSERT INTO transaction_reversal
      (original_transaction_id,reversal_transaction_id,reason,reversed_by_user_id)
      VALUES($1,$2,'Synthetic report reversal',$3)`, [original,reversal,fixture.managerId]);
  }

  test('runtime cannot read private 0520 even though aggregate functions are executable', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    await denied(() => client.query('SELECT agent_id FROM vw_rpt01_agent_transactions'));
    const rows = await report();
    assert.equal(rows.length,1); assert.equal(rows[0].deposit_total,'0.30');
    assert.equal(rows[0].transaction_count,'5'); assert.equal(rows[0].unresolved_reversal_count,'1');
    assert.equal(rows[0].net_total,null);
  });
  test('unset, unsupported and mismatched stored role contexts fail closed', async () => {
    await client.query('SET LOCAL ROLE mims_app');
    await denied(() => report());
    for (const [role,user] of [['AGENT',fixture.agentId],['CUSTOMER',fixture.customerLoginId],['ADMIN',fixture.managerId]]) {
      await context(role,user,null); await denied(() => report());
    }
  });
  test('direct manager calls cannot broaden the requested branch', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    await denied(() => report(fixture.otherBranchId));
    assert.ok((await report()).every(row => row.branch_id === fixture.branchId));
    await context('BRANCH_MANAGER',fixture.managerId,fixture.otherBranchId);
    await denied(() => report());
  });
  test('inactive caller and role are denied independently of forged context', async () => {
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[fixture.managerId]);
    await context(); await client.query('SET LOCAL ROLE mims_app'); await denied(() => report());
  });
  test('bankwide roles ignore retained inactive staff profiles', async () => {
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='AUDITOR') WHERE user_id=$1",[fixture.managerId]);
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1",[fixture.managerId]);
    await context('AUDITOR',fixture.managerId,fixture.branchId); await client.query('SET LOCAL ROLE mims_app');
    assert.equal((await report()).length,3);
  });
  test('transferred and inactive history stays with captured posting branch', async () => {
    await client.query("UPDATE agent SET branch_id=$1,status='INACTIVE' WHERE agent_id=$2",[fixture.otherBranchId,fixture.agentId]);
    await context(); await client.query('SET LOCAL ROLE mims_app');
    assert.equal((await report())[0].deposit_total,'0.30');
    assert.equal((await report(null,'2027-01-01')).length,0);
  });
  test('empty history outside a date range yields exact zero roster rows', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const row = (await report(null,'2027-01-01'))[0];
    assert.equal(row.transaction_count,'0'); assert.equal(row.deposit_total,'0.00'); assert.equal(row.net_total,'0.00');
  });
  test('inclusive Colombo bounds and totals do not depend on connection timezone', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const expected = await report();
    await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'"); assert.deepEqual(await report(),expected);
    const tomorrow = (await report(null,'2026-09-02'))[0];
    assert.equal(tomorrow.deposit_total,'9.00');
  });
  test('linked deposit/interest reversals debit and withdrawal reversals credit exact net', async () => {
    await linked('DEPOSIT','0.20'); await linked('WITHDRAWAL','1.25'); await linked('INTEREST_CREDIT','2.05');
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const row = (await report(null,'2026-09-04'))[0];
    assert.equal(row.reversal_credit,'1.25'); assert.equal(row.reversal_debit,'2.25');
    assert.equal(row.unresolved_reversal_count,'0'); assert.equal(row.net_total,'-1.00');
  });
  test('huge NUMERIC aggregates preserve every cent beyond JS safe integers', async () => {
    await client.query(`INSERT INTO transaction (account_id,initiated_by_user_id,channel_id,reference_number,
      transaction_type,amount,transaction_date,agent_id,branch_id)
      SELECT $1,$2,channel_id,$3::text||n::text,'DEPOSIT',9999999999999.99,
      '2026-09-10T12:00:00Z',$4,$5 FROM transaction_channel CROSS JOIN generate_series(1,1000) n
      WHERE channel_name='SYSTEM'`,[fixture.accountId,fixture.adminId,'RPT-HUGE-'+randomUUID(),fixture.agentId,fixture.branchId]);
    await ledger('DEPOSIT','0.01','2026-09-10T12:00:00Z');
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const row = (await report(null,'2026-09-10'))[0];
    assert.equal(row.deposit_total,'9999999999999990.01'); assert.equal(row.transaction_count,'1001');
  });
  test('exclusion totals disclose unattributed rows without inferring an agent', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const row = (await client.query(`SELECT transaction_count::text,unsigned_value::text
      FROM fn_rpt01_exclusions('2026-09-01','2026-09-01',NULL)`)).rows[0];
    assert.deepEqual(row,{transaction_count:'1',unsigned_value:'200.00'});
  });
  test('direct callers must supply finite ordered dates', async () => {
    await context(); await client.query('SET LOCAL ROLE mims_app');
    await denied(() => report(null,'2026-09-02','2026-09-01'),'22023');
    await denied(() => report(null,'infinity','infinity'),'22023');
  });
  test('final aggregate query completes within five seconds with 20000 out-of-range postings', async () => {
    await client.query(`INSERT INTO transaction (account_id,initiated_by_user_id,channel_id,reference_number,
      transaction_type,amount,transaction_date,agent_id,branch_id)
      SELECT $1,$2,channel_id,$3::text||n::text,'DEPOSIT',1.00,
      '2025-01-01T12:00:00Z',$4,$5 FROM transaction_channel CROSS JOIN generate_series(1,20000) n
      WHERE channel_name='SYSTEM'`,[fixture.accountId,fixture.adminId,'RPT-PERF-'+randomUUID(),fixture.agentId,fixture.branchId]);
    await client.query('ANALYZE transaction');
    await context(); await client.query('SET LOCAL ROLE mims_app');
    const plan=(await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT agent_id,deposit_total,net_total FROM fn_rpt01_rows('2026-09-01','2026-09-01',NULL,$1)`,[fixture.agentId])).rows[0]['QUERY PLAN'];
    assert.ok(plan[0]['Execution Time']<5000);
    assert.equal((await report())[0].deposit_total,'0.30');
    await writeFile('test-results/rpt01-runtime-explain.json',JSON.stringify(plan,null,2));
  });
});
