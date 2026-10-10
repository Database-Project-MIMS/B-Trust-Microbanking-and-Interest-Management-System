import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';

describe('P02-M02-T05: migrated customer child grants and RLS', () => {
  let client, fixture, otherCustomer;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => {
    await client.query('BEGIN'); fixture = await createFixture(client);
    otherCustomer = await fixture.customer(fixture.otherBranchId);
    await fixture.assignment(); await fixture.document();
    await fixture.assignment({ customer_id: otherCustomer, agent_id: fixture.otherManagerId });
    await fixture.document({ customer_id: otherCustomer });
    await client.query('SET LOCAL ROLE mims_app');
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });
  async function context(role = 'AGENT', userId = fixture.agentId, branchId = fixture.branchId) {
    await client.query("SELECT set_config('app.current_user_role',$1,true), set_config('app.current_user_id',$2,true), set_config('app.current_branch_id',$3,true)",
      [role, userId, branchId ?? '']);
  }
  async function denied(sql, params = [], code = '42501') {
    await client.query('SAVEPOINT denied');
    try { await assert.rejects(() => client.query(sql, params), { code }); }
    finally { await client.query('ROLLBACK TO SAVEPOINT denied'); }
  }
  test('without RLS context both child tables return no rows', async () => {
    for (const table of ['customer_agent', 'customer_document']) {
      assert.equal((await client.query(`SELECT customer_id FROM ${table}`)).rows.length, 0);
    }
  });
  test('branch scope is enforced when services are bypassed', async () => {
    await context();
    for (const table of ['customer_agent', 'customer_document']) {
      const rows = (await client.query(`SELECT customer_id FROM ${table} WHERE customer_id=ANY($1::uuid[])`, [[fixture.customerId, otherCustomer]])).rows;
      assert.deepEqual(rows, [{ customer_id: fixture.customerId }]);
    }
    await denied('INSERT INTO customer_document(customer_id,doc_type,file_path) VALUES($1,$2,$3)', [otherCustomer, 'NIC', 'synthetic/x']);
    await denied('INSERT INTO customer_agent(customer_id,agent_id) VALUES($1,$2)', [otherCustomer, fixture.agentId]);
  });
  test('agent cannot insert assignments for another agent or mark a document verified', async () => {
    await context();
    await denied('INSERT INTO customer_agent(customer_id,agent_id,is_active) VALUES($1,$2,false)', [fixture.customerId, fixture.secondAgentId]);
    await denied('INSERT INTO customer_document(customer_id,doc_type,file_path,verified_by,verified_date) VALUES($1,$2,$3,$4,now())',
      [fixture.customerId, 'NIC', 'synthetic/x', fixture.managerId]);
  });
  test('reader roles can see both branches but cannot insert metadata', async () => {
    for (const role of ['CENTRAL_OPS', 'AUDITOR']) {
      await context(role, fixture.customerLoginId, null);
      assert.equal((await client.query('SELECT customer_id FROM customer_document WHERE customer_id=ANY($1::uuid[])', [[fixture.customerId, otherCustomer]])).rows.length, 2);
      await denied('INSERT INTO customer_document(customer_id,doc_type,file_path) VALUES($1,$2,$3)', [fixture.customerId, 'NIC', 'synthetic/x']);
    }
  });
  test('migration grants no child UPDATE/DELETE or role UPDATE', async () => {
    for (const table of ['customer_agent', 'customer_document']) {
      const result = await client.query("SELECT has_table_privilege('mims_app',$1,'SELECT') AS read, has_table_privilege('mims_app',$1,'INSERT') AS insert, has_table_privilege('mims_app',$1,'UPDATE') AS update, has_table_privilege('mims_app',$1,'DELETE') AS delete", [table]);
      assert.deepEqual(result.rows[0], { read: true, insert: true, update: false, delete: false });
    }
    assert.equal((await client.query("SELECT has_table_privilege('mims_app','role','UPDATE') AS allowed")).rows[0].allowed, false);
  });
});
