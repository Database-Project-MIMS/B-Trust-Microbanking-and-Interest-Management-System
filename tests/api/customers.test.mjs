import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { counts, createFixture, pool, registrationInput, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
const { GET, POST } = await import('../../app/api/customers/route.ts');
const { GET: PROFILE } = await import('../../app/api/customers/[id]/route.ts');

describe('P02-M02-T05: session-authenticated customer routes under mims_app', () => {
  let client, fixture, restore, agentToken, managerToken;
  const csrf = randomBytes(32).toString('hex');
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
  });
  beforeEach(async () => {
    fixture = await createFixture(client);
    agentToken = await session(fixture.agentId); managerToken = await session(fixture.managerId);
  });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });
  async function session(userId) {
    const token = randomBytes(32).toString('hex');
    await client.query("INSERT INTO user_session(user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '1 hour')",
      [userId, createHash('sha256').update(token).digest('hex')]);
    return token;
  }
  function request(method = 'GET', token = agentToken, body, query = '', csrfHeader = csrf) {
    const headers = { cookie: `mims_csrf=${csrf}${token ? `; mims_session=${token}` : ''}` };
    if (csrfHeader) headers['x-csrf-token'] = csrfHeader;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(`http://localhost/api/customers${query}`, { method, headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  }
  async function create(input = registrationInput(fixture), token = agentToken) {
    const response = await POST(request('POST', token, input));
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return (await response.json()).data;
  }
  function profile(id, token = agentToken) { return PROFILE(request('GET', token), { params: Promise.resolve({ id }) }); }
  async function failsWithoutWrites(operation, status) {
    const baseline = await counts(client); const response = await operation();
    assert.equal(response.status, status);
    const body = await response.json(); assert.ok(body.error.code && body.error.message);
    assert.ok(!/SELECT |INSERT |constraint|password|postgresql:/i.test(body.error.message));
    assert.deepEqual(await counts(client), baseline);
    return body;
  }
  test('register → filtered search → profile returns safe data and exactly one attributed audit', async () => {
    const input = registrationInput(fixture); const baseline = await counts(client);
    const created = await create(input);
    assert.deepEqual(await counts(client), { customers: baseline.customers + 1, assignments: baseline.assignments + 1,
      documents: baseline.documents + 2, audits: baseline.audits + 1 });
    const search = await GET(request('GET', agentToken, undefined, `?q=${created.customerNumber}&page=1&pageSize=10`));
    assert.equal(search.status, 200); const listed = (await search.json()).data;
    assert.equal(listed.total, 1); assert.equal(listed.pageSize, 10);
    assert.equal(listed.customers[0].nicPassportNo, `***${input.nicPassportNo.slice(-4)}`);
    const response = await profile(created.customerId); assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.assignmentHistory[0].agentId, fixture.agentId);
    assert.equal(data.documents.length, 2); assert.deepEqual(data.accounts, []);
    assert.ok(data.documents.every(doc => !('filePath' in doc) && doc.verifiedBy === null));
    const audit = await client.query('SELECT user_id,new_values FROM audit_log WHERE entity_id=$1', [created.customerId]);
    assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].user_id, fixture.agentId);
    assert.equal(audit.rows[0].new_values.nic_passport_no, `****${input.nicPassportNo.slice(-4)}`);
  });
  test('manager assigns another active local agent, whose customer is hidden from the first agent', async () => {
    const created = await create(registrationInput(fixture, { agentId: fixture.secondAgentId }), managerToken);
    assert.equal((await (await GET(request())).json()).data.total, 0);
    assert.equal((await (await GET(request('GET', managerToken, undefined, `?q=${created.customerNumber}`))).json()).data.total, 1);
    assert.equal((await profile(created.customerId, managerToken)).status, 200);
    await failsWithoutWrites(() => profile(created.customerId), 404);
  });
  test('bank-wide readers retain full identity and cannot mutate customers', async () => {
    const input = registrationInput(fixture); const created = await create(input);
    for (const role of ['CENTRAL_OPS', 'AUDITOR']) {
      const token = await session(await fixture.staff(role));
      const response = await profile(created.customerId, token); assert.equal(response.status, 200);
      assert.equal((await response.json()).data.customer.nicPassportNo, input.nicPassportNo);
      await failsWithoutWrites(() => POST(request('POST', token, registrationInput(fixture))), 403);
    }
  });
  test('anonymous, invalid, expired, revoked and inactive sessions fail closed', async () => {
    for (const token of [null, 'invalid']) await failsWithoutWrites(() => GET(request('GET', token)), 401);
    await client.query("UPDATE user_session SET expires_at=now()-interval '1 second' WHERE user_id=$1", [fixture.agentId]);
    await failsWithoutWrites(() => GET(request()), 401);
    agentToken = await session(fixture.agentId);
    await client.query('UPDATE user_session SET revoked_at=now() WHERE user_id=$1', [fixture.agentId]);
    await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture))), 401);
    agentToken = await session(fixture.agentId);
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1", [fixture.agentId]);
    await failsWithoutWrites(() => GET(request()), 401);
  });
  test('missing and mismatched CSRF tokens cannot create any rows', async () => {
    for (const header of [null, randomBytes(32).toString('hex')]) {
      await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture), '', header)), 403);
    }
  });
  test('malformed JSON and client-controlled role/login/verification fields are rejected', async () => {
    await failsWithoutWrites(() => POST(request('POST', agentToken, '{')), 400);
    for (const extra of [{ roleName: 'BRANCH_MANAGER' }, { appUserId: fixture.customerLoginId },
      { documents: [{ docType: 'NIC', filePath: 'synthetic/x', verifiedBy: fixture.managerId }] }]) {
      await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture, extra))), 400);
    }
  });
  test('invalid, repeated or injection-bearing query identifiers are rejected safely', async () => {
    for (const query of ['?page=0', '?pageSize=101', '?page=1&page=2', '?branchId=invalid',
      '?sortBy=full_name%3BDROP%20TABLE%20customer', '?unexpected=x', '?sortDirection=desc%3B--']) {
      await failsWithoutWrites(() => GET(request('GET', agentToken, undefined, query)), 400);
    }
    await failsWithoutWrites(() => profile('invalid'), 400);
    await failsWithoutWrites(() => profile(randomUUID()), 404);
  });
  test('branch and assignment spoofing cannot widen write/read scope', async () => {
    const created = await create();
    await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture, { branchId: fixture.otherBranchId }))), 403);
    await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture, { agentId: fixture.secondAgentId }))), 403);
    const other = await session(fixture.otherManagerId);
    await failsWithoutWrites(() => profile(created.customerId, other), 404);
    await failsWithoutWrites(() => GET(request('GET', other, undefined, `?branchId=${fixture.branchId}`)), 403);
  });
  test('customer login can read its own profile but cannot search or register', async () => {
    const own = await create(), another = await create();
    await client.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2', [fixture.customerLoginId, own.customerId]);
    const token = await session(fixture.customerLoginId);
    assert.equal((await profile(own.customerId, token)).status, 200);
    await failsWithoutWrites(() => profile(another.customerId, token), 404);
    await failsWithoutWrites(() => GET(request('GET', token)), 403);
    await failsWithoutWrites(() => POST(request('POST', token, registrationInput(fixture))), 403);
  });
  test('duplicate identity and email return 409 with complete rollback', async () => {
    const input = registrationInput(fixture); await create(input);
    for (const duplicate of [{ nicPassportNo: input.nicPassportNo.toLowerCase() }, { email: input.email.toUpperCase() }]) {
      await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture, duplicate))), 409);
    }
  });
  test('late document failure returns safe error and rolls back parent and trigger audit', async () => {
    await client.query(`CREATE FUNCTION test_fail_api_document() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Private synthetic detail' USING ERRCODE='23514'; END $$`);
    await client.query('CREATE TRIGGER test_fail_api_document BEFORE INSERT ON customer_document FOR EACH ROW EXECUTE FUNCTION test_fail_api_document()');
    try { await failsWithoutWrites(() => POST(request('POST', agentToken, registrationInput(fixture))), 400); }
    finally {
      await client.query('DROP TRIGGER test_fail_api_document ON customer_document');
      await client.query('DROP FUNCTION test_fail_api_document()');
    }
  });
});
