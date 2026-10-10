import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createActivityFixture, pool, requireDisposableDatabase, bankDayTotals } from '../helpers/agent-activity.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
const { getAgentActivity } = await import('../../services/agent-service.ts');
const range = { from: '2026-09-01', to: '2026-09-01' };

describe('P03-M02-T02: database-backed activity service and scope', () => {
  let client, fixture, restore;
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
  });
  beforeEach(async () => { fixture = await createActivityFixture(client); });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });
  function actor(roleName = 'ADMIN', userId = fixture.adminId, branchId = null) { return { roleName, userId, branchId }; }

  test('SUM remains exact beyond a column-sized amount and JavaScript precise cents', async () => {
    await fixture.insert({ amount: '9999999999999.99', date: '2026-09-10T00:00:00Z' });
    await fixture.insert({ amount: '0.01', date: '2026-09-10T00:00:01Z' });
    const result = await getAgentActivity(fixture.agentId, { from: '2026-09-10', to: '2026-09-10' }, actor());
    assert.deepEqual(result.byType, [{ type: 'DEPOSIT', count: 2, total: '10000000000000.00' }]);
  });
  test('business-day bounds remain correct when PostgreSQL connection timezone differs', async () => {
    // Reuse one application-role client with a non-Colombo timezone for the complete transaction.
    const connection = await pool.connect();
    await connection.query("SET TIME ZONE 'America/New_York'");
    const originalConnect = pool.connect;
    const release = connection.release;
    connection.release = () => {};
    pool.connect = async () => connection;
    try { assert.deepEqual((await getAgentActivity(fixture.agentId, range, actor())).byType, bankDayTotals); }
    finally { pool.connect = originalConnect; await connection.query('RESET TIME ZONE'); connection.release = release; connection.release(); }
  });
  test('forged role and stale or missing branch fail closed for direct service callers', async () => {
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor('ADMIN', fixture.agentId)), { status: 403 });
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor('BRANCH_MANAGER', fixture.managerId, fixture.otherBranchId)), { status: 403 });
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor('BRANCH_MANAGER', fixture.managerId, null)), { status: 403 });
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor('AUDITOR', fixture.auditorId)), { status: 403 });
  });
  test('stored inactive caller profile cannot use a stale authenticated identity', async () => {
    await client.query("UPDATE agent SET status='INACTIVE' WHERE agent_id=$1", [fixture.managerId]);
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor('BRANCH_MANAGER', fixture.managerId, fixture.branchId)), { status: 403 });
  });
  test('stored role changes invalidate a previously authenticated actor', async () => {
    await client.query("UPDATE app_user SET role_id=(SELECT role_id FROM role WHERE role_name='CUSTOMER') WHERE user_id=$1", [fixture.adminId]);
    await assert.rejects(getAgentActivity(fixture.agentId, range, actor()), { status: 403 });
  });
  test('no ledger or account state changes and transaction-local context is discarded', async () => {
    const snapshot = async () => (await client.query(
      `SELECT (SELECT COUNT(*)::text FROM transaction) AS ledger,
         (SELECT COUNT(*)::text FROM audit_log) AS audits,
         (SELECT current_balance::text FROM account WHERE account_id=$1) AS balance`, [fixture.accountId],
    )).rows[0];
    const before = await snapshot(); await getAgentActivity(fixture.agentId, range, actor());
    assert.deepEqual(await snapshot(), before);
    const next = await pool.connect();
    try {
      const { rows } = await next.query("SELECT NULLIF(current_setting('app.current_user_id', true), '') AS user_id");
      assert.equal(rows[0].user_id, null);
    } finally { next.release(); }
  });
  test('invalid inputs are rejected before SQL in direct service use', async () => {
    await assert.rejects(getAgentActivity('invalid', range, actor()), { status: 400 });
    await assert.rejects(getAgentActivity(fixture.agentId, { from: '2026-09-02', to: '2026-09-01' }, actor()), { status: 400 });
  });
});
