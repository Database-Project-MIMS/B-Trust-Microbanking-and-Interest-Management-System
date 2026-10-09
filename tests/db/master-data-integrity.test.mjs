import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, rejectsSql } from '../helpers/customer-relations.mjs';

// Fixed identifier allow-list: none of these identifiers comes from a request.
const tables = {
  branch: { pk: 'branch_id', required: ['branch_id', 'branch_code', 'branch_name', 'address', 'district', 'phone', 'status', 'created_at', 'updated_at'],
    constraints: ['branch_pkey', 'uq_branch_branch_code'] },
  agent: { pk: 'agent_id', required: ['agent_id', 'branch_id', 'employee_no', 'nic_passport_no', 'full_name', 'date_of_birth', 'gender', 'phone', 'address', 'email', 'hired_date', 'status', 'created_at', 'updated_at'],
    constraints: ['agent_pkey', 'fk_agent_app_user', 'fk_agent_branch', 'uq_agent_employee_no', 'uq_agent_nic_passport_no', 'uq_agent_email'] },
  customer: { pk: 'customer_id', required: ['customer_id', 'branch_id', 'customer_number', 'nic_passport_no', 'full_name', 'date_of_birth', 'email', 'status', 'created_at', 'updated_at'],
    optional: ['app_user_id', 'gender', 'phone', 'address'],
    constraints: ['customer_pkey', 'uq_customer_app_user_id', 'uq_customer_number', 'uq_customer_nic_passport_no', 'uq_customer_email', 'fk_customer_app_user', 'fk_customer_branch', 'ck_customer_birth_date_past', 'ck_customer_status'] },
  customer_agent: { pk: 'cust_agent_id', required: ['cust_agent_id', 'customer_id', 'agent_id', 'assigned_date', 'is_active', 'created_at', 'updated_at'],
    optional: ['end_date'],
    constraints: ['customer_agent_pkey', 'fk_customer_agent_customer', 'fk_customer_agent_agent', 'ck_customer_agent_dates'] },
  customer_document: { pk: 'doc_id', required: ['doc_id', 'customer_id', 'doc_type', 'file_path', 'uploaded_date', 'created_at', 'updated_at'],
    optional: ['verified_by', 'verified_date'],
    constraints: ['customer_document_pkey', 'fk_customer_document_customer', 'fk_customer_document_verifier', 'ck_customer_document_verification'] },
};

describe('P06-M02-T02: master-data integrity against direct SQL', () => {
  let client, fixture, rows;
  before(async () => { client = await pool.connect(); });
  beforeEach(async () => {
    await client.query('BEGIN');
    fixture = await createFixture(client);
    await client.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2', [fixture.customerLoginId, fixture.customerId]);
    const assignment = await fixture.assignment();
    const document = await fixture.document();
    const ids = { branch: fixture.branchId, agent: fixture.agentId, customer: fixture.customerId,
      customer_agent: assignment.cust_agent_id, customer_document: document.doc_id };
    rows = {};
    for (const [table, { pk }] of Object.entries(tables)) {
      const result = await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${pk}=$1`, [ids[table]]);
      rows[table] = result.rows[0].row;
    }
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });

  async function insert(table, overrides = {}) {
    const marker = randomUUID().replaceAll('-', '').slice(0, 12);
    const value = { ...rows[table], [tables[table].pk]: randomUUID() };
    if (table === 'branch') value.branch_code = `MD-${marker}`;
    if (table === 'agent') Object.assign(value, { agent_id: await fixture.staff('ADMIN'),
      employee_no: `MD-${marker}`, nic_passport_no: `MD-${marker}`, email: `md-${marker}@example.invalid`, status: 'INACTIVE' });
    if (table === 'customer') Object.assign(value, { customer_number: `MD-${marker}`,
      nic_passport_no: `MD-${marker}`, email: `md-${marker}@example.invalid`, app_user_id: null });
    if (table === 'customer_agent') value.is_active = false;
    Object.assign(value, overrides);
    const columns = [...tables[table].required, ...(tables[table].optional ?? [])];
    return client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${tables[table].pk} AS id`,
      columns.map(column => value[column]));
  }
  async function update(table, column, value) {
    return client.query(`UPDATE ${table} SET ${column}=$1 WHERE ${tables[table].pk}=$2`, [value, rows[table][tables[table].pk]]);
  }
  async function retained(table) {
    const result = await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${tables[table].pk}=$1`, [rows[table][tables[table].pk]]);
    assert.deepEqual(result.rows.map(resultRow => resultRow.row), [rows[table]]);
  }

  test('coverage manifest matches every Phase 1–2 master constraint and required column', async () => {
    for (const [table, expected] of Object.entries(tables)) {
      const constraints = await client.query(`SELECT c.conname FROM pg_constraint c
        JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname='public' AND t.relname=$1 AND c.contype IN ('p','u','f','c')`, [table]);
      assert.deepEqual(constraints.rows.map(row => row.conname).sort(), [...expected.constraints].sort(), table);
      const required = await client.query(`SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO'`, [table]);
      assert.deepEqual(required.rows.map(row => row.column_name).sort(), [...expected.required].sort(), table);
    }
  });

  for (const [table, { pk, required }] of Object.entries(tables)) {
    test(`${table}: duplicate primary key is rejected`, async () => {
      await rejectsSql(client, () => insert(table, { [pk]: rows[table][pk] }), '23505', `${table}_pkey`);
      await retained(table);
    });
    for (const column of required) {
      test(`${table}.${column}: explicit NULL cannot bypass NOT NULL`, async () => {
        await rejectsSql(client, () => insert(table, { [column]: null }), '23502', column, 'column');
        await retained(table);
      });
    }
  }

  const unique = [
    ['branch', 'branch_code', 'uq_branch_branch_code'],
    ['agent', 'employee_no', 'uq_agent_employee_no'], ['agent', 'nic_passport_no', 'uq_agent_nic_passport_no'], ['agent', 'email', 'uq_agent_email'],
    ['customer', 'customer_number', 'uq_customer_number'], ['customer', 'nic_passport_no', 'uq_customer_nic_passport_no'],
    ['customer', 'email', 'uq_customer_email'], ['customer', 'app_user_id', 'uq_customer_app_user_id'],
  ];
  for (const [table, column, constraint] of unique) {
    test(`${table}.${column}: duplicate insert rejects ${constraint}`, async () => {
      await rejectsSql(client, () => insert(table, { [column]: rows[table][column] }), '23505', constraint);
      await retained(table);
    });
    test(`${table}.${column}: duplicate update rejects ${constraint}`, async () => {
      const other = await insert(table);
      await rejectsSql(client, () => client.query(`UPDATE ${table} SET ${column}=$1 WHERE ${tables[table].pk}=$2`,
        [rows[table][column], other.rows[0].id]), '23505', constraint);
      await retained(table);
    });
  }

  for (const [table, column, constraint] of [
    ['agent', 'branch_id', 'fk_agent_branch'], ['agent', 'agent_id', 'fk_agent_app_user'],
    ['customer', 'branch_id', 'fk_customer_branch'], ['customer', 'app_user_id', 'fk_customer_app_user'],
    ['customer_agent', 'customer_id', 'fk_customer_agent_customer'], ['customer_agent', 'agent_id', 'fk_customer_agent_agent'],
    ['customer_document', 'customer_id', 'fk_customer_document_customer'], ['customer_document', 'verified_by', 'fk_customer_document_verifier'],
  ]) {
    test(`${table}.${column}: nonexistent parent cannot be inserted`, async () => {
      const overrides = { [column]: randomUUID() };
      if (column === 'verified_by') overrides.verified_date = '2020-01-01T00:00:00Z';
      await rejectsSql(client, () => insert(table, overrides), '23503', constraint);
      await retained(table);
    });
  }

  for (const table of ['branch', 'agent', 'customer']) {
    test(`${table}: invalid lifecycle status cannot be inserted`, async () => {
      await rejectsSql(client, () => insert(table, { status: 'DELETED' }), '23514',
        table === 'customer' ? 'ck_customer_status' : 'record_status_check');
      await retained(table);
    });
  }
  test('customer: today and future birth dates fail on INSERT and UPDATE', async () => {
    const dates = await client.query('SELECT CURRENT_DATE::text AS today, (CURRENT_DATE+1)::text AS future');
    for (const date of Object.values(dates.rows[0])) {
      await rejectsSql(client, () => insert('customer', { date_of_birth: date }), '23514', 'ck_customer_birth_date_past');
      await rejectsSql(client, () => update('customer', 'date_of_birth', date), '23514', 'ck_customer_birth_date_past');
    }
    await retained('customer');
  });
  test('assignment: second active INSERT and history reactivation both fail; history remains', async () => {
    await rejectsSql(client, () => insert('customer_agent', { agent_id: fixture.secondAgentId, is_active: true }), '23505', 'ux_customer_agent_one_active');
    const history = await fixture.assignment({ is_active: false, end_date: '2021-01-01' });
    await rejectsSql(client, () => client.query('UPDATE customer_agent SET is_active=true WHERE cust_agent_id=$1', [history.cust_agent_id]), '23505', 'ux_customer_agent_one_active');
    const counts = await client.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active FROM customer_agent WHERE customer_id=$1', [fixture.customerId]);
    assert.deepEqual(counts.rows[0], { total: 2, active: 1 });
    await retained('customer_agent');
  });
  test('assignment: invalid date interval fails on INSERT and UPDATE', async () => {
    await rejectsSql(client, () => insert('customer_agent', { end_date: '2019-12-31' }), '23514', 'ck_customer_agent_dates');
    await rejectsSql(client, () => update('customer_agent', 'end_date', '2019-12-31'), '23514', 'ck_customer_agent_dates');
    await retained('customer_agent');
  });
  test('document: both forms of half-verification fail on INSERT and UPDATE', async () => {
    for (const [column, value] of [['verified_by', fixture.managerId], ['verified_date', '2020-01-01T00:00:00Z']]) {
      await rejectsSql(client, () => insert('customer_document', { [column]: value }), '23514', 'ck_customer_document_verification');
      await rejectsSql(client, () => update('customer_document', column, value), '23514', 'ck_customer_document_verification');
    }
    await retained('customer_document');
  });
  test('document: verified metadata cannot lose only its date or verifier', async () => {
    await client.query('UPDATE customer_document SET verified_by=$1, verified_date=$2 WHERE doc_id=$3', [fixture.managerId, '2020-01-01T00:00:00Z', rows.customer_document.doc_id]);
    for (const column of ['verified_by', 'verified_date']) {
      await rejectsSql(client, () => update('customer_document', column, null), '23514', 'ck_customer_document_verification');
    }
  });
  test('active-branch triggers reject deactivation and transfer without changing the graph', async () => {
    await rejectsSql(client, () => update('branch', 'status', 'INACTIVE'), '23514', 'ck_branch_no_active_agents');
    const inactiveBranch = await client.query(`INSERT INTO branch(branch_code,branch_name,address,district,phone,status)
      VALUES ($1,'Synthetic Inactive','Synthetic','Colombo','0110000000','INACTIVE') RETURNING branch_id`, [`MD-${randomUUID().slice(0, 8)}`]);
    await rejectsSql(client, () => update('agent', 'branch_id', inactiveBranch.rows[0].branch_id), '23514', 'ck_agent_active_branch');
    await retained('branch'); await retained('agent');
  });

  for (const [parent, child, constraint] of [
    ['branch', 'agent', 'fk_agent_branch'], ['branch', 'customer', 'fk_customer_branch'],
    ['agent', 'customer_agent', 'fk_customer_agent_agent'],
    ['customer', 'customer_agent', 'fk_customer_agent_customer'], ['customer', 'customer_document', 'fk_customer_document_customer'],
  ]) {
    for (const inactive of [false, true]) {
      test(`${parent}: ${inactive ? 'inactive' : 'active'} ${child} reference prevents DELETE`, async () => {
        // Isolate each inbound FK so a different child cannot make this test pass.
        const branchId = await client.query(`INSERT INTO branch(branch_code,branch_name,address,district,phone)
          VALUES ($1,'Synthetic Delete Probe','Synthetic','Colombo','0110000000') RETURNING branch_id`, [`MD-${randomUUID().slice(0, 8)}`]);
        let id = branchId.rows[0].branch_id;
        if (parent === 'branch' && child === 'agent') {
          const agentId = await fixture.staff('AGENT', id);
          if (inactive) await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1", [agentId]);
        } else {
          const customerId = await fixture.customer(id);
          if (inactive) await client.query("UPDATE customer SET status='INACTIVE' WHERE customer_id=$1", [customerId]);
          if (parent !== 'branch') id = customerId;
          if (child === 'customer_agent') {
            const agentId = await fixture.staff('AGENT', branchId.rows[0].branch_id);
            await fixture.assignment({ customer_id: customerId, agent_id: agentId, is_active: !inactive });
            if (parent === 'agent') id = agentId;
          }
          if (child === 'customer_document') await fixture.document({ customer_id: customerId });
        }
        await rejectsSql(client, () => client.query(`DELETE FROM ${parent} WHERE ${tables[parent].pk}=$1`, [id]), ['23001', '23503'], constraint);
        const result = await client.query(`SELECT ${tables[parent].pk} FROM ${parent} WHERE ${tables[parent].pk}=$1`, [id]);
        assert.equal(result.rowCount, 1);
      });
    }
  }
  for (const [label, user, constraint] of [
    ['agent login', 'agentId', 'fk_agent_app_user'], ['customer login', 'customerLoginId', 'fk_customer_app_user'],
    ['document verifier', 'otherManagerId', 'fk_customer_document_verifier'],
  ]) {
    test(`${label}: its referenced user cannot be deleted`, async () => {
      let id = fixture[user];
      if (label === 'document verifier') {
        id = await fixture.staff('ADMIN'); // No staff-profile FK competes with this verifier FK.
        await client.query('UPDATE customer_document SET verified_by=$1, verified_date=now() WHERE doc_id=$2', [id, rows.customer_document.doc_id]);
      }
      await rejectsSql(client, () => client.query('DELETE FROM app_user WHERE user_id=$1', [id]), ['23001', '23503'], constraint);
    });
  }
  test('customer deactivation retains assignment/document identity and optional login', async () => {
    await update('customer', 'status', 'INACTIVE');
    const result = await client.query('SELECT customer_id, app_user_id, status FROM customer WHERE customer_id=$1', [fixture.customerId]);
    assert.deepEqual(result.rows[0], { customer_id: fixture.customerId, app_user_id: fixture.customerLoginId, status: 'INACTIVE' });
    await retained('customer_agent'); await retained('customer_document');
  });
});
