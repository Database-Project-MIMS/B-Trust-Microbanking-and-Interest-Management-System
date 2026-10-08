import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActivityFixture, activityRequest, pool, requireDisposableDatabase,
  bankDayTotals, branchDayTotals } from '../helpers/agent-activity.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import { colomboToday } from '../../lib/validation/agent-activity.ts';
const { GET } = await import('../../app/api/agents/[id]/activity/route.ts');

describe('P03-M02-T02: authenticated activity routes under mims_app', () => {
  let client, fixture, restore;
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
  });
  beforeEach(async () => { fixture = await createActivityFixture(client); });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });
  async function request(role = 'admin', query, id = fixture.agentId) {
    const response = await GET(activityRequest(id, fixture.tokens[role], query), { params: Promise.resolve({ id }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }

  test('ADMIN receives exact grouped amounts, bounded local days and minimal agent metadata', async () => {
    const { status, body, headers } = await request();
    assert.equal(status, 200); assert.deepEqual(body.data.byType, bankDayTotals);
    assert.equal(body.data.agentId, fixture.agentId); assert.equal(body.data.timeZone, 'Asia/Colombo');
    assert.equal(body.data.scope, 'BANK'); assert.equal(body.data.from, '2026-09-01');
    assert.deepEqual(Object.keys(body.data.agent).sort(), ['branchCode', 'branchName', 'employeeNo', 'fullName']);
    assert.equal(headers.get('cache-control'), 'private, no-store');
  });
  test('CENTRAL_OPS has bankwide access', async () => {
    assert.deepEqual((await request('central')).body.data.byType, bankDayTotals);
  });
  test('bankwide roles remain bankwide when the login retains a historical staff profile', async () => {
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='ADMIN') WHERE user_id=$1", [fixture.managerId]);
    const result = await request('manager'); assert.equal(result.status, 200);
    assert.equal(result.body.data.scope, 'BANK'); assert.deepEqual(result.body.data.byType, bankDayTotals);
  });
  test('manager filters recorded posting branch, including exclusion of NULL branch rows', async () => {
    const result = await request('manager'); assert.equal(result.status, 200);
    assert.equal(result.body.data.scope, 'BRANCH'); assert.deepEqual(result.body.data.byType, branchDayTotals);
  });
  test('AGENT sees only its own attributed history, regardless of initiator login', async () => {
    const result = await request('agent'); assert.equal(result.status, 200);
    assert.equal(result.body.data.scope, 'SELF'); assert.deepEqual(result.body.data.byType, bankDayTotals);
    assert.equal((await request('second')).status, 403);
  });
  test('manager cannot request another branch agent', async () => {
    assert.equal((await request('otherManager')).status, 403);
  });
  test('AGENT cannot query another agent even in the same branch', async () => {
    assert.equal((await request('agent', undefined, fixture.secondAgentId)).status, 403);
    assert.equal((await request('agent', undefined, fixture.otherAgentId)).status, 403);
  });
  test('uppercase UUID spelling preserves legitimate self access', async () => {
    const result = await request('agent', undefined, fixture.agentId.toUpperCase());
    assert.equal(result.status, 200); assert.equal(result.body.data.agentId, fixture.agentId);
  });
  test('inclusive multi-day range includes the final day without its following midnight', async () => {
    const result = await request('admin', 'from=2026-09-01&to=2026-09-02');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.byType, [{ type: 'DEPOSIT', count: 6, total: '33.30' }, ...bankDayTotals.slice(1)]);
  });
  test('one supplied date selects that single day', async () => {
    for (const query of ['from=2026-09-01', 'to=2026-09-01']) {
      const result = await request('admin', query);
      assert.equal(result.body.data.from, '2026-09-01'); assert.equal(result.body.data.to, '2026-09-01');
      assert.deepEqual(result.body.data.byType, bankDayTotals);
    }
  });
  test('no supplied dates defaults to today in Colombo; empty result is explicit', async () => {
    const before = colomboToday(); const result = await request('admin', ''); const after = colomboToday();
    assert.equal(result.status, 200); assert.ok([before, after].includes(result.body.data.from));
    assert.equal(result.body.data.from, result.body.data.to); assert.deepEqual(result.body.data.byType, []);
  });
  test('valid agent with no activity returns 200 and an empty array', async () => {
    const result = await request('admin', 'from=2027-01-01&to=2027-01-01');
    assert.equal(result.status, 200); assert.deepEqual(result.body.data.byType, []);
  });
  test('unknown agent and manager profiles are not ordinary activity targets', async () => {
    assert.equal((await request('admin', undefined, randomUUID())).status, 404);
    assert.equal((await request('admin', undefined, fixture.managerId)).status, 404);
  });
  test('unauthenticated, expired and revoked sessions return 401', async () => {
    assert.equal((await request('missing')).status, 401);
    await client.query("UPDATE user_session SET expires_at = now() - interval '1 second' WHERE user_id = $1", [fixture.adminId]);
    assert.equal((await request()).status, 401);
    await client.query('DELETE FROM user_session WHERE user_id = $1', [fixture.agentId]);
    assert.equal((await request('agent')).status, 401);
  });
  test('AUDITOR and CUSTOMER cannot use the operational endpoint', async () => {
    assert.equal((await request('auditor')).status, 403); assert.equal((await request('customer')).status, 403);
  });
  test('bad UUID, invalid dates and reversed ranges return safe validation errors', async () => {
    assert.equal((await request('admin', undefined, 'not-a-uuid')).status, 400);
    for (const query of ['from=2026-02-29', 'from=2026-04-31', 'from=0000-01-01', 'from=2026-9-1',
      'from=2026-09-02&to=2026-09-01', 'from=', 'from=2026-09-01%27%3BSELECT%201']) {
      const result = await request('admin', query); assert.equal(result.status, 400);
      assert.deepEqual(result.body, { error: { code: 'VALIDATION_FAILED', message: 'The request contains invalid or missing fields.' } });
    }
  });
  test('unknown scope parameters and duplicate dates cannot broaden access', async () => {
    for (const query of [`branchId=${fixture.otherBranchId}`, `agentId=${fixture.secondAgentId}`, 'from=2026-09-01&from=2026-09-02']) {
      assert.equal((await request('manager', query)).status, 400);
    }
  });
  test('transfer preserves history while new manager receives only the new branch snapshot', async () => {
    await client.query('UPDATE agent SET branch_id=$1 WHERE agent_id=$2', [fixture.otherBranchId, fixture.agentId]);
    assert.equal((await request('manager')).status, 403);
    const result = await request('otherManager'); assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.byType, [{ type: 'DEPOSIT', count: 1, total: '8.00' }]);
    assert.deepEqual((await request('agent')).body.data.byType, bankDayTotals);
    assert.deepEqual((await request('central')).body.data.byType, bankDayTotals);
  });
  test('inactive target remains reportable to managers and bankwide roles but loses self access', async () => {
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1", [fixture.agentId]);
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1", [fixture.agentId]);
    assert.equal((await request('manager')).status, 200); assert.equal((await request('admin')).status, 200);
    assert.equal((await request('agent')).status, 401);
  });
});
