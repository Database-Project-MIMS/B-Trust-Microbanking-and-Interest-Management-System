import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fdFixture, pool, requireDisposableDatabase, financialSnapshot } from '../helpers/customer-fixed-deposits.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import * as branches from '../../app/api/branches/route.ts';
import * as agents from '../../app/api/agents/route.ts';
import * as deposits from '../../app/api/fixed-deposits/route.ts';

describe('P06-M02-T04: literal list filters preserve runtime database scope', () => {
  let client, fixture, restore, baseline;
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    fixture = await fdFixture(client);
    await fixture.staff('AGENT', fixture.otherBranchId);
    await client.query("UPDATE branch SET branch_name='Filter branch primary', district='Galle' WHERE branch_id=$1", [fixture.branchId]);
    await client.query("UPDATE agent SET full_name='Filter employee primary' WHERE agent_id=$1", [fixture.agentId]);
    await client.query("UPDATE customer SET full_name='Filter owner primary' WHERE customer_id=$1", [fixture.customerId]);
    await client.query("UPDATE customer SET full_name='Hidden joint owner' WHERE customer_id=$1", [fixture.secondCustomerId]);
    await client.query("UPDATE customer SET full_name='Foreign filter owner' WHERE customer_id=$1", [fixture.otherCustomerId]);
    baseline = await financialSnapshot(client);
    restore = useCustomerRuntime(pool);
  });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });
  function request(resource, query, role) {
    return new NextRequest(`http://localhost/api/${resource}?${new URLSearchParams(query)}`, {
      headers: { cookie: `mims_session=${fixture.tokens[role]}` },
    });
  }
  async function list(module, resource, query = {}, role = 'manager') {
    const response = await module.GET(request(resource, query, role));
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return (await response.json()).data;
  }
  test('branch text, district and status combine without widening manager scope', async () => {
    assert.deepEqual((await list(branches, 'branches', { q: 'FILTER BRANCH', district: 'galle', status: 'ACTIVE' })).map(row => row.branchId), [fixture.branchId]);
    assert.deepEqual(await list(branches, 'branches', { district: 'Colombo' }), []);
    assert.deepEqual(await list(branches, 'branches', { status: 'INACTIVE' }), []);
    assert.ok((await list(branches, 'branches', { district: 'Colombo' }, 'admin')).some(row => row.branchId === fixture.otherBranchId));
  });
  test('agent branch and identity filters combine and foreign branch selection stays empty', async () => {
    const query = { q: 'FILTER EMPLOYEE', branchId: fixture.branchId, status: 'ACTIVE' };
    assert.deepEqual((await list(agents, 'agents', query)).map(row => row.agentId), [fixture.agentId]);
    assert.deepEqual(await list(agents, 'agents', { branchId: fixture.otherBranchId }), []);
    const global = await list(agents, 'agents', { branchId: fixture.otherBranchId }, 'central');
    assert.ok(global.length); assert.ok(global.every(row => row.branchId === fixture.otherBranchId));
    assert.ok(global.every(row => row.agentId !== fixture.otherManagerId));
  });
  test('FD account and owner search combine with product/status and count paginated rows exactly', async () => {
    const result = await list(deposits, 'fixed-deposits', { q: 'FILTER OWNER PRIMARY', fdPlanId: fixture.planId, status: 'ACTIVE', pageSize: '1' });
    assert.equal(result.totalRows, 2); assert.equal(result.rows.length, 1);
    const next = await list(deposits, 'fixed-deposits', { q: 'FILTER OWNER PRIMARY', fdPlanId: fixture.planId, status: 'ACTIVE', pageSize: '1', page: '2' });
    assert.equal(next.totalRows, 2); assert.notEqual(next.rows[0].fdId, result.rows[0].fdId);
    const account = await list(deposits, 'fixed-deposits', { q: fixture.ownAccount.account_number, status: 'MATURED' });
    assert.deepEqual(account.rows.map(row => row.fdId), [fixture.maturedId]);
    assert.equal((await list(deposits, 'fixed-deposits', { fdPlanId: randomUUID() })).totalRows, 0);
    assert.equal((await list(deposits, 'fixed-deposits', { q: 'Foreign filter owner' })).totalRows, 0);
    assert.equal((await list(deposits, 'fixed-deposits', { q: 'Foreign filter owner' }, 'central')).totalRows, 1);
  });
  test('owner search cannot reveal hidden co-holders through result counts', async () => {
    assert.equal((await list(deposits, 'fixed-deposits', { q: 'Hidden joint owner' })).totalRows, 1);
    for (const role of ['agent', 'customer']) {
      assert.equal((await list(deposits, 'fixed-deposits', { q: 'Hidden joint owner' }, role)).totalRows, 0);
      assert.equal((await list(deposits, 'fixed-deposits', { q: 'Filter owner primary', status: 'ACTIVE' }, role)).totalRows, 2);
    }
  });
  test('literal wildcard and SQL-shaped searches neither expand matches nor mutate financial state', async () => {
    for (const [module, resource] of [[branches, 'branches'], [agents, 'agents'], [deposits, 'fixed-deposits']]) {
      for (const q of ['%', '_', "' OR 1=1 --"]) {
        const result = await list(module, resource, { q });
        assert.equal(Array.isArray(result) ? result.length : result.totalRows, 0);
      }
    }
    assert.deepEqual(await financialSnapshot(client), baseline);
  });
  test('invalid filters return validation errors and organization role checks remain enforced', async () => {
    for (const [module, resource, query] of [
      [branches, 'branches', { q: 'x'.repeat(151) }], [branches, 'branches', { district: 'x'.repeat(101) }],
      [agents, 'agents', { branchId: 'invalid' }], [agents, 'agents', { status: 'MATURED' }],
      [deposits, 'fixed-deposits', { fdPlanId: 'invalid' }], [deposits, 'fixed-deposits', { q: 'x'.repeat(151) }],
    ]) assert.equal((await module.GET(request(resource, query, 'manager'))).status, 400);
    for (const [module, resource] of [[branches, 'branches'], [agents, 'agents']]) {
      assert.equal((await module.GET(request(resource, {}, 'agent'))).status, 403);
    }
  });
});
