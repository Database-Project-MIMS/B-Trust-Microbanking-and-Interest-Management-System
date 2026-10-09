import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase } from '../helpers/customer-fixed-deposits.mjs';
import { rpt05Fixture } from '../helpers/rpt05-fixture.mjs';
import { GET } from '../../app/api/reports/customer-activity/route.ts';

describe('P05-M04-T02: report API, scope, CSV and audit', () => {
  let client, fixture;
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    fixture = await rpt05Fixture(client);
  });
  after(async () => {
    client?.release();
    await pool.end();
  });
  function request(token, query = '') {
    return new NextRequest(`http://localhost/api/reports/customer-activity${query}`, {
      headers: token ? { cookie: `mims_session=${token}` } : {},
    });
  }
  const query = (accountId) => `?from=2026-10-01&to=2026-10-02&branchId=${fixture.branchId}&pageSize=100${accountId ? `&accountId=${accountId}` : ''}`;

  test('authorization and branch scope fail closed', async () => {
    assert.equal((await GET(request(null))).status, 401);
    assert.equal((await GET(request(fixture.tokens.agent))).status, 403);
    assert.equal((await GET(request(fixture.tokens.manager,
      `?branchId=${fixture.otherBranchId}`))).status, 403);
    const manager = await GET(request(fixture.tokens.manager, query()));
    assert.equal(manager.status, 200);
    const rows = (await manager.json()).data.rows;
    assert.ok(rows.every(row => row.branch_id === fixture.branchId));
    assert.ok(rows.every(row => row.customer_id !== fixture.otherCustomerId));
  });

  test('SQL totals handle Colombo midnight, all holders and reversals', async () => {
    const response = await GET(request(fixture.tokens.admin, query(fixture.ownAccount.account_id)));
    assert.equal(response.status, 200);
    const report = (await response.json()).data;
    const first = report.rows.find(row => row.customer_id === fixture.customerId);
    assert.equal(first.deposits, '100.00');
    assert.equal(first.withdrawals, '30.00');
    assert.equal(first.interest, '5.00');
    assert.equal(first.net, '75.00');
    assert.equal(report.grandTotal.net, '75.00');
    assert.equal(report.subtotals.net, report.grandTotal.net);
    const jointResponse = await GET(request(fixture.tokens.admin, query(fixture.jointAccount.account_id)));
    assert.equal(jointResponse.status, 200);
    const jointRows = (await jointResponse.json()).data.rows;
    assert.equal(jointRows.length, 2);
    assert.ok(jointRows.every(row => row.deposits === '0.00' && row.net === '0.00'));
  });

  test('CSV and JSON use identical totals; both accesses are audited', async () => {
    const beforeAudit = (await client.query(
      `SELECT count(*)::int AS n FROM audit_log
       WHERE action = 'REPORT_ACCESSED' AND user_id = $1`,
      [fixture.adminId],
    )).rows[0].n;
    const json = (await (await GET(request(fixture.tokens.admin, query(fixture.ownAccount.account_id)))).json()).data;
    const csvResponse = await GET(request(fixture.tokens.admin, `${query(fixture.ownAccount.account_id)}&format=csv`));
    assert.equal(csvResponse.status, 200);
    const csv = await csvResponse.text();
    const totalLine = csv.trim().split('\n').at(-1);
    assert.deepEqual(totalLine.split(',').slice(-4).map(value => JSON.parse(value)), [
      json.grandTotal.deposits, json.grandTotal.withdrawals,
      json.grandTotal.interest, json.grandTotal.net,
    ]);
    const afterAudit = (await client.query(
      `SELECT count(*)::int AS n FROM audit_log
       WHERE action = 'REPORT_ACCESSED' AND user_id = $1`,
      [fixture.adminId],
    )).rows[0].n;
    assert.equal(afterAudit, beforeAudit + 2);
  });

  test('invalid filters are rejected before querying', async () => {
    for (const suffix of ['?from=2026-02-30', '?pageSize=101', '?page=999999999999999999999', '?format=pdf']) {
      assert.equal((await GET(request(fixture.tokens.admin, suffix))).status, 400);
    }
  });
});
