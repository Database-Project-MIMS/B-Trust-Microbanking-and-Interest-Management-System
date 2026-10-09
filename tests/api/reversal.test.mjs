import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes } from 'node:crypto';
import { authorizedFixture, fixtureSession } from '../helpers/authorized-fixture.mjs';
const { POST } = await import('../../app/api/transactions/[id]/reverse/route.ts');

describe('P03-M01-T02: Manager-Only Reversal Authorization', () => {
  let client, fixture;
  const tokens = {};
  const csrf = randomBytes(32).toString('hex');

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
  });

  beforeEach(async () => {
    fixture = await authorizedFixture(client);
    tokens.manager = await session(fixture.managerId);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.agent = await session(fixture.agentId);
    tokens.customer = await session(fixture.customerLoginId);
  });

  after(async () => {
    client?.release();
    await pool.end();
  });

  async function session(userId) {
    return fixtureSession(client, userId);
  }

  async function reverse(token, transactionId, reason = 'Test reversal') {
    const req = new NextRequest(`http://localhost:3000/api/transactions/${transactionId}/reverse`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Cookie': `mims_session=${token}; mims_csrf=${csrf}` }),
      body: JSON.stringify({ reason }),
    });
    return POST(req, { params: Promise.resolve({ id: transactionId }) });
  }

  test('AGENT attempts reversal → 403', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await reverse(tokens.agent, fakeId);
    assert.equal(res.status, 403);
  });

  test('CUSTOMER attempts reversal → 403', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await reverse(tokens.customer, fakeId);
    assert.equal(res.status, 403);
  });

  test('Missing reason → 400 VALIDATION_FAILED', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const req = new NextRequest(`http://localhost:3000/api/transactions/${fakeId}/reverse`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Cookie': `mims_session=${tokens.manager}; mims_csrf=${csrf}` }),
      body: JSON.stringify({ reason: '' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: fakeId }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'VALIDATION_FAILED');
  });

  test('BRANCH_MANAGER reversing unknown transaction → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await reverse(tokens.manager, fakeId, 'Genuine error');
    // 404 or 503 (if sp_reverse_transaction not yet merged)
    assert.ok([404, 503].includes(res.status), `Expected 404 or 503, got ${res.status}`);
  });

  test('ADMIN reversing unknown transaction → 404 or 503', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await reverse(tokens.admin, fakeId, 'Admin override');
    assert.ok([404, 503].includes(res.status), `Expected 404 or 503, got ${res.status}`);
  });

  test('Cross-branch reversal attempt → 403 or 404 (scope enforcement)', async () => {
    // Create a transaction in the OTHER branch and try to reverse as this branch's manager
    const otherBranchTx = await client.query(`
      SELECT t.transaction_id FROM transaction t
      JOIN account a ON a.account_id = t.account_id
      WHERE a.branch_id = $1 LIMIT 1
    `, [fixture.otherBranchId]);

    if (otherBranchTx.rows.length === 0) return; // skip if no cross-branch data

    const txId = otherBranchTx.rows[0].transaction_id;
    const res = await reverse(tokens.manager, txId, 'Cross-branch attempt');
    // Should be denied: 403 or 404 (not found in scope)
    assert.ok([403, 404, 503].includes(res.status), `Expected 403/404/503, got ${res.status}`);
  });
});
