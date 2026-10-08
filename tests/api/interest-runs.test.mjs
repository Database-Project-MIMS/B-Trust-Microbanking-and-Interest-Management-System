import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes, createHash } from 'node:crypto';
const { POST } = await import('../../app/api/interest-runs/route.ts');

describe('P04-M01-T01: Interest Run Worker Authentication', () => {
  let client, fixture, restore;
  const tokens = {};
  
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });
  
  beforeEach(async () => {
    fixture = await createFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.centralOps = await session(await fixture.staff('CENTRAL_OPS'));
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
  
  async function runPost(token, isWorker = false) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) {
      if (isWorker) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.set('Cookie', `mims_session=${token}`);
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
    const { rows } = await client.query("SELECT * FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY created_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'SYSTEM');
    assert.equal(rows[0].user_id, null);
    await client.query("DELETE FROM audit_log WHERE audit_id = $1", [rows[0].audit_id]);
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
    const { rows } = await client.query("SELECT * FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY created_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'USER');
    assert.ok(rows[0].user_id);
    await client.query("DELETE FROM audit_log WHERE audit_id = $1", [rows[0].audit_id]);
  });

  test('ADMIN triggers run → authorized', async () => {
    const res = await runPost(tokens.admin, false);
    assert.equal(res.status, 200);
    const { rows } = await client.query("SELECT * FROM audit_log WHERE action = 'INTEREST_RUN_INITIATED' ORDER BY created_at DESC LIMIT 1");
    assert.equal(rows[0].actor_type, 'USER');
    assert.ok(rows[0].user_id);
    await client.query("DELETE FROM audit_log WHERE audit_id = $1", [rows[0].audit_id]);
  });

  test('AGENT triggers run → 403', async () => {
    const res = await runPost(tokens.agent, false);
    assert.equal(res.status, 403);
  });
});
