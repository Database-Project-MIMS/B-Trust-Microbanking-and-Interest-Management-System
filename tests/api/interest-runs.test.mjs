import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes } from 'node:crypto';
import { authorizedFixture, fixtureSession } from '../helpers/authorized-fixture.mjs';
const { POST } = await import('../../app/api/interest-runs/route.ts');

describe('P04-M01-T01: Interest Run Worker Authentication', () => {
  let client, fixture, originalWorkerToken;
  const tokens = {};
  const csrf = randomBytes(32).toString('hex');
  
  before(async () => {
    originalWorkerToken = process.env.INTEREST_WORKER_TOKEN;
    process.env.INTEREST_WORKER_TOKEN = randomBytes(32).toString('hex');
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });
  
  beforeEach(async () => {
    fixture = await authorizedFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.centralOps = await session(await fixture.staff('CENTRAL_OPS'));
    tokens.agent = await session(fixture.agentId);
  });
  
  after(async () => {
    if (originalWorkerToken === undefined) delete process.env.INTEREST_WORKER_TOKEN;
    else process.env.INTEREST_WORKER_TOKEN = originalWorkerToken;
    client?.release();
    await pool.end();
  });
  
  async function session(userId) {
    return fixtureSession(client, userId);
  }
  
  async function runPost(token, isWorker = false) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) {
      if (isWorker) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.set('x-csrf-token', csrf);
        headers.set('Cookie', `mims_session=${token}; mims_csrf=${csrf}`);
      }
    }
    const req = new NextRequest('http://localhost:3000/api/interest-runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ cycleDate: '2026-10-31', dryRun: false })
    });
    return POST(req);
  }

  test('Worker token → authorized, null user_id in audit', async () => {
    const res = await runPost(process.env.INTEREST_WORKER_TOKEN, true);
    assert.equal(res.status, 200);
    const { rows } = await client.query("SELECT user_id, actor_type FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY logged_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'SYSTEM');
    assert.equal(rows[0].user_id, null);

  });

  test('Invalid worker token → 401', async () => {
    const res = await runPost('wrong_token', true);
    assert.equal(res.status, 401);
  });

  test('No auth at all → 401', async () => {
    const res = await runPost(null);
    assert.equal(res.status, 401);
  });

  test('CENTRAL_OPS triggers run → authorized', async () => {
    const res = await runPost(tokens.centralOps, false);
    assert.equal(res.status, 200);
    const { rows } = await client.query("SELECT user_id, actor_type FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY logged_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'USER');
    assert.ok(rows[0].user_id);

  });

  test('ADMIN triggers run → authorized', async () => {
    const res = await runPost(tokens.admin, false);
    assert.equal(res.status, 200);
    const { rows } = await client.query("SELECT user_id, actor_type FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY logged_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'USER');
    assert.ok(rows[0].user_id);

  });

  test('AGENT triggers run → 403', async () => {
    const res = await runPost(tokens.agent, false);
    assert.equal(res.status, 403);
  });

  test('session requests require CSRF and write no audit on denial', async () => {
    const before = (await client.query("SELECT count(*)::text AS n FROM audit_log WHERE action='INTEREST_RUN_INITIATED'")).rows[0].n;
    const response = await POST(new NextRequest('http://localhost/api/interest-runs', {
      method: 'POST', headers: { cookie: `mims_session=${tokens.admin}` },
      body: JSON.stringify({ cycleDate: '2026-10-31', dryRun: false }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await client.query("SELECT count(*)::text AS n FROM audit_log WHERE action='INTEREST_RUN_INITIATED'")).rows[0].n, before);
  });

  test('a valid worker token cannot bypass a denied signed-in role', async () => {
    const response = await POST(new NextRequest('http://localhost/api/interest-runs', {
      method: 'POST', headers: { cookie: `mims_session=${tokens.agent}`, authorization: `Bearer ${process.env.INTEREST_WORKER_TOKEN}` },
      body: JSON.stringify({ cycleDate: '2026-10-31', dryRun: false }),
    }));
    assert.equal(response.status, 403);
  });

  test('invalid body/date is rejected without writing an audit event', async () => {
    const before = (await client.query("SELECT count(*)::text AS n FROM audit_log WHERE action='INTEREST_RUN_INITIATED'")).rows[0].n;
    for (const body of ['{', JSON.stringify({ cycleDate: '2026-02-30', dryRun: false }), JSON.stringify({ cycleDate: '2026-10-31', dryRun: 'false' })]) {
      const response = await POST(new NextRequest('http://localhost/api/interest-runs', {
        method: 'POST', headers: { authorization: `Bearer ${process.env.INTEREST_WORKER_TOKEN}` }, body,
      }));
      assert.equal(response.status, 400);
    }
    assert.equal((await client.query("SELECT count(*)::text AS n FROM audit_log WHERE action='INTEREST_RUN_INITIATED'")).rows[0].n, before);
  });
});
