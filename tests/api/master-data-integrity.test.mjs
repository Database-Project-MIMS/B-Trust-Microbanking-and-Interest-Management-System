import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createFixture, pool, registrationInput, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
const branches = await import('../../app/api/branches/route.ts');
const branchItem = await import('../../app/api/branches/[id]/route.ts');
const agents = await import('../../app/api/agents/route.ts');
const agentItem = await import('../../app/api/agents/[id]/route.ts');
const customers = await import('../../app/api/customers/route.ts');
const customerItem = await import('../../app/api/customers/[id]/route.ts');

describe('P06-M02-T02: master-data retention and rollback through mims_app APIs', () => {
  let client, fixture, restore, tokens;
  const csrf = randomBytes(32).toString('hex');
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
    const runtime = await pool.query('SELECT current_user AS role');
    assert.equal(runtime.rows[0].role, 'mims_app', 'API calls must use the least-privilege application role.');
  });
  beforeEach(async () => {
    await client.query('BEGIN');
    try {
      fixture = await createFixture(client);
      const adminId = await fixture.staff('ADMIN');
      tokens = {};
      for (const [name, id] of Object.entries({ admin: adminId, manager: fixture.managerId,
        agent: fixture.agentId, otherManager: fixture.otherManagerId })) {
        const token = randomBytes(32).toString('hex');
        await client.query(`INSERT INTO user_session(user_id,token_hash,expires_at)
          VALUES ($1,$2,now()+interval '1 hour')`, [id, createHash('sha256').update(token).digest('hex')]);
        tokens[name] = token;
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });

  function request(method, path, body, role = 'admin', csrfHeader = csrf) {
    const headers = { cookie: `mims_session=${tokens[role]}; mims_csrf=${csrf}` };
    if (csrfHeader) headers['x-csrf-token'] = csrfHeader;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return new NextRequest(`http://localhost${path}`, { method, headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  function patch(route, id, body, role = 'admin', csrfHeader = csrf) {
    return route.PATCH(request('PATCH', '/api/master-data', body, role, csrfHeader), { params: Promise.resolve({ id }) });
  }
  async function snapshot() {
    const result = await client.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(b) ORDER BY branch_id) FROM branch b) AS branches,
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY agent_id) FROM agent a) AS agents,
      (SELECT jsonb_agg(to_jsonb(u) - 'password_hash' ORDER BY user_id) FROM app_user u) AS users,
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY customer_id) FROM customer c) AS customers,
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY cust_agent_id) FROM customer_agent a) AS assignments,
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY doc_id) FROM customer_document d) AS documents,
      (SELECT count(*)::text FROM audit_log) AS audits`);
    return result.rows[0];
  }
  async function failsUnchanged(operation, status, code) {
    const original = await snapshot();
    const response = await operation();
    assert.equal(response.status, status, JSON.stringify(await response.clone().json()));
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, 'string');
    assert.ok(!/SELECT |INSERT |UPDATE |constraint|235\d\d|password_hash|postgresql:|stack/i.test(body.error.message));
    assert.deepEqual(await snapshot(), original, 'Rejected API call changed master rows or audit count.');
  }
  async function createCustomer() {
    const input = registrationInput(fixture);
    const response = await customers.POST(request('POST', '/api/customers', input, 'agent'));
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return { input, ...((await response.json()).data) };
  }
  async function agentRow(id = fixture.agentId) {
    const result = await client.query(`SELECT a.agent_id,a.employee_no,a.nic_passport_no,a.email,a.status,
      u.status AS login_status FROM agent a JOIN app_user u ON u.user_id=a.agent_id WHERE a.agent_id=$1`, [id]);
    assert.equal(result.rowCount, 1);
    return result.rows[0];
  }
  function agentPayload() {
    const marker = randomBytes(6).toString('hex');
    return { branchId: fixture.branchId, username: `mdi-${marker}`, password: 'Synthetic-Test-Password-123!',
      employeeNo: `MDI-${marker}`, nicPassportNo: `MDI-${marker}`, fullName: 'Synthetic Integrity Agent',
      dateOfBirth: '1990-01-01', gender: 'OTHER', phone: '0110000000', address: 'Synthetic Road',
      email: `mdi-${marker}@example.invalid`, hiredDate: '2020-01-01' };
  }

  test('duplicate branch code returns 409 without a row or audit effect', async () => {
    const result = await client.query('SELECT branch_code FROM branch WHERE branch_id=$1', [fixture.branchId]);
    await failsUnchanged(() => branches.POST(request('POST', '/api/branches', {
      branchCode: result.rows[0].branch_code, branchName: 'Synthetic Duplicate', address: 'Synthetic', district: 'Colombo', phone: '0110000000',
    })), 409, 'DUPLICATE_BRANCH_CODE');
  });
  for (const [field, column, code] of [
    ['employeeNo', 'employee_no', 'DUPLICATE_EMPLOYEE_NO'],
    ['nicPassportNo', 'nic_passport_no', 'DUPLICATE_IDENTITY'], ['email', 'email', 'DUPLICATE_EMAIL'],
  ]) {
    test(`duplicate agent ${field} rolls back login/profile/audit creation`, async () => {
      const row = await agentRow();
      await failsUnchanged(() => agents.POST(request('POST', '/api/agents', { ...agentPayload(), [field]: row[column] })), 409, code);
    });
    test(`agent status change followed by duplicate ${field} rolls back the login too`, async () => {
      const other = await agentRow(fixture.secondAgentId);
      await failsUnchanged(() => patch(agentItem, fixture.agentId, { status: 'INACTIVE', [field]: other[column] }), 409, code);
      assert.equal((await agentRow()).login_status, 'ACTIVE');
    });
  }
  for (const [field, code] of [['nicPassportNo', 'DUPLICATE_IDENTITY'], ['email', 'DUPLICATE_EMAIL']]) {
    test(`normalized duplicate customer ${field} rolls back every registration row and audit`, async () => {
      const original = await createCustomer();
      const value = field === 'email' ? original.input[field].toUpperCase() : original.input[field].toLowerCase();
      await failsUnchanged(() => customers.POST(request('POST', '/api/customers',
        registrationInput(fixture, { [field]: value }), 'agent')), 409, code);
    });
  }
  for (const role of ['admin', 'manager']) {
    test(`${role} deactivation retains referenced agent/login, customer, documents and assignment history`, async () => {
      const customer = await createCustomer();
      await fixture.assignment({ customer_id: customer.customerId, is_active: false, end_date: '2021-01-01' });
      const original = await snapshot();
      const response = await patch(agentItem, fixture.agentId, { status: 'INACTIVE' }, role);
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      assert.equal((await response.json()).data.agentId, fixture.agentId);
      const row = await agentRow();
      assert.equal(row.status, 'INACTIVE'); assert.equal(row.login_status, 'INACTIVE');
      const afterState = await snapshot();
      assert.deepEqual(afterState.customers, original.customers);
      assert.deepEqual(afterState.assignments, original.assignments);
      assert.deepEqual(afterState.documents, original.documents);
      const listed = await agents.GET(request('GET', '/api/agents?status=INACTIVE', undefined, 'manager'));
      assert.equal(listed.status, 200);
      assert.ok((await listed.json()).data.some(agent => agent.agentId === fixture.agentId));
      const profile = await customerItem.GET(request('GET', '/api/customers', undefined, 'manager'), { params: Promise.resolve({ id: customer.customerId }) });
      assert.equal(profile.status, 200);
      assert.equal((await profile.json()).data.assignmentHistory.length, 2);
      const audit = await client.query(`SELECT entity_type,old_values,new_values FROM audit_log
        WHERE entity_id=$1 AND action='UPDATE' ORDER BY entity_type`, [fixture.agentId]);
      assert.deepEqual(audit.rows.map(event => event.entity_type), ['agent', 'app_user']);
      for (const event of audit.rows) {
        assert.equal(event.old_values.status, 'ACTIVE'); assert.equal(event.new_values.status, 'INACTIVE');
        assert.ok(!('password_hash' in event.new_values) && !('nic_passport_no' in event.new_values));
      }
      await failsUnchanged(() => customers.GET(request('GET', '/api/customers', undefined, 'agent')), 401, 'UNAUTHORIZED');
    });
  }
  test('branch deactivation preserves its customer FK and remains queryable', async () => {
    const marker = randomBytes(6).toString('hex');
    const created = await branches.POST(request('POST', '/api/branches', {
      branchCode: `MDI-${marker}`, branchName: 'Synthetic Retention Branch', address: 'Synthetic Road', district: 'Colombo', phone: '0110000000',
    }));
    assert.equal(created.status, 201);
    const branchId = (await created.json()).data.branchId;
    const customerId = await fixture.customer(branchId);
    const response = await patch(branchItem, branchId, { status: 'INACTIVE' });
    assert.equal(response.status, 200); assert.equal((await response.json()).data.branchId, branchId);
    const listed = await branches.GET(request('GET', '/api/branches?status=INACTIVE'));
    assert.equal(listed.status, 200);
    assert.ok((await listed.json()).data.some(branch => branch.branchId === branchId));
    const customer = await client.query('SELECT branch_id FROM customer WHERE customer_id=$1', [customerId]);
    assert.equal(customer.rows[0].branch_id, branchId);
    await failsUnchanged(() => agents.POST(request('POST', '/api/agents', { ...agentPayload(), branchId })), 409, 'BRANCH_NOT_ACTIVE');
  });
  test('branch with active profiles cannot be deactivated or partially updated', async () => {
    await failsUnchanged(() => patch(branchItem, fixture.branchId, { status: 'INACTIVE', branchName: 'Must roll back' }), 409, 'BRANCH_HAS_ACTIVE_AGENTS');
  });
  test('inactive customer remains queryable with documents and assignments', async () => {
    const customer = await createCustomer();
    const original = await snapshot();
    await client.query("UPDATE customer SET status='INACTIVE' WHERE customer_id=$1", [customer.customerId]);
    const profile = await customerItem.GET(request('GET', '/api/customers', undefined, 'manager'), { params: Promise.resolve({ id: customer.customerId }) });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).data.customer.status, 'INACTIVE');
    const listed = await customers.GET(request('GET', `/api/customers?status=INACTIVE&q=${customer.customerNumber}`, undefined, 'manager'));
    assert.equal(listed.status, 200); assert.equal((await listed.json()).data.total, 1);
    const afterState = await snapshot();
    assert.deepEqual(afterState.assignments, original.assignments); assert.deepEqual(afterState.documents, original.documents);
  });
  test('cross-branch deactivation and missing CSRF leave every master row unchanged', async () => {
    await failsUnchanged(() => patch(agentItem, fixture.agentId, { status: 'INACTIVE' }, 'otherManager'), 403, 'NOT_AUTHORIZED');
    await failsUnchanged(() => patch(agentItem, fixture.agentId, { status: 'INACTIVE' }, 'admin', null), 403, 'FORBIDDEN');
    await failsUnchanged(() => patch(branchItem, fixture.branchId, { status: 'INACTIVE' }, 'admin', null), 403, 'FORBIDDEN');
  });
  test('master-data controllers expose no physical DELETE handler or unimplemented customer PATCH', () => {
    for (const route of [branches, branchItem, agents, agentItem, customers, customerItem]) assert.equal(route.DELETE, undefined);
    assert.equal(customerItem.PATCH, undefined);
  });
});
