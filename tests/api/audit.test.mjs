import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes, createHash } from 'node:crypto';
const { GET } = await import('../../app/api/audit/route.ts');

describe('P05-M01-T04: Audit API', () => {
  let client, fixture;
  const tokens = {};
  
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });
  
  beforeEach(async () => {
    fixture = await createFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.auditor = await session(await fixture.staff('AUDITOR'));
    tokens.agent = await session(fixture.agentId);
  });
  
  after(async () => {
    client?.release();
    await pool.end();
  });
  
  async function session(userId) {
    const id = randomBytes(32).toString('hex');
    const secret = process.env.SESSION_SECRET || 'CHANGE_ME_32_BYTE_RANDOM_VALUE';
    const hash = createHash('sha256').update(id + secret).digest('hex');
    await client.query(
      `INSERT INTO user_session (session_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [id, userId, hash]
    );
    return id;
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
    const res = await fetchAudit(tokens.admin, `?actorId=${fixture.agentId}`);
    assert.equal(res.status, 200);
    const json = await res.json();
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
});
