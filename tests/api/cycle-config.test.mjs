import test, { before, beforeEach, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getInterestCycleDays, getMinFdPrincipal } from '../../services/interest-config-service.js';
import { pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes } from 'node:crypto';
import { authorizedFixture, fixtureSession } from '../helpers/authorized-fixture.mjs';
const { PUT } = await import('../../app/api/admin/parameters/[key]/route.ts');

describe('Cycle Config Service and Admin API', () => {
  let client, fixture;
  const tokens = {};
  const csrf = randomBytes(32).toString('hex');

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });

  beforeEach(async () => {
    fixture = await authorizedFixture(client);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.agent = await session(fixture.agentId);
  });

  after(async () => {
    client?.release();
    await pool.end();
  });

  async function session(userId) {
    return fixtureSession(client, userId);
  }

  async function updateParam(token, key, value) {
    const req = new NextRequest(`http://localhost:3000/api/admin/parameters/${key}`, {
      method: 'PUT',
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cookie': `mims_session=${token}; mims_csrf=${csrf}`,
        'x-csrf-token': csrf
      }),
      body: JSON.stringify({ value })
    });
    // The route expects params promise in Next.js 15
    return PUT(req, { params: Promise.resolve({ key }) });
  }

  test('reads parameters from system_parameter', async () => {
    const cycleDays = await getInterestCycleDays();
    assert.equal(cycleDays, 30);
    
    const minFd = await getMinFdPrincipal();
    assert.equal(minFd, '10000.00');
  });

  test('Admin can update cycle config via API, which changes service response', async () => {
    const original = await getInterestCycleDays();
    try {
      const res = await updateParam(tokens.admin, 'INTEREST_CYCLE_DAYS', '45');
      assert.equal(res.status, 200);
      assert.equal(await getInterestCycleDays(), 45);
    } finally {
      await client.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2',
        [String(original), 'INTEREST_CYCLE_DAYS']);
    }
  });

  test('Non-admin cannot update cycle config', async () => {
    const res = await updateParam(tokens.agent, 'INTEREST_CYCLE_DAYS', '60');
    assert.equal(res.status, 403);
    
    const cycleDays = await getInterestCycleDays();
    assert.equal(cycleDays, 30); // unchanged
  });
});
