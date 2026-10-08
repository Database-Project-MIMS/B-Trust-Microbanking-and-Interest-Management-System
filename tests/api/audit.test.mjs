import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { authorizedFixture, fixtureSession } from '../helpers/authorized-fixture.mjs';
const { GET } = await import('../../app/api/audit/route.ts');

describe('P05-M01-T04: Audit API', () => {
  let client, fixture;
  const tokens = {};
  
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });
  
  beforeEach(async () => {
    fixture = await authorizedFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.auditor = await session(await fixture.staff('AUDITOR'));
    tokens.agent = await session(fixture.agentId);
  });
  
  after(async () => {
    client?.release();
    await pool.end();
  });
  
  async function session(userId) {
    return fixtureSession(client, userId);
  }
  
  async function fetchAudit(token, queryStr = '') {
    const req = new NextRequest(`http://localhost:3000/api/audit${queryStr}`, {
      headers: new Headers({
        'Cookie': `mims_session=${token}`
      })
    });
    return GET(req);
  }

  test('ADMIN and AUDITOR can access audit logs', async () => {
    const res1 = await fetchAudit(tokens.admin);
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.ok(Array.isArray(data1.data));

    const res2 = await fetchAudit(tokens.auditor);
    assert.equal(res2.status, 200);
  });

  test('AGENT cannot access audit logs', async () => {
    const res = await fetchAudit(tokens.agent);
    assert.equal(res.status, 403);
  });

  test('Filters by actorId', async () => {
    await client.query("INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action) VALUES ($1,'USER','agent',$1,'UPDATE')", [fixture.agentId]);
    const res = await fetchAudit(tokens.admin, `?actorId=${fixture.agentId}`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0, 'Actor filter must return the planted event.');
    for (const row of json.data) {
      assert.equal(row.user_id, fixture.agentId);
    }
  });

  test('Returns 400 on invalid UUID', async () => {
    const res = await fetchAudit(tokens.admin, `?actorId=not-a-uuid`);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'BAD_REQUEST');
  });

  test('missing and invalid sessions receive a safe 401 response', async () => {
    for (const token of ['', 'forged']) {
      const response = await fetchAudit(token);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    }
  });

  test('pagination, timestamps and unknown filters are validated before querying', async () => {
    for (const query of ['?page=0', '?page=1e2', '?pageSize=101', '?pageSize=-1', '?from=not-a-date', '?from=2026-10-10&to=2026-10-09', '?sort=log_id;--']) {
      const response = await fetchAudit(tokens.admin, query);
      assert.equal(response.status, 400);
      const result = await response.json();
      assert.equal(result.error.code, 'BAD_REQUEST');
      assert.ok(!/SQL|postgresql|constraint|stack/i.test(result.error.message));
    }
  });
});
