import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getInterestCycleDays, getMinFdPrincipal } from '../../services/interest-config-service.js';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes, createHash } from 'node:crypto';
const { PUT } = await import('../../app/api/admin/parameters/[key]/route.ts');

test('Cycle Config Service and Admin API', async (t) => {
  let client, fixture;
  const tokens = {};

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });

  beforeEach(async () => {
    fixture = await createFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.agent = await session(fixture.agentId);
  });

  after(async () => {
    client?.release();
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

  async function updateParam(token, key, value) {
    const req = new NextRequest(`http://localhost:3000/api/admin/parameters/${key}`, {
      method: 'PUT',
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cookie': `mims_session=${token}`,
        'x-csrf-token': 'test-csrf'
      }),
      body: JSON.stringify({ value })
    });
    // The route expects params promise in Next.js 15
    return PUT(req, { params: Promise.resolve({ key }) });
  }

  await t.test('reads parameters from system_parameter', async () => {
    const cycleDays = await getInterestCycleDays();
    assert.equal(cycleDays, 30);
    
    const minFd = await getMinFdPrincipal();
    assert.equal(minFd, '10000.00');
  });

  await t.test('Admin can update cycle config via API, which changes service response', async () => {
    const res = await updateParam(tokens.admin, 'INTEREST_CYCLE_DAYS', '45');
    assert.equal(res.status, 200);
    
    const newCycleDays = await getInterestCycleDays();
    assert.equal(newCycleDays, 45);
    
    // restore
    await updateParam(tokens.admin, 'INTEREST_CYCLE_DAYS', '30');
  });

  await t.test('Non-admin cannot update cycle config', async () => {
    const res = await updateParam(tokens.agent, 'INTEREST_CYCLE_DAYS', '60');
    assert.equal(res.status, 403);
    
    const cycleDays = await getInterestCycleDays();
    assert.equal(cycleDays, 30); // unchanged
  });
});
