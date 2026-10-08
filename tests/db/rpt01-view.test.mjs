import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createActivityFixture, pool, requireDisposableDatabase } from '../helpers/agent-activity.mjs';

// Consumer contract for T02: filter facts BEFORE the roster's outer join.
// Include transferred identities with history in the requested posting branch.
// Parameters are synthetic fixture IDs; no runtime report authorization is implied.
const rangeSql = `
  WITH filtered AS (
    SELECT agent_id, transaction_type, transaction_count, total_value
    FROM vw_rpt01_agent_transactions
    WHERE agent_id = ANY($1::uuid[])
      AND transaction_date >= ($2::date::timestamp AT TIME ZONE 'Asia/Colombo')
      AND transaction_date < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
      AND ($4::uuid IS NULL OR branch_id = $4)
  )
  SELECT a.agent_id, f.transaction_type,
         COALESCE(SUM(f.transaction_count), 0)::text AS transaction_count,
         COALESCE(SUM(f.total_value), 0.00)::text AS total_value
  FROM agent a
  LEFT JOIN filtered f ON f.agent_id = a.agent_id
  WHERE a.agent_id = ANY($1::uuid[])
    AND ($4::uuid IS NULL OR a.branch_id = $4
         OR EXISTS (SELECT 1 FROM filtered history WHERE history.agent_id = a.agent_id))
  GROUP BY a.agent_id, f.transaction_type
  ORDER BY a.agent_id, f.transaction_type`;

describe('P05-M02-T01: RPT-01 SQL view and filtered aggregation contract', () => {
  let client, fixture;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => { await client.query('BEGIN'); fixture = await createActivityFixture(client); });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });
  async function report(ids = [fixture.agentId], from = '2026-09-01', to = from, branchId = null) {
    return (await client.query(rangeSql, [ids, from, to, branchId])).rows;
  }
  function totals(rows) {
    return rows.map(({ transaction_type, transaction_count, total_value }) =>
      ({ type: transaction_type, count: transaction_count, total: total_value }));
  }

  test('Colombo day bounds keep exact unsigned totals separately for every ledger type', async () => {
    assert.deepEqual(totals(await report()), [
      { type: 'DEPOSIT', count: '4', total: '24.30' },
      { type: 'INTEREST_CREDIT', count: '1', total: '2.05' },
      { type: 'REVERSAL', count: '1', total: '3.50' },
      { type: 'WITHDRAWAL', count: '1', total: '1.25' },
    ]);
    assert.deepEqual(totals(await report([fixture.agentId], '2026-09-02')), [
      { type: 'DEPOSIT', count: '2', total: '9.00' },
    ]);
  });

  test('connection timezone does not change inclusive business dates', async () => {
    const expected = await report();
    await client.query("SET LOCAL TIME ZONE 'America/New_York'");
    assert.deepEqual(await report(), expected);
    await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
    assert.deepEqual(await report(), expected);
  });

  test('empty-history roster rows have zero count/value and no invented posting branch/date', async () => {
    const { rows } = await client.query(
      `SELECT transaction_count::text, total_value::text, transaction_type, transaction_date, branch_id
       FROM vw_rpt01_agent_transactions WHERE agent_id = $1`, [fixture.otherAgentId]);
    assert.deepEqual(rows, [{ transaction_count: '0', total_value: '0.00', transaction_type: null,
      transaction_date: null, branch_id: null }]);
  });

  test('agents with history entirely outside the chosen range still appear as zero', async () => {
    const ids = [fixture.agentId, fixture.secondAgentId, fixture.managerId];
    const rows = await report(ids, '2026-10-01', '2026-10-31', fixture.branchId);
    assert.equal(rows.length, 3);
    for (const row of rows) assert.deepEqual(totals([row]), [{ type: null, count: '0', total: '0.00' }]);
  });

  test('branch totals exclude NULL/other posting branches and unrelated agents', async () => {
    assert.deepEqual(totals(await report([fixture.agentId], '2026-09-01', '2026-09-01', fixture.branchId)), [
      { type: 'DEPOSIT', count: '2', total: '0.30' },
      { type: 'INTEREST_CREDIT', count: '1', total: '2.05' },
      { type: 'REVERSAL', count: '1', total: '3.50' },
      { type: 'WITHDRAWAL', count: '1', total: '1.25' },
    ]);
    assert.deepEqual(totals(await report([fixture.agentId], '2026-09-01', '2026-09-01', fixture.otherBranchId)),
      [{ type: 'DEPOSIT', count: '1', total: '8.00' }]);
  });

  test('transfers retain old branch history without relabelling NULL or other branch facts', async () => {
    await client.query('UPDATE agent SET branch_id = $1 WHERE agent_id = $2', [fixture.otherBranchId, fixture.agentId]);
    const rows = await client.query(
      `SELECT DISTINCT agent_branch_id, branch_id FROM vw_rpt01_agent_transactions
       WHERE agent_id = $1 AND transaction_type = 'DEPOSIT'`, [fixture.agentId]);
    assert.ok(rows.rows.every(row => row.agent_branch_id === fixture.otherBranchId));
    assert.deepEqual(new Set(rows.rows.map(row => row.branch_id)), new Set([fixture.branchId, fixture.otherBranchId, null]));
    assert.equal((await report([fixture.agentId], '2026-09-01', '2026-09-01', fixture.branchId))[0].total_value, '0.30');
    assert.equal((await report([fixture.agentId], '2026-10-01', '2026-10-31', fixture.branchId)).length, 0);
  });

  test('inactive and manager profiles retain their attributed history after role changes', async () => {
    await fixture.insert({ agentId: fixture.managerId, amount: '7.00' });
    await client.query("UPDATE agent SET status = 'INACTIVE' WHERE agent_id = $1", [fixture.agentId]);
    await client.query("UPDATE app_user SET status = 'INACTIVE', role_id = (SELECT role_id FROM role WHERE role_name = 'BRANCH_MANAGER') WHERE user_id = $1", [fixture.agentId]);
    assert.equal((await report())[0].total_value, '24.30');
    assert.deepEqual(totals(await report([fixture.managerId])), [{ type: 'DEPOSIT', count: '1', total: '7.00' }]);
  });

  test('coincident timestamps aggregate once without rounding or narrowing huge sums', async () => {
    await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
         transaction_type, amount, transaction_date, agent_id, branch_id)
       SELECT $1, $2, channel_id, $3::text || n::text, 'DEPOSIT', 9999999999999.99,
         '2026-09-10T00:00:00Z'::timestamptz, $4, $5
       FROM transaction_channel CROSS JOIN generate_series(1, 1000) n WHERE channel_name = 'SYSTEM'`,
      [fixture.accountId, fixture.adminId, `RPT-HUGE-${fixture.agentId.slice(0, 8)}-`, fixture.agentId, fixture.branchId]);
    await fixture.insert({ amount: '0.01', date: '2026-09-10T00:00:00Z' });
    assert.deepEqual(totals(await report([fixture.agentId], '2026-09-10')),
      [{ type: 'DEPOSIT', count: '1001', total: '9999999999999990.01' }]);
    const { rows } = await client.query(
      `SELECT transaction_count::text, total_value::text FROM vw_rpt01_agent_transactions
       WHERE agent_id = $1 AND transaction_date = '2026-09-10T00:00:00Z'::timestamptz`, [fixture.agentId]);
    assert.deepEqual(rows, [{ transaction_count: '1001', total_value: '9999999999999990.01' }]);
  });

  test('bankwide totals reconcile to attributed ledger; NULL attribution is not assigned to staff', async () => {
    const ids = [fixture.agentId, fixture.secondAgentId, fixture.managerId, fixture.otherAgentId];
    const ledger = (await client.query(
      `SELECT COUNT(transaction_id)::text AS count, SUM(amount)::text AS total
       FROM transaction WHERE agent_id = ANY($1::uuid[])`, [ids])).rows[0];
    const view = (await client.query(
      `SELECT SUM(transaction_count)::text AS count, SUM(total_value)::text AS total
       FROM vw_rpt01_agent_transactions WHERE agent_id = ANY($1::uuid[])`, [ids])).rows[0];
    assert.deepEqual(view, ledger);
    assert.equal((await client.query('SELECT COUNT(*)::text AS count FROM vw_rpt01_agent_transactions WHERE agent_id IS NULL')).rows[0].count, '0');
  });

  test('view retains caller security and denies runtime SELECT pending I-7', async () => {
    const { rows } = await client.query(
      `SELECT reloptions, has_table_privilege('mims_app', oid, 'SELECT') AS runtime_select
       FROM pg_class WHERE oid = 'vw_rpt01_agent_transactions'::regclass`);
    assert.equal(rows[0].runtime_select, false);
    assert.ok(rows[0].reloptions.includes('security_invoker=true'));
    assert.ok(rows[0].reloptions.includes('security_barrier=true'));
    await client.query('SAVEPOINT denied_read');
    await client.query('SET LOCAL ROLE mims_app');
    await assert.rejects(client.query('SELECT agent_id FROM vw_rpt01_agent_transactions'), { code: '42501' });
    await client.query('ROLLBACK TO SAVEPOINT denied_read');
  });

  test('report reads do not alter ledger, balances or audit history', async () => {
    const snapshot = async () => (await client.query(
      `SELECT (SELECT jsonb_agg(to_jsonb(t) ORDER BY transaction_id) FROM transaction t WHERE account_id = $1) AS ledger,
              (SELECT current_balance::text FROM account WHERE account_id = $1) AS balance,
              (SELECT COUNT(*)::text FROM audit_log) AS audit_count`, [fixture.accountId])).rows[0];
    const before = await snapshot(); await report();
    assert.deepEqual(await snapshot(), before);
  });

  test('selective timestamp query can use the existing agent/date index without planner forcing', async () => {
    await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
         transaction_type, amount, transaction_date, agent_id, branch_id)
       SELECT $1, $2, channel_id, $3::text || n::text, 'DEPOSIT', 0.01,
         '2020-01-01T00:00:00Z'::timestamptz + n * interval '1 hour', $4, $5
       FROM transaction_channel CROSS JOIN generate_series(1, 20000) n WHERE channel_name = 'SYSTEM'`,
      [fixture.accountId, fixture.adminId, `RPT-PLAN-${fixture.agentId.slice(0, 8)}-`, fixture.agentId, fixture.branchId]);
    await client.query('ANALYZE transaction');
    const { rows } = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT transaction_type, SUM(transaction_count), SUM(total_value)
       FROM vw_rpt01_agent_transactions
       WHERE agent_id = $1 AND transaction_date >= $2::timestamptz AND transaction_date < $3::timestamptz
       GROUP BY transaction_type`, [fixture.agentId, '2026-08-31T18:30:00Z', '2026-09-01T18:30:00Z']);
    const plan = rows[0]['QUERY PLAN'];
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/rpt01-view-explain.json', JSON.stringify(plan, null, 2));
    const nodes = [];
    function visit(node) { nodes.push(node); for (const child of node.Plans ?? []) visit(child); }
    visit(plan[0].Plan);
    assert.ok(nodes.some(node => node['Index Name'] === 'ix_txn_agent_date'),
      'Selective agent/time view query should use the existing reporting index. See saved plan.');
    assert.ok(!nodes.some(node => node['Relation Name'] === 'transaction' && node['Node Type'] === 'Seq Scan'));
  });
});
