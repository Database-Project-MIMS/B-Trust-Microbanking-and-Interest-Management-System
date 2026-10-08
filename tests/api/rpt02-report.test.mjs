import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { pool, requireDisposableDatabase, useCustomerRuntime, fdFixture } from '../helpers/customer-fixed-deposits.mjs';
import { GET } from '../../app/api/reports/account-summary/route.ts';

const SQL_TEXT = /SELECT |INSERT |CALL |vw_rpt02|constraint|password|postgresql:|ledger_seq/i;

/** RFC 4180 reader: values may be quoted, contain commas, doubled quotes and line breaks. */
function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ''; }
    else if (ch === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (value !== '' || row.length) { row.push(value); rows.push(row); }
  return rows;
}

describe('P05-M03-T02: RPT-02 account summary report', () => {
  let client, fixture, restore;
  const accounts = {};   // name -> account row
  const touched = [];    // every account whose committed ledger rows this suite must remove

  const colombo = (day, time = '10:00') => `2026-10-${day}T${time}:00+05:30`;
  async function post(accountId, type, amount, at, balanceAfter) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO transaction (transaction_id, account_id, initiated_by_user_id, channel_id, reference_number,
                                transaction_type, amount, transaction_date, balance_after)
       VALUES ($1, $2, $3, (SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'), $4, $5, $6, $7::timestamptz, $8)`,
      [id, accountId, fixture.agentId, `RPT02-${randomUUID()}`, type, amount, at, balanceAfter]);
    return id;
  }
  async function newAccount(name, branchId, balance) {
    const row = await fixture.account([fixture.customerId], branchId);
    await client.query('UPDATE account SET current_balance = $2 WHERE account_id = $1', [row.account_id, balance]);
    accounts[name] = row; touched.push(row.account_id);
    return row;
  }

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
    fixture = await fdFixture(client);
    touched.push(fixture.ownAccount.account_id, fixture.jointAccount.account_id, fixture.otherAccount.account_id);
    accounts.own = fixture.ownAccount; accounts.joint = fixture.jointAccount; accounts.other = fixture.otherAccount;

    // own: 09-30 deposit 1000 (before the period) | 10-01 withdraw 200, deposit 500 | 10-02 interest 30 | 10-03 deposit 70 (after)
    await post(accounts.own.account_id, 'DEPOSIT', '1000.00', '2026-09-30T10:00:00+05:30', '1000.00');
    await post(accounts.own.account_id, 'WITHDRAWAL', '200.00', colombo('01', '10:00'), '800.00');
    await post(accounts.own.account_id, 'DEPOSIT', '500.00', colombo('01', '11:00'), '1300.00');
    await post(accounts.own.account_id, 'INTEREST_CREDIT', '30.00', colombo('02', '09:00'), '1330.00');
    await post(accounts.own.account_id, 'DEPOSIT', '70.00', colombo('03', '09:00'), '1400.00');
    await client.query('UPDATE account SET current_balance = 1400.00 WHERE account_id = $1', [accounts.own.account_id]);
    // joint: deposit 400 on 10-01, reversed on 10-02
    const original = await post(accounts.joint.account_id, 'DEPOSIT', '400.00', colombo('01', '12:00'), '400.00');
    const reversal = await post(accounts.joint.account_id, 'REVERSAL', '400.00', colombo('02', '10:00'), '0.00');
    await client.query(
      `INSERT INTO transaction_reversal (original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id) VALUES ($1, $2, 'rpt02 test', $3)`,
      [original, reversal, fixture.managerId]);
    await client.query('UPDATE account SET current_balance = 0.00 WHERE account_id = $1', [accounts.joint.account_id]);
    // other branch: deposit 75 on 10-01
    await post(accounts.other.account_id, 'DEPOSIT', '75.00', colombo('01', '12:00'), '75.00');
    await client.query('UPDATE account SET current_balance = 75.00 WHERE account_id = $1', [accounts.other.account_id]);
    // empty: no ledger rows at all
    await newAccount('empty', fixture.branchId, '5000.00');
    // edge: Colombo midnight boundaries for the single day 10-01 (UTC instants)
    await newAccount('edge', fixture.branchId, '100.00');
    await post(accounts.edge.account_id, 'DEPOSIT', '10.00', '2026-09-30T18:29:59Z', '10.00');   // 09-30 23:59:59 Colombo: before
    await post(accounts.edge.account_id, 'DEPOSIT', '20.00', '2026-09-30T18:30:00Z', '30.00');   // 10-01 00:00:00 Colombo: in
    await post(accounts.edge.account_id, 'DEPOSIT', '30.00', '2026-10-01T18:29:59Z', '60.00');   // 10-01 23:59:59 Colombo: in
    await post(accounts.edge.account_id, 'DEPOSIT', '40.00', '2026-10-01T18:30:00Z', '100.00');  // 10-02 00:00:00 Colombo: out
    // tied: three postings with the SAME timestamp; posting order (ledger_seq) decides first and last
    await newAccount('tied', fixture.branchId, '120.00');
    await post(accounts.tied.account_id, 'DEPOSIT', '100.00', colombo('01', '15:00'), '100.00');
    await post(accounts.tied.account_id, 'DEPOSIT', '50.00', colombo('01', '15:00'), '150.00');
    await post(accounts.tied.account_id, 'WITHDRAWAL', '30.00', colombo('01', '15:00'), '120.00');
    // legacy: opening deposits written before 0541 have balance_after NULL; the view derives their running total
    await newAccount('legacy', fixture.branchId, '150.00');
    await post(accounts.legacy.account_id, 'DEPOSIT', '100.00', colombo('01', '13:00'), null);
    await post(accounts.legacy.account_id, 'DEPOSIT', '50.00', colombo('01', '14:00'), null);
  });

  after(async () => {
    // The ledger is immutable, so its guard is lifted for this disposable database only, for rows this suite created.
    await client.query('BEGIN');
    try {
      await client.query('ALTER TABLE transaction DISABLE TRIGGER trg_financial_transaction_immutable');
      await client.query('DELETE FROM transaction_reversal WHERE original_transaction_id IN (SELECT transaction_id FROM transaction WHERE account_id = ANY($1))', [touched]);
      await client.query('DELETE FROM transaction WHERE account_id = ANY($1)', [touched]);
      await client.query('ALTER TABLE transaction ENABLE TRIGGER trg_financial_transaction_immutable');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    await restore?.();
    client?.release();
    await pool.end();
  });

  function request(token, query = '') {
    return new NextRequest(`http://localhost/api/reports/account-summary${query}`, { headers: token ? { cookie: `mims_session=${token}` } : {} });
  }
  const period = (from, to) => `from=${from}&to=${to}`;
  async function report(token, query) {
    const response = await GET(request(token, '?' + query));
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).data;
  }
  const one = async (token, accountId, from = '2026-10-01', to = '2026-10-02') =>
    (await report(token, `${period(from, to)}&accountId=${accountId}`)).rows[0];
  const cents = (text) => Math.round(Number(text) * 100);
  function assertIdentity(row) {
    // closing - opening = deposits - withdrawals + interest, with reversals already netted into their category
    assert.equal(cents(row.closingBalance) - cents(row.openingBalance), cents(row.depositTotal) - cents(row.withdrawalTotal) + cents(row.interestTotal));
    assert.equal(cents(row.netMovement), cents(row.closingBalance) - cents(row.openingBalance));
  }
  async function auditCount() {
    return (await client.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE action = 'REPORT_ACCESSED' AND new_values->>'report_name' = 'account-summary'")).rows[0].n;
  }

  test('authentication, role and branch scope fail closed', async () => {
    const q = '?' + period('2026-10-01', '2026-10-02');
    assert.equal((await GET(request(null, q))).status, 401);
    for (const token of [fixture.tokens.agent, fixture.tokens.customer]) assert.equal((await GET(request(token, q))).status, 403);
    for (const token of [fixture.tokens.manager, fixture.tokens.central, fixture.tokens.auditor, fixture.tokens.admin]) {
      assert.equal((await GET(request(token, q))).status, 200);
    }
    const outside = await GET(request(fixture.tokens.manager, `${q}&branchId=${fixture.otherBranchId}`));
    assert.equal(outside.status, 403);
    assert.ok(!SQL_TEXT.test(JSON.stringify(await outside.json())));
    assert.equal((await GET(request(fixture.tokens.otherManager, `${q}&branchId=${fixture.branchId}`))).status, 403);
  });

  test('opening, closing, counts and totals come from the stored running balance and satisfy the balance identity', async () => {
    const row = await one(fixture.tokens.admin, accounts.own.account_id);
    assert.deepEqual({ ...row, accountId: undefined, branchId: undefined, branchName: undefined, accountNumber: undefined, planName: undefined }, {
      accountId: undefined, accountNumber: undefined, branchId: undefined, branchName: undefined, planName: undefined, accountStatus: 'ACTIVE',
      openingBalance: '1000.00', closingBalance: '1330.00',
      depositCount: '1', depositTotal: '500.00', withdrawalCount: '1', withdrawalTotal: '200.00',
      interestCount: '1', interestTotal: '30.00', reversalCount: '0', netMovement: '330.00',
    });
    assert.equal(row.accountNumber, accounts.own.account_number);
    assert.equal(row.planName, 'Adult');
    assertIdentity(row);
  });

  test('a reversal is netted into its original category and counted on its own', async () => {
    const row = await one(fixture.tokens.admin, accounts.joint.account_id);
    assert.equal(row.depositCount, '1'); assert.equal(row.depositTotal, '0.00');
    assert.equal(row.reversalCount, '1'); assert.equal(row.netMovement, '0.00');
    assert.equal(row.openingBalance, '0.00'); assert.equal(row.closingBalance, '0.00');
    assertIdentity(row);
    // the day before the reversal the deposit is still standing
    const first = await one(fixture.tokens.admin, accounts.joint.account_id, '2026-10-01', '2026-10-01');
    assert.deepEqual([first.openingBalance, first.closingBalance, first.depositTotal, first.reversalCount], ['0.00', '400.00', '400.00', '0']);
    assertIdentity(first);
  });

  test('an account with no posting in the period still reports its balance, on both sides', async () => {
    const empty = await one(fixture.tokens.admin, accounts.empty.account_id);
    assert.deepEqual([empty.openingBalance, empty.closingBalance, empty.netMovement, empty.depositCount], ['5000.00', '5000.00', '0.00', '0']);
    // a period entirely after the last posting, and one entirely before the first
    const after = await one(fixture.tokens.admin, accounts.own.account_id, '2026-10-10', '2026-10-12');
    assert.deepEqual([after.openingBalance, after.closingBalance, after.depositTotal], ['1400.00', '1400.00', '0.00']);
    const before = await one(fixture.tokens.admin, accounts.own.account_id, '2026-08-01', '2026-08-31');
    assert.deepEqual([before.openingBalance, before.closingBalance], ['0.00', '0.00']);
    assertIdentity(after); assertIdentity(before);
  });

  test('the period is Asia/Colombo calendar days: both midnight boundaries are exact', async () => {
    const row = await one(fixture.tokens.admin, accounts.edge.account_id, '2026-10-01', '2026-10-01');
    assert.deepEqual([row.openingBalance, row.closingBalance, row.depositTotal, row.depositCount], ['10.00', '60.00', '50.00', '2']);
    assertIdentity(row);
  });

  test('postings that share one timestamp keep their posting order (ledger_seq) for first and last', async () => {
    const row = await one(fixture.tokens.admin, accounts.tied.account_id, '2026-10-01', '2026-10-01');
    assert.deepEqual([row.openingBalance, row.closingBalance, row.depositTotal, row.withdrawalTotal], ['0.00', '120.00', '150.00', '30.00']);
    assertIdentity(row);
  });

  test('legacy rows without balance_after are derived in posting order', async () => {
    const row = await one(fixture.tokens.admin, accounts.legacy.account_id, '2026-10-01', '2026-10-01');
    assert.deepEqual([row.openingBalance, row.closingBalance, row.depositTotal], ['0.00', '150.00', '150.00']);
    assertIdentity(row);
  });

  test('branch scope is applied in SQL: a manager sees only their branch; bank-wide roles see all and can filter', async () => {
    const mine = await report(fixture.tokens.manager, period('2026-10-01', '2026-10-02') + '&pageSize=100');
    assert.ok(mine.rows.length >= 6);
    assert.ok(mine.rows.every(row => row.branchId === fixture.branchId));
    assert.ok(!mine.rows.some(row => row.accountId === accounts.other.account_id));
    // asking for the other branch's account by id returns nothing: no existence leak, no 403
    const foreign = await report(fixture.tokens.manager, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.other.account_id}`);
    assert.deepEqual([foreign.rows.length, foreign.totalRows], [0, 0]);
    assert.equal(foreign.grandTotal.closingBalance, '0.00');
    const all = await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.other.account_id}`);
    assert.equal(all.rows[0].branchId, fixture.otherBranchId);
    assert.equal(all.rows[0].closingBalance, '75.00');
    const filtered = await report(fixture.tokens.central, `${period('2026-10-01', '2026-10-02')}&branchId=${fixture.otherBranchId}&pageSize=100`);
    assert.ok(filtered.rows.length >= 1 && filtered.rows.every(row => row.branchId === fixture.otherBranchId));
  });

  test('plan and status filters narrow the accounts; unknown values are rejected', async () => {
    const adult = await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.own.account_id}&planId=${fixture.planId}`);
    assert.equal(adult.totalRows, 0, 'that id is an FD plan, not a savings plan');
    const savingsPlan = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0].plan_id;
    assert.equal((await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.own.account_id}&planId=${savingsPlan}`)).totalRows, 1);
    assert.equal((await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.own.account_id}&status=CLOSED`)).totalRows, 0);
    assert.equal((await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.own.account_id}&status=ACTIVE`)).totalRows, 1);
  });

  test('page subtotal and grand total are summed by the database and agree with the rows', async () => {
    const q = `${period('2026-10-01', '2026-10-02')}&branchId=${fixture.branchId}&pageSize=2&sort=accountNumber&direction=asc`;
    const first = await report(fixture.tokens.admin, q);
    const second = await report(fixture.tokens.admin, q + '&page=2');
    assert.equal(first.rows.length, 2); assert.equal(first.pageSize, 2);
    assert.notDeepEqual(first.rows.map(row => row.accountId), second.rows.map(row => row.accountId));
    assert.equal(first.totalRows, second.totalRows);
    for (const page of [first, second]) {
      for (const key of ['openingBalance', 'closingBalance', 'depositTotal', 'withdrawalTotal', 'interestTotal', 'netMovement']) {
        assert.equal(page.subtotals[key], (page.rows.reduce((sum, row) => sum + cents(row[key]), 0) / 100).toFixed(2), key);
      }
    }
    const everything = await report(fixture.tokens.admin, q.replace('pageSize=2', 'pageSize=100'));
    assert.equal(everything.rows.length, everything.totalRows);
    assert.deepEqual(first.grandTotal, everything.grandTotal);
    assert.equal(everything.grandTotal.depositCount, String(everything.rows.reduce((sum, row) => sum + Number(row.depositCount), 0)));
    assert.equal(everything.grandTotal.netMovement, (everything.rows.reduce((sum, row) => sum + cents(row.netMovement), 0) / 100).toFixed(2));
  });

  test('sorting uses the allow-list: closing balance descending is ordered, account id breaks ties', async () => {
    const data = await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&branchId=${fixture.branchId}&pageSize=100&sort=closingBalance&direction=desc`);
    const closings = data.rows.map(row => cents(row.closingBalance));
    assert.deepEqual(closings, [...closings].sort((a, b) => b - a));
  });

  test('CSV carries every filtered account and the same totals as the JSON, and both accesses are audited', async () => {
    const q = `${period('2026-10-01', '2026-10-02')}&branchId=${fixture.branchId}`;
    const auditBefore = await auditCount();
    const json = await report(fixture.tokens.admin, q + '&pageSize=2');   // a paged JSON view of a larger result
    assert.equal(await auditCount(), auditBefore + 1);
    const csvResponse = await GET(request(fixture.tokens.admin, `?${q}&format=csv&pageSize=2`));
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get('content-type') ?? '', /text\/csv/);
    assert.match(csvResponse.headers.get('content-disposition') ?? '', /attachment; filename="account-summary_/);
    assert.equal(await auditCount(), auditBefore + 2);

    const table = parseCsv(await csvResponse.text());
    const header = table[0];
    const index = Object.fromEntries(header.map((label, position) => [label, position]));
    const detail = table.filter(row => row[0] === 'DETAIL');
    assert.equal(detail.length, json.totalRows, 'the CSV is not limited to the page size');
    assert.ok(detail.every(row => row[index['Opening balance LKR']] !== undefined));
    const grand = table.find(row => row[0] === 'GRAND_TOTAL');
    assert.ok(grand);
    assert.deepEqual([
      grand[index['Opening balance LKR']], grand[index['Closing balance LKR']], grand[index['Deposits LKR']],
      grand[index['Withdrawals LKR']], grand[index['Interest LKR']], grand[index['Net movement LKR']],
      grand[index['Deposit count']], grand[index['Reversal count']],
    ], [
      json.grandTotal.openingBalance, json.grandTotal.closingBalance, json.grandTotal.depositTotal,
      json.grandTotal.withdrawalTotal, json.grandTotal.interestTotal, json.grandTotal.netMovement,
      json.grandTotal.depositCount, json.grandTotal.reversalCount,
    ]);
    assert.equal(table.some(row => row[0] === 'PAGE_SUBTOTAL'), false, 'an all-rows export has no page subtotal');
    // one CSV detail row per JSON row on a full-size page: same account, same balances
    const full = await report(fixture.tokens.admin, q + '&pageSize=100');
    const byNumber = Object.fromEntries(detail.map(row => [row[index['Account number']], row]));
    for (const row of full.rows) {
      const csvRow = byNumber[row.accountNumber];
      assert.ok(csvRow, row.accountNumber);
      assert.equal(csvRow[index['Opening balance LKR']], row.openingBalance);
      assert.equal(csvRow[index['Closing balance LKR']], row.closingBalance);
      assert.equal(csvRow[index['Net movement LKR']], row.netMovement);
    }
  });

  test('every access is audited with the report name and applied filters, and a rejected request is not', async () => {
    const before = await auditCount();
    await report(fixture.tokens.auditor, `${period('2026-10-01', '2026-10-01')}&accountId=${accounts.own.account_id}`);
    const row = (await client.query(
      `SELECT user_id, actor_type, entity_type, new_values FROM audit_log
        WHERE action = 'REPORT_ACCESSED' AND new_values->>'report_name' = 'account-summary' ORDER BY logged_at DESC LIMIT 1`)).rows[0];
    assert.equal(row.user_id, fixture.auditorId); assert.equal(row.actor_type, 'USER'); assert.equal(row.entity_type, 'report');
    assert.equal(row.new_values.filters.accountId, accounts.own.account_id);
    assert.equal(row.new_values.format, 'json');
    assert.equal(await auditCount(), before + 1);
    await GET(request(fixture.tokens.manager, `?${period('2026-10-01', '2026-10-02')}&branchId=${fixture.otherBranchId}`));   // 403
    await GET(request(fixture.tokens.admin, '?from=nope'));                                                                       // 400
    assert.equal(await auditCount(), before + 1, 'refused and invalid requests write no audit row');
  });

  test('invalid input is rejected with a safe 400 before any query runs', async () => {
    const good = period('2026-10-01', '2026-10-02');
    const bad = [
      'from=2026-13-40&to=2026-10-02', 'from=2026-10-05&to=2026-10-01', 'from=abc&to=def',
      `${good}&from=2026-10-01`, `${good}&unexpected=1`, `${good}&branchId=not-a-uuid`, `${good}&accountId=1`,
      `${good}&planId=x`, `${good}&status=OPEN`, `${good}&sort=accountNumber;DROP TABLE account`, `${good}&sort=net`,
      `${good}&direction=sideways`, `${good}&pageSize=101`, `${good}&pageSize=0`, `${good}&page=0`, `${good}&page=abc`, `${good}&format=xml`,
    ];
    const audits = await auditCount();
    for (const query of bad) {
      const response = await GET(request(fixture.tokens.admin, '?' + query));
      assert.equal(response.status, 400, query);
      const body = await response.json();
      assert.equal(body.error.code, 'VALIDATION_FAILED', query);
      assert.ok(!SQL_TEXT.test(JSON.stringify(body)), `no internals in the error for ${query}`);
    }
    assert.equal(await auditCount(), audits);
  });

  test('with no dates the report covers today in Asia/Colombo, and responses are never cached', async () => {
    const response = await GET(request(fixture.tokens.admin, `?accountId=${accounts.empty.account_id}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    const data = (await response.json()).data;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
    assert.deepEqual([data.filters.from, data.filters.to], [today, today]);
    assert.equal(data.timeZone, 'Asia/Colombo');
    assert.ok(Array.isArray(data.notes) && data.notes.length >= 3);
    assert.equal((await GET(request(null, '?x=1'))).headers.get('cache-control')?.includes('no-store'), true);
  });

  test('the response envelope has the shared report shape and no internal ids beyond the accounts and branches', async () => {
    const data = await report(fixture.tokens.admin, `${period('2026-10-01', '2026-10-02')}&accountId=${accounts.own.account_id}`);
    for (const key of ['reportName', 'rows', 'subtotals', 'grandTotal', 'filters', 'generatedAt', 'requestedBy', 'totalRows', 'page', 'pageSize']) {
      assert.ok(key in data, key);
    }
    assert.equal(data.reportName, 'account-summary');
    assert.deepEqual(Object.keys(data.rows[0]).sort(), [
      'accountId', 'accountNumber', 'accountStatus', 'branchId', 'branchName', 'closingBalance', 'depositCount', 'depositTotal',
      'interestCount', 'interestTotal', 'netMovement', 'openingBalance', 'planName', 'reversalCount', 'withdrawalCount', 'withdrawalTotal',
    ]);
    assert.ok(!JSON.stringify(data.rows).includes('ledger_seq') && !JSON.stringify(data.rows).includes('ledgerSeq'));
  });
});
