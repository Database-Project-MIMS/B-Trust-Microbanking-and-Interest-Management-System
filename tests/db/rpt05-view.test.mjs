import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pool, requireDisposableDatabase } from '../helpers/customer-fixed-deposits.mjs';
import { rpt05Fixture } from '../helpers/rpt05-fixture.mjs';
import { setRlsContext } from '../../lib/db/rls-context.ts';

describe('P05-M04-T01: customer activity view', () => {
  let client, fixture;
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    await client.query('BEGIN');
    fixture = await rpt05Fixture(client);
  });
  after(async () => {
    if (client) { await client.query('ROLLBACK'); client.release(); }
    await pool.end();
  });

  test('joint account entries are attributed once to each holder, including reversal', async () => {
    const { rows } = await client.query(
      `SELECT customer_id, activity_type, effective_amount::text
       FROM vw_rpt05_customer_activity
       WHERE account_id = $1 AND transaction_id IS NOT NULL
       ORDER BY customer_id, transaction_date`,
      [fixture.jointAccount.account_id],
    );
    assert.equal(rows.length, 4);
    for (const customerId of [fixture.customerId, fixture.secondCustomerId]) {
      assert.deepEqual(rows.filter(row => row.customer_id === customerId).map(row =>
        [row.activity_type, row.effective_amount]), [
        ['DEPOSIT', '40.00'], ['DEPOSIT', '-40.00'],
      ]);
    }
  });

  test('the view preserves customers with no transaction and uses real ledger dates', async () => {
    const { rows } = await client.query(
      `SELECT transaction_id, transaction_date FROM vw_rpt05_customer_activity
       WHERE customer_id = $1`,
      [fixture.emptyCustomerId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transaction_id, null);
    assert.equal(rows[0].transaction_date, null);
  });

  test('security-invoker view respects manager RLS', async () => {
    await client.query('SAVEPOINT manager_view');
    try {
      await client.query('SET LOCAL ROLE mims_app');
      await setRlsContext(client, {
        userId: fixture.managerId, branchId: fixture.branchId, roleName: 'BRANCH_MANAGER',
      });
      const { rows } = await client.query(
        'SELECT DISTINCT customer_id FROM vw_rpt05_customer_activity WHERE customer_id = ANY($1::uuid[])',
        [[fixture.customerId, fixture.otherCustomerId]],
      );
      assert.deepEqual(rows.map(row => row.customer_id), [fixture.customerId]);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT manager_view');
    }
  });

  test('EXPLAIN ANALYZE probes the account/date ledger path', async () => {
    const { rows } = await client.query(
      `EXPLAIN (ANALYZE, FORMAT JSON)
       SELECT transaction_id
       FROM vw_rpt05_customer_activity
       WHERE account_id = $1
         AND transaction_date >= $2::timestamptz
         AND transaction_date < $3::timestamptz`,
      [fixture.ownAccount.account_id, '2026-09-30T18:30:00Z', '2026-10-02T18:30:00Z'],
    );
    const plan = rows[0]['QUERY PLAN'][0];
    assert.ok(plan.Plan);
    assert.equal(typeof plan['Execution Time'], 'number');
    const scanNames = [];
    const walk = node => {
      if (node['Node Type']?.includes('Scan')) scanNames.push(`${node['Node Type']}:${node['Relation Name'] ?? ''}:${node['Index Name'] ?? ''}`);
      for (const child of node.Plans ?? []) walk(child);
    };
    walk(plan.Plan);
    assert.ok(scanNames.some(name => name.includes('transaction')));
    console.log(`RPT-05 selective plan: ${scanNames.join(', ')}; ${plan['Execution Time']} ms`);
  });
});
