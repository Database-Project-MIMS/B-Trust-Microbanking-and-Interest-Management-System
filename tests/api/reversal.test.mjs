import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { randomBytes,randomUUID } from 'node:crypto';
import { authorizedFixture, fixtureSession } from '../helpers/authorized-fixture.mjs';
const { POST } = await import('../../app/api/transactions/[id]/reverse/route.ts');

describe('P03-M01-T02: Manager-Only Reversal Authorization', () => {
  let client, fixture, restore;
  const tokens = {};
  const csrf = randomBytes(32).toString('hex');

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    restore=useCustomerRuntime(pool);
  });

  beforeEach(async () => {
    fixture = await authorizedFixture(client);
    tokens.manager = await session(fixture.managerId);
    tokens.admin = await session(await fixture.staff('ADMIN'));
    tokens.agent = await session(fixture.agentId);
    tokens.customer = await session(fixture.customerLoginId);
  });

  after(async () => {
    await restore?.();
    client?.release();
    await pool.end();
  });

  async function session(userId) {
    return fixtureSession(client, userId);
  }

  async function reverse(token, transactionId, reason = 'Test reversal') {
    const req = new NextRequest(`http://localhost:3000/api/transactions/${transactionId}/reverse`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json', 'Idempotency-Key':'REV-'+randomUUID(), 'x-csrf-token': csrf, 'Cookie': `mims_session=${token}; mims_csrf=${csrf}` }),
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
      headers: new Headers({ 'Content-Type': 'application/json', 'Idempotency-Key':'REV-'+randomUUID(), 'x-csrf-token': csrf, 'Cookie': `mims_session=${tokens.manager}; mims_csrf=${csrf}` }),
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
    assert.equal(res.status,404);
  });

  test('ADMIN cannot reverse transactions → 403', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await reverse(tokens.admin, fakeId, 'Admin override');
    assert.equal(res.status,403);
  });

  test('Cross-branch reversal attempt → 403 or 404 (scope enforcement)', async () => {
    // Create a transaction in the OTHER branch and try to reverse as this branch's manager
    const otherBranchTx = await client.query(`
      SELECT t.transaction_id FROM transaction t
      JOIN account a ON a.account_id = t.account_id
      WHERE a.branch_id = $1 LIMIT 1
    `, [fixture.otherBranchId]);

    let txId=otherBranchTx.rows[0]?.transaction_id;
    if(!txId){
      const account=(await client.query(`INSERT INTO account(account_number,plan_id,branch_id,opened_by_agent_id,current_balance)
        SELECT $1,plan_id,$2,$3,1000 FROM savings_plan WHERE plan_name='Adult' RETURNING account_id`,
        ['REV-SCOPE-'+randomUUID(),fixture.otherBranchId,fixture.otherManagerId])).rows[0].account_id;
      txId=(await client.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount)
        SELECT $1,$2,channel_id,$3,'DEPOSIT',10 FROM transaction_channel WHERE channel_name='BRANCH_COUNTER' RETURNING transaction_id`,
        [account,fixture.otherManagerId,'REV-SCOPE-'+randomUUID()])).rows[0].transaction_id;
    }
    const res = await reverse(tokens.manager, txId, 'Cross-branch attempt');
    // Should be denied: 403 or 404 (not found in scope)
    assert.ok([403,404].includes(res.status),`Expected scoped denial, got ${res.status}`);
  });
});
