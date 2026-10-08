import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
const { GET: LIST, POST: OPEN } = await import('../../app/api/accounts/route.ts');
const { GET: DETAIL } = await import('../../app/api/accounts/[id]/route.ts');
const { POST: ADD_HOLDER } = await import('../../app/api/accounts/[id]/holders/route.ts');
const { POST: CLOSE } = await import('../../app/api/accounts/[id]/close/route.ts');

const UUID_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SQL_TEXT = /SELECT |INSERT |CALL |constraint|password|postgresql:|sp_open|sp_add/i;

describe('P02-M03-T05: account routes under mims_app', () => {
  let client, fixture, restore, plans, today;
  const branchIds = [];
  const csrf = randomBytes(32).toString('hex');
  const tokens = {};

  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    restore = useCustomerRuntime(pool);
    plans = Object.fromEntries((await client.query('SELECT plan_id, plan_name FROM savings_plan')).rows.map(p => [p.plan_name, p.plan_id]));
    today = "(now() AT TIME ZONE 'Asia/Colombo')::date";
    await setCalendar(true);
  });
  beforeEach(async () => {
    fixture = await createFixture(client);
    branchIds.push(fixture.branchId, fixture.otherBranchId);
    tokens.agent = await session(fixture.agentId);
    tokens.manager = await session(fixture.managerId);
    tokens.otherManager = await session(fixture.otherManagerId);
    tokens.customerLogin = await session(fixture.customerLoginId);
    tokens.centralOps = await session(await fixture.staff('CENTRAL_OPS'));
    tokens.auditor = await session(await fixture.staff('AUDITOR'));
    tokens.otherAgent = await session(await fixture.staff('AGENT', fixture.otherBranchId));
    tokens.secondAgent = await session(fixture.secondAgentId);
  });
  after(async () => {
    await removeCommittedRows();
    await client.query(`DELETE FROM business_calendar WHERE calendar_date = ${today} AND description = 'TEST-ACCT-API'`);
    await restore?.(); client?.release(); await pool.end();
  });

  // Committed fixtures must not leak: the seed minimum check (P01-M05-T03) treats a small non-zero
  // ledger/account count as failure. The ledger is immutable, so its guard is lifted for this
  // disposable database only, and only for rows these tests created.
  async function removeCommittedRows() {
    const scope = 'SELECT account_id FROM account WHERE branch_id = ANY($1)';
    await client.query('BEGIN');
    try {
      await client.query('ALTER TABLE transaction DISABLE TRIGGER trg_financial_transaction_immutable');
      await client.query(`DELETE FROM transaction WHERE account_id IN (${scope})`, [branchIds]);
      await client.query('ALTER TABLE transaction ENABLE TRIGGER trg_financial_transaction_immutable');
      await client.query(`DELETE FROM fixed_deposit WHERE account_id IN (${scope})`, [branchIds]);
      await client.query(`DELETE FROM account_opening_request WHERE account_id IN (${scope})`, [branchIds]);
      await client.query(`DELETE FROM joint_mandate WHERE account_id IN (${scope})`, [branchIds]);
      await client.query(`DELETE FROM account_holder WHERE account_id IN (${scope})`, [branchIds]);
      await client.query('DELETE FROM account WHERE branch_id = ANY($1)', [branchIds]);
      await client.query(`DELETE FROM customer_agent WHERE customer_id IN (SELECT customer_id FROM customer WHERE customer_number LIKE 'ACT-%')`);
      await client.query(`DELETE FROM customer_document WHERE customer_id IN (SELECT customer_id FROM customer WHERE customer_number LIKE 'ACT-%')`);
      await client.query(`DELETE FROM customer WHERE customer_number LIKE 'ACT-%'`);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  async function setCalendar(open) {
    await client.query(
      `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
       VALUES (${today}, $1, '00:00', '23:59:59', 'TEST-ACCT-API')
       ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = EXCLUDED.is_business_day,
         open_time = '00:00', close_time = '23:59:59'`, [open]);
  }
  async function session(userId) {
    const token = randomBytes(32).toString('hex');
    await client.query("INSERT INTO user_session(user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '1 hour')",
      [userId, createHash('sha256').update(token).digest('hex')]);
    return token;
  }
  async function makeCustomer({ dob = '1990-01-01', verified = true, branch = fixture.branchId, login = null, assignTo = fixture.agentId } = {}) {
    const marker = randomUUID().slice(0, 12);
    const id = (await client.query(
      `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email, app_user_id)
       VALUES ($1,$2,$3,'Synthetic Account Holder',$4,$5,$6) RETURNING customer_id`,
      [branch, `ACT-${marker}`, `ACT-ID-${marker}`, dob, `act-${marker}@example.invalid`, login])).rows[0].customer_id;
    if (verified) await client.query(
      `INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date)
       VALUES ($1,'NIC','synthetic/nic.pdf',$2,now())`, [id, fixture.managerId]);
    if (assignTo) await client.query('INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1,$2)', [id, assignTo]);
    return id;
  }
  function request(method, path, { token = tokens.agent, body, key, csrfHeader = csrf } = {}) {
    const headers = { cookie: `mims_csrf=${csrf}${token ? `; mims_session=${token}` : ''}` };
    if (csrfHeader) headers['x-csrf-token'] = csrfHeader;
    if (key) headers['idempotency-key'] = key;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(`http://localhost${path}`, { method, headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  }
  const newKey = () => `key-${randomBytes(8).toString('hex')}`;
  const individual = (customerId, extra = {}) => ({ planId: plans.Adult, branchId: fixture.branchId,
    holders: [{ customerId, holderType: 'PRIMARY' }], ...extra });
  const joint = (ids, extra = {}) => ({ planId: plans.Joint, branchId: fixture.branchId,
    holders: ids.map((customerId, i) => ({ customerId, holderType: i === 0 ? 'PRIMARY' : 'JOINT' })),
    mandate: { type: 'ALL_HOLDERS' }, ...extra });
  const open = (body, opts = {}) => OPEN(request('POST', '/api/accounts', { key: newKey(), body, ...opts }));
  async function openOk(body, opts) {
    const response = await open(body, opts);
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return (await response.json()).data;
  }
  const detail = (id, token = tokens.manager) => DETAIL(request('GET', `/api/accounts/${id}`, { token }), { params: Promise.resolve({ id }) });
  const addHolder = (id, body, token = tokens.manager) => ADD_HOLDER(request('POST', `/api/accounts/${id}/holders`, { token, body }), { params: Promise.resolve({ id }) });
  async function tableCounts() {
    return (await client.query(`SELECT (SELECT count(*)::int FROM account) AS accounts,
      (SELECT count(*)::int FROM transaction) AS ledger, (SELECT count(*)::int FROM account_opening_request) AS requests,
      (SELECT count(*)::int FROM account_holder) AS holders`)).rows[0];
  }
  async function failsSafely(response, status, code, before) {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.ok(!UUID_TEXT.test(body.error.message) && !SQL_TEXT.test(body.error.message), `unsafe message: ${body.error.message}`);
    if (before) assert.deepEqual(await tableCounts(), before);
    return body;
  }

  // ------------------------------------------------------------------ opening

  test('opens an individual account and returns the safe result', async () => {
    const customerId = await makeCustomer();
    const data = await openOk(individual(customerId));
    assert.match(data.accountNumber, /^[A-Z0-9-]+-\d{8}$/);
    assert.equal(data.currentBalance, '0.00');
    const row = (await client.query('SELECT branch_id, opened_by_agent_id, status FROM account WHERE account_id = $1', [data.accountId])).rows[0];
    assert.deepEqual(row, { branch_id: fixture.branchId, opened_by_agent_id: fixture.agentId, status: 'ACTIVE' });
    const audit = await client.query("SELECT user_id FROM audit_log WHERE entity_type = 'account' AND entity_id = $1", [data.accountId]);
    assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].user_id, fixture.agentId);
  });

  test('an initial deposit writes one ledger row that matches the balance exactly', async () => {
    const customerId = await makeCustomer();
    const data = await openOk(individual(customerId, { initialDeposit: '1500.50' }));
    assert.equal(data.currentBalance, '1500.50');
    const ledger = await client.query('SELECT amount::text, transaction_type FROM transaction WHERE account_id = $1', [data.accountId]);
    assert.deepEqual(ledger.rows, [{ amount: '1500.50', transaction_type: 'DEPOSIT' }]);
  });

  test('a repeated Idempotency-Key replays the original result without a second account or credit', async () => {
    const body = individual(await makeCustomer(), { initialDeposit: '1200.00' });
    const key = newKey();
    const first = await OPEN(request('POST', '/api/accounts', { key, body }));
    assert.equal(first.status, 201);
    const created = (await first.json()).data;
    const before = await tableCounts();
    const replay = await OPEN(request('POST', '/api/accounts', { key, body }));
    assert.equal(replay.status, 200);
    assert.deepEqual((await replay.json()).data, created);
    assert.deepEqual(await tableCounts(), before);
  });

  test('the same key with a different request is rejected and changes nothing', async () => {
    const key = newKey();
    const customerId = await makeCustomer();
    assert.equal((await OPEN(request('POST', '/api/accounts', { key, body: individual(customerId) }))).status, 201);
    const before = await tableCounts();
    const other = await OPEN(request('POST', '/api/accounts', { key, body: individual(customerId, { initialDeposit: '2000.00' }) }));
    await failsSafely(other, 422, 'IDEMPOTENCY_KEY_REUSED', before);
  });

  test('concurrent requests with one key open exactly one account', async () => {
    const body = individual(await makeCustomer(), { initialDeposit: '1000.00' });
    const key = newKey(); const before = await tableCounts();
    const [a, b] = await Promise.all([1, 2].map(() => OPEN(request('POST', '/api/accounts', { key, body }))));
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    const [da, db] = [(await a.json()).data, (await b.json()).data];
    assert.deepEqual(da, db);
    const after = await tableCounts();
    assert.equal(after.accounts, before.accounts + 1); assert.equal(after.ledger, before.ledger + 1);
  });

  test('a failed open stores no key, so the same key succeeds after the problem is fixed', async () => {
    const key = newKey(); const unverified = await makeCustomer({ verified: false });
    const before = await tableCounts();
    await failsSafely(await OPEN(request('POST', '/api/accounts', { key, body: individual(unverified) })), 409, 'DOCUMENTS_NOT_VERIFIED', before);
    await client.query(`INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date)
      VALUES ($1,'NIC','synthetic/late.pdf',$2,now())`, [unverified, fixture.managerId]);
    assert.equal((await OPEN(request('POST', '/api/accounts', { key, body: individual(unverified) }))).status, 201);
  });

  test('a joint account opens with a mandate and its detail shows holders and mandate', async () => {
    const ids = [await makeCustomer(), await makeCustomer()];
    const data = await openOk(joint(ids, { initialDeposit: '5000.00' }));
    const response = await detail(data.accountId); assert.equal(response.status, 200);
    const account = (await response.json()).data;
    assert.equal(account.planName, 'Joint'); assert.equal(account.currentBalance, '5000.00');
    assert.equal(account.holderCount, 2); assert.equal(account.holders.length, 2);
    assert.deepEqual({ min: account.minHolders, max: account.maxHolders, minBalance: account.minBalance }, { min: 2, max: 4, minBalance: '5000.00' });
    assert.equal(account.holders[0].holderType, 'PRIMARY');
    assert.deepEqual({ type: account.mandate.mandateType, n: account.mandate.requiredSignatories }, { type: 'ALL_HOLDERS', n: 2 });
    assert.ok(!('nicPassportNo' in account.holders[0]));
  });

  test('detail reports the amount available above the plan minimum and the last transaction', async () => {
    const empty = (await openOk(individual(await makeCustomer()))).accountId;
    const none = (await (await detail(empty)).json()).data;
    assert.deepEqual({ available: none.availableToWithdraw, last: none.lastTransaction, mandate: none.mandate }, { available: '0.00', last: null, mandate: null });

    const funded = (await openOk(individual(await makeCustomer(), { initialDeposit: '2500.50' }))).accountId;
    const account = (await (await detail(funded)).json()).data;
    assert.equal(account.minBalance, '1000.00'); assert.equal(account.availableToWithdraw, '1500.50');
    assert.equal(account.lastTransaction.transactionType, 'DEPOSIT'); assert.equal(account.lastTransaction.amount, '2500.50');
    assert.match(account.lastTransaction.referenceNumber, /\S/); assert.ok(!Number.isNaN(Date.parse(account.lastTransaction.transactionDate)));
    assert.deepEqual(Object.keys(account.lastTransaction).sort(), ['amount', 'referenceNumber', 'transactionDate', 'transactionType']);

    // At the minimum nothing is available; a balance below it (not reachable through the app) never goes negative.
    const atMinimum = (await openOk(individual(await makeCustomer(), { initialDeposit: '1000.00' }))).accountId;
    assert.equal((await (await detail(atMinimum)).json()).data.availableToWithdraw, '0.00');
    await client.query('UPDATE account SET current_balance = 400.00 WHERE account_id = $1', [atMinimum]);
    assert.equal((await (await detail(atMinimum)).json()).data.availableToWithdraw, '0.00');
  });

  test('detail shows the newest ledger row when there are several', async () => {
    const { accountId } = await openOk(individual(await makeCustomer(), { initialDeposit: '1500.00' }));
    await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
       SELECT $1, $2, channel_id, 'TEST-T03-LATEST', 'DEPOSIT', 25.25, now() + interval '1 minute', 1525.25 FROM transaction_channel LIMIT 1`,
      [accountId, fixture.managerId]);
    const account = (await (await detail(accountId)).json()).data;
    assert.equal(account.lastTransaction.referenceNumber, 'TEST-T03-LATEST'); assert.equal(account.lastTransaction.amount, '25.25');
  });

  test('detail reports whether the stored mandate is currently effective', async () => {
    const { accountId } = await openOk(joint([await makeCustomer(), await makeCustomer()]));
    const state = async () => (await (await detail(accountId)).json()).data.mandate.state;
    assert.equal(await state(), 'EFFECTIVE');
    await client.query(`UPDATE joint_mandate SET effective_from = ${today} + 1 WHERE account_id = $1`, [accountId]);
    assert.equal(await state(), 'NOT_YET_EFFECTIVE');
    await client.query(`UPDATE joint_mandate SET effective_from = ${today} - 10, effective_to = ${today} - 1 WHERE account_id = $1`, [accountId]);
    assert.equal(await state(), 'EXPIRED');
    await client.query(`UPDATE joint_mandate SET effective_to = ${today} WHERE account_id = $1`, [accountId]);
    assert.equal(await state(), 'EFFECTIVE');
  });

  test('the new detail fields respect scope and leak no internals', async () => {
    const customerId = await makeCustomer({ login: fixture.customerLoginId });
    const { accountId } = await openOk(individual(customerId, { initialDeposit: '3000.00' }));
    const own = (await (await detail(accountId, tokens.customerLogin)).json()).data;
    assert.equal(own.availableToWithdraw, '2000.00'); assert.equal(own.lastTransaction.amount, '3000.00');
    const text = JSON.stringify(own.lastTransaction);
    assert.ok(!UUID_TEXT.test(text), 'no ids in the last transaction');
    await failsSafely(await detail(accountId, tokens.otherManager), 404, 'NOT_FOUND');
    await failsSafely(await detail(accountId, tokens.otherAgent), 404, 'NOT_FOUND');
  });

  test('database rule failures map to specific safe errors with no writes', async () => {
    const [adult, adult2, minor, unverified] = [await makeCustomer(), await makeCustomer(),
      await makeCustomer({ dob: '2018-01-01' }), await makeCustomer({ verified: false })];
    const before = await tableCounts();
    const cases = [
      [joint([adult]), 'INVALID_HOLDER_COUNT'],
      [individual(minor), 'PLAN_ELIGIBILITY_FAILED'],
      [individual(unverified), 'DOCUMENTS_NOT_VERIFIED'],
      [individual(adult, { initialDeposit: '999.99' }), 'BELOW_MINIMUM_BALANCE'],
      [{ ...joint([adult, adult2]), mandate: undefined }, 'MANDATE_REQUIRED'],
      [individual(adult, { mandate: { type: 'ANY_ONE' } }), 'MANDATE_NOT_ALLOWED'],
      [joint([adult, minor]), 'UNDERAGE_HOLDER'],
      [joint([adult, adult2], { mandate: { type: 'ALL_HOLDERS', requiredSignatories: 3 } }), 'INVALID_MANDATE_SIGNATORIES'],
      [individual(randomUUID()), 'HOLDER_NOT_FOUND'],
      [individual(adult, { planId: randomUUID() }), 'PLAN_NOT_FOUND'],
    ];
    for (const [body, code] of cases) {
      const body2 = await failsSafely(await open(body), code === 'PLAN_NOT_FOUND' ? 422 : 409, code, before);
      assert.ok(body2.error.message.length > 0);
    }
  });

  test('a deposit outside business hours is refused; opening without one still works', async () => {
    const customerId = await makeCustomer(); await setCalendar(false);
    try {
      const before = await tableCounts();
      await failsSafely(await open(individual(customerId, { initialDeposit: '1000.00' })), 409, 'OUTSIDE_BUSINESS_HOURS', before);
      assert.equal((await open(individual(customerId))).status, 201);
    } finally { await setCalendar(true); }
  });

  test('request validation rejects bad bodies and headers before any database work', async () => {
    const customerId = await makeCustomer(); const before = await tableCounts();
    const good = individual(customerId);
    const bad = [
      [{ ...good, initialDeposit: 1000 }, 'a JSON number deposit'],
      [{ ...good, initialDeposit: '10.001' }, 'three decimals'],
      [{ ...good, extra: true }, 'an unknown field'],
      [{ ...good, holders: [{ customerId, holderType: 'PRIMARY' }, { customerId: randomUUID(), holderType: 'PRIMARY' }] }, 'two primaries'],
      [{ ...good, holders: [] }, 'no holders'],
      [{ ...good, planId: 'nope' }, 'a bad plan id'],
      ['{not json', 'invalid JSON'],
    ];
    for (const [body, label] of bad) {
      const response = await open(body); assert.equal(response.status, 400, label);
      assert.ok(!SQL_TEXT.test((await response.json()).error.message), label);
    }
    for (const key of [undefined, 'short', 'has spaces in it!!', 'x'.repeat(81)]) {
      assert.equal((await OPEN(request('POST', '/api/accounts', { key, body: good }))).status, 400, `key ${key}`);
    }
    assert.deepEqual(await tableCounts(), before);
  });

  test('authentication, role, CSRF and branch rules are enforced on the server', async () => {
    const customerId = await makeCustomer(); const before = await tableCounts(); const good = individual(customerId);
    assert.equal((await open(good, { token: null })).status, 401);
    for (const token of [tokens.centralOps, tokens.auditor, tokens.customerLogin]) {
      assert.equal((await open(good, { token })).status, 403);
    }
    assert.equal((await open(good, { csrfHeader: null })).status, 403);
    assert.equal((await open(good, { csrfHeader: randomBytes(32).toString('hex') })).status, 403);
    assert.equal((await open({ ...good, branchId: fixture.otherBranchId })).status, 403);
    assert.equal((await open(good, { token: tokens.otherAgent })).status, 403);
    assert.deepEqual(await tableCounts(), before);
    assert.equal((await open(good, { token: tokens.manager })).status, 201);
  });

  // ------------------------------------------------------------------ reads

  test('list is branch-scoped, filterable, sortable and returns money as strings', async () => {
    const created = [];
    for (const deposit of ['1000.00', '3000.00', '2000.00']) created.push(await openOk(individual(await makeCustomer(), { initialDeposit: deposit })));
    const fetch = async (query, token = tokens.manager) => {
      const response = await LIST(request('GET', `/api/accounts${query}`, { token })); assert.equal(response.status, 200); return (await response.json()).data;
    };
    const all = await fetch('');
    assert.equal(all.total, 3); assert.ok(all.accounts.every(a => a.branchId === fixture.branchId && typeof a.currentBalance === 'string'));
    assert.deepEqual((await fetch('?sortBy=currentBalance&sortDirection=desc')).accounts.map(a => a.currentBalance), ['3000.00', '2000.00', '1000.00']);
    assert.equal((await fetch('?pageSize=2&page=2')).accounts.length, 1);
    assert.equal((await fetch(`?q=${created[0].accountNumber}`)).total, 1);
    assert.equal((await fetch('?status=CLOSED')).total, 0);
    assert.equal((await fetch('', tokens.otherManager)).total, 0);
    assert.equal((await fetch(`?branchId=${fixture.branchId}`, tokens.auditor)).total, 3);
    assert.equal((await fetch(`?branchId=${fixture.branchId}`, tokens.centralOps)).total, 3);
    for (const query of ['?sortBy=password', '?page=0', '?pageSize=1000', '?status=DELETED', '?a=1&a=2&page=1&page=2']) {
      assert.equal((await LIST(request('GET', `/api/accounts${query}`, { token: tokens.manager }))).status, 400, query);
    }
    assert.equal((await LIST(request('GET', '/api/accounts', { token: tokens.customerLogin }))).status, 403);
    assert.equal((await LIST(request('GET', `/api/accounts?branchId=${fixture.otherBranchId}`, { token: tokens.manager }))).status, 403);
  });

  test('detail hides accounts outside the caller scope behind a uniform 404', async () => {
    const data = await openOk(individual(await makeCustomer()));
    assert.equal((await detail(data.accountId, tokens.agent)).status, 200);
    assert.equal((await detail(data.accountId, tokens.auditor)).status, 200);
    await failsSafely(await detail(data.accountId, tokens.otherManager), 404, 'NOT_FOUND');
    await failsSafely(await detail(randomUUID(), tokens.manager), 404, 'NOT_FOUND');
    assert.equal((await detail('not-a-uuid')).status, 400);
    assert.equal((await DETAIL(request('GET', '/api/accounts/x', { token: null }), { params: Promise.resolve({ id: data.accountId }) })).status, 401);
  });

  test('a CUSTOMER login reads only accounts they hold and sees only their own holder entry', async () => {
    const mine = await makeCustomer({ login: fixture.customerLoginId });
    const other = await makeCustomer();
    const shared = await openOk(joint([mine, other]));
    const notMine = await openOk(individual(other));
    const response = await detail(shared.accountId, tokens.customerLogin); assert.equal(response.status, 200);
    const account = (await response.json()).data;
    assert.equal(account.holderCount, 2); assert.equal(account.holders.length, 1);
    assert.equal(account.holders[0].customerId, mine);
    await failsSafely(await detail(notMine.accountId, tokens.customerLogin), 404, 'NOT_FOUND');
  });

  // ------------------------------------------------------------------ holders

  test('a manager adds joint holders; an ALL_HOLDERS mandate follows the holder count', async () => {
    const ids = [await makeCustomer(), await makeCustomer()];
    const { accountId } = await openOk(joint(ids));
    for (const expected of [3, 4]) {
      const response = await addHolder(accountId, { customerId: await makeCustomer() });
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const data = (await response.json()).data;
      assert.equal(data.holderCount, expected); assert.equal(data.mandate.requiredSignatories, expected);
    }
    const account = (await (await detail(accountId)).json()).data;
    assert.equal(account.holders.length, 4); assert.equal(account.mandate.requiredSignatories, 4);
  });

  test('holder additions that break the rules map to specific safe errors', async () => {
    const ids = [await makeCustomer(), await makeCustomer()];
    const { accountId } = await openOk(joint(ids));
    const solo = (await openOk(individual(await makeCustomer()))).accountId;
    const before = await tableCounts();
    const cases = [
      [accountId, { customerId: ids[1] }, 409, 'DUPLICATE_HOLDER'],
      [accountId, { customerId: await makeCustomer({ dob: '2018-01-01' }) }, 409, 'UNDERAGE_HOLDER'],
      [accountId, { customerId: await makeCustomer({ verified: false }) }, 409, 'DOCUMENTS_NOT_VERIFIED'],
      [accountId, { customerId: randomUUID() }, 409, 'HOLDER_NOT_FOUND'],
      [solo, { customerId: await makeCustomer() }, 409, 'INVALID_HOLDER_COUNT'],
    ];
    for (const [id, body, status, code] of cases) await failsSafely(await addHolder(id, body), status, code, before);
    await addHolder(accountId, { customerId: await makeCustomer() }); await addHolder(accountId, { customerId: await makeCustomer() });
    await failsSafely(await addHolder(accountId, { customerId: await makeCustomer() }), 409, 'INVALID_HOLDER_COUNT');
    await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [solo]);
    await failsSafely(await addHolder(solo, { customerId: await makeCustomer() }), 409, 'ACCOUNT_NOT_ACTIVE');
    assert.equal((await addHolder(accountId, { customerId: 'bad' })).status, 400);
    assert.equal((await addHolder(accountId, { customerId: randomUUID(), extra: 1 })).status, 400);
  });

  test('only a manager of the owning branch may add holders', async () => {
    const { accountId } = await openOk(joint([await makeCustomer(), await makeCustomer()]));
    const candidate = { customerId: await makeCustomer() };
    assert.equal((await addHolder(accountId, candidate, tokens.agent)).status, 403);
    assert.equal((await addHolder(accountId, candidate, tokens.customerLogin)).status, 403);
    assert.equal((await addHolder(accountId, candidate, null)).status, 401);
    assert.equal((await ADD_HOLDER(request('POST', '/api/accounts/x/holders', { token: tokens.manager, body: candidate, csrfHeader: null }),
      { params: Promise.resolve({ id: accountId }) })).status, 403);
    assert.equal((await addHolder(accountId, candidate, tokens.otherManager)).status, 404);
    assert.equal((await addHolder(accountId, candidate, tokens.manager)).status, 201);
  });

  // ------------------------------------------------------------------ agent assignment scope

  test('an AGENT sees and opens accounts only for customers assigned to them', async () => {
    const mine = await makeCustomer();                                  // assigned to fixture.agent
    const theirs = await makeCustomer({ assignTo: fixture.secondAgentId });
    const unassigned = await makeCustomer({ assignTo: null });
    const before = await tableCounts();
    // Opening for a customer who is not assigned to the agent is refused and hides existence.
    await failsSafely(await open(individual(theirs)), 409, 'HOLDER_NOT_FOUND', before);
    await failsSafely(await open(individual(unassigned)), 409, 'HOLDER_NOT_FOUND', before);
    await failsSafely(await open(joint([mine, theirs])), 409, 'HOLDER_NOT_FOUND', before);

    const opened = await openOk(individual(mine));
    const other = await openOk(individual(theirs), { token: tokens.secondAgent });
    const listFor = async token => (await (await LIST(request('GET', '/api/accounts', { token }))).json()).data;
    assert.deepEqual((await listFor(tokens.agent)).accounts.map(a => a.accountId), [opened.accountId]);
    assert.deepEqual((await listFor(tokens.secondAgent)).accounts.map(a => a.accountId), [other.accountId]);
    assert.equal((await listFor(tokens.manager)).total, 2);

    assert.equal((await detail(opened.accountId, tokens.agent)).status, 200);
    await failsSafely(await detail(opened.accountId, tokens.secondAgent), 404, 'NOT_FOUND');
    await failsSafely(await detail(other.accountId, tokens.agent), 404, 'NOT_FOUND');
    assert.equal((await detail(other.accountId, tokens.manager)).status, 200);
    // Searching cannot reveal another agent's account either.
    const search = await LIST(request('GET', `/api/accounts?q=${other.accountNumber}`, { token: tokens.agent }));
    assert.equal((await search.json()).data.total, 0);
  });

  test('a joint account is visible to an agent when any holder is assigned to them', async () => {
    const mine = await makeCustomer();
    const shared = await makeCustomer({ assignTo: fixture.secondAgentId });
    const { accountId } = await openOk(joint([mine, shared]), { token: tokens.manager });
    assert.equal((await detail(accountId, tokens.agent)).status, 200);
    assert.equal((await detail(accountId, tokens.secondAgent)).status, 200);
    const stranger = await makeCustomer({ assignTo: null });
    const { accountId: other } = await openOk(individual(stranger), { token: tokens.manager });
    await failsSafely(await detail(other, tokens.agent), 404, 'NOT_FOUND');
  });

  test('a holder from another branch is treated as unknown (row-level security)', async () => {
    const foreign = await makeCustomer({ branch: fixture.otherBranchId, assignTo: null });
    const before = await tableCounts();
    await failsSafely(await open(individual(foreign), { token: tokens.manager }), 409, 'HOLDER_NOT_FOUND', before);
    const { accountId } = await openOk(joint([await makeCustomer(), await makeCustomer()]), { token: tokens.manager });
    await failsSafely(await addHolder(accountId, { customerId: foreign }), 409, 'HOLDER_NOT_FOUND');
  });

  test('a zero deposit opens an empty account without needing a channel; holder order does not change the replay', async () => {
    const a = await makeCustomer(); const b = await makeCustomer();
    const zero = await openOk(individual(a, { initialDeposit: '0.00' }));
    assert.equal(zero.currentBalance, '0.00');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM transaction WHERE account_id = $1', [zero.accountId])).rows[0].n, 0);
    const key = newKey();
    const first = await OPEN(request('POST', '/api/accounts', { key, token: tokens.manager, body: joint([a, b]) }));
    assert.equal(first.status, 201);
    const reordered = joint([a, b]); reordered.holders = [reordered.holders[1], reordered.holders[0]];
    const replay = await OPEN(request('POST', '/api/accounts', { key, token: tokens.manager, body: reordered }));
    assert.equal(replay.status, 200);
  });

  test('adding a holder is audited, and a closed account takes no new holders', async () => {
    const { accountId } = await openOk(joint([await makeCustomer(), await makeCustomer()]), { token: tokens.manager });
    const response = await addHolder(accountId, { customerId: await makeCustomer() });
    const { accountHolderId } = (await response.json()).data;
    const audit = await client.query("SELECT user_id FROM audit_log WHERE entity_type = 'account_holder' AND entity_id = $1", [accountHolderId]);
    assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].user_id, fixture.managerId);
    await client.query("UPDATE account SET status = 'CLOSED' WHERE account_id = $1", [accountId]);
    await failsSafely(await addHolder(accountId, { customerId: await makeCustomer() }), 409, 'ACCOUNT_NOT_ACTIVE');
  });

  // ------------------------------------------------------------------ closing (BR-18)

  const close = (id, token = tokens.manager, csrfHeader = csrf) =>
    CLOSE(request('POST', `/api/accounts/${id}/close`, { token, csrfHeader }), { params: Promise.resolve({ id }) });
  const statusOf = async id => (await client.query('SELECT status FROM account WHERE account_id = $1', [id])).rows[0].status;
  const closeAudits = async id => (await client.query("SELECT user_id, old_values, new_values FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'CLOSE'", [id])).rows;
  async function addFixedDeposit(accountId, status) {
    await client.query(
      `INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date, status)
       SELECT $1, fd_plan_id, 1000.00, 0.1400, CURRENT_DATE, CURRENT_DATE + 365, CURRENT_DATE + 30, $2 FROM fd_plan ORDER BY tenure_months LIMIT 1`,
      [accountId, status]);
  }
  const openZeroBalance = async () => (await openOk(individual(await makeCustomer()))).accountId;

  test('a manager closes a zero-balance account with no FD: audited, CLOSED, safe body', async () => {
    const accountId = await openZeroBalance();
    const response = await close(accountId);
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.accountId, accountId); assert.equal(data.status, 'CLOSED');
    assert.ok(!Number.isNaN(Date.parse(data.closedAt)));
    assert.equal(await statusOf(accountId), 'CLOSED');
    const audits = await closeAudits(accountId);
    assert.equal(audits.length, 1); assert.equal(audits[0].user_id, fixture.managerId);
    assert.equal(audits[0].old_values.status, 'ACTIVE'); assert.equal(audits[0].new_values.status, 'CLOSED');
  });

  test('closing needs a BRANCH_MANAGER of the account\'s own branch, a CSRF token and a session', async () => {
    const accountId = await openZeroBalance();
    assert.equal((await close(accountId, tokens.agent)).status, 403);
    assert.equal((await close(accountId, tokens.centralOps)).status, 403);
    assert.equal((await close(accountId, tokens.customerLogin)).status, 403);
    assert.equal((await close(accountId, tokens.manager, null)).status, 403);
    assert.equal((await close(accountId, null)).status, 401);
    await failsSafely(await close(accountId, tokens.otherManager), 404, 'NOT_FOUND');
    assert.equal(await statusOf(accountId), 'ACTIVE');
    assert.equal((await closeAudits(accountId)).length, 0);
  });

  test('a non-zero balance blocks closing with 409 BALANCE_NOT_ZERO and changes nothing', async () => {
    const accountId = await openZeroBalance();
    await client.query('UPDATE account SET current_balance = 0.01 WHERE account_id = $1', [accountId]);
    await failsSafely(await close(accountId), 409, 'BALANCE_NOT_ZERO');
    assert.equal(await statusOf(accountId), 'ACTIVE');
    assert.equal((await closeAudits(accountId)).length, 0);
  });

  test('an ACTIVE fixed deposit blocks closing with 409 ACTIVE_FD_EXISTS; a MATURED or CLOSED one does not', async () => {
    const blocked = await openZeroBalance();
    await addFixedDeposit(blocked, 'ACTIVE');
    await failsSafely(await close(blocked), 409, 'ACTIVE_FD_EXISTS');
    assert.equal(await statusOf(blocked), 'ACTIVE');
    assert.equal((await closeAudits(blocked)).length, 0);

    const history = await openZeroBalance();
    await addFixedDeposit(history, 'MATURED'); await addFixedDeposit(history, 'CLOSED');
    assert.equal((await close(history)).status, 200);
    assert.equal(await statusOf(history), 'CLOSED');
  });

  test('closing twice gives 409 ACCOUNT_ALREADY_CLOSED and a frozen account cannot be closed', async () => {
    const accountId = await openZeroBalance();
    assert.equal((await close(accountId)).status, 200);
    await failsSafely(await close(accountId), 409, 'ACCOUNT_ALREADY_CLOSED');
    assert.equal((await closeAudits(accountId)).length, 1);

    const frozen = await openZeroBalance();
    await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [frozen]);
    await failsSafely(await close(frozen), 409, 'ACCOUNT_NOT_ACTIVE');
    assert.equal(await statusOf(frozen), 'FROZEN');
  });

  test('a malformed account id is rejected before the database is touched', async () => {
    const response = await close('not-a-uuid');
    assert.equal(response.status, 400);
  });

  // ------------------------------------------------------------------ fixed-deposit panel data (P04-M03-T03)

  // start offset in days before today; the maturity and next-interest dates follow the opening date.
  async function addFixedDepositOn(accountId, status, daysAgo, principal) {
    await client.query(
      `INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date, status)
       SELECT $1, fd_plan_id, $4::numeric, 0.1400, CURRENT_DATE - $3::int, CURRENT_DATE - $3::int + 365, CURRENT_DATE - $3::int + 30, $2
         FROM fd_plan ORDER BY tenure_months LIMIT 1`,
      [accountId, status, daysAgo, principal]);
  }
  const FD_KEYS = ['fdId', 'fdPlanId', 'interestRateAtOpening', 'maturityDate', 'nextInterestDate', 'planName', 'principalAmount', 'startDate', 'status'];
  const fixedDepositsOf = async (id, token = tokens.manager) => (await (await detail(id, token)).json()).data.fixedDeposits;

  test('the account detail lists no fixed deposits for a new account', async () => {
    const accountId = await openZeroBalance();
    assert.deepEqual(await fixedDepositsOf(accountId), []);
  });

  test('fixed deposits come back newest first with exact strings, every status and no internal ids', async () => {
    const accountId = await openZeroBalance();
    await addFixedDepositOn(accountId, 'MATURED', 400, '1000.00');
    await addFixedDepositOn(accountId, 'ACTIVE', 10, '2500.50');
    await addFixedDepositOn(accountId, 'CLOSED', 200, '750.25');
    const deposits = await fixedDepositsOf(accountId);
    assert.deepEqual(deposits.map(fd => [fd.status, fd.principalAmount]), [['ACTIVE', '2500.50'], ['CLOSED', '750.25'], ['MATURED', '1000.00']]);
    for (const fd of deposits) {
      assert.deepEqual(Object.keys(fd).sort(), FD_KEYS);
      assert.equal(fd.interestRateAtOpening, '0.1400');
      assert.equal(typeof fd.planName, 'string');
      for (const key of ['startDate', 'maturityDate', 'nextInterestDate']) assert.match(fd[key], /^\d{4}-\d{2}-\d{2}$/);
    }
    // The only ids are the FD's own and its plan's; no account, customer, user or branch id is added.
    const own = new Set(deposits.flatMap(fd => [fd.fdId, fd.fdPlanId]));
    for (const found of JSON.stringify(deposits).match(new RegExp(UUID_TEXT.source, 'gi')) ?? []) assert.ok(own.has(found), `unexpected id ${found}`);
  });

  test('every role that may see the account sees its fixed deposits, others get the uniform 404 with no FD data', async () => {
    const customerId = await makeCustomer({ login: fixture.customerLoginId });
    const { accountId } = await openOk(individual(customerId));
    await addFixedDepositOn(accountId, 'ACTIVE', 5, '5000.00');
    const expected = (await fixedDepositsOf(accountId)).map(fd => fd.fdId);
    assert.equal(expected.length, 1);
    for (const token of [tokens.manager, tokens.agent, tokens.centralOps, tokens.auditor, tokens.customerLogin]) {
      assert.deepEqual((await fixedDepositsOf(accountId, token)).map(fd => fd.fdId), expected);
    }
    for (const token of [tokens.otherManager, tokens.otherAgent, tokens.secondAgent]) {
      const body = await failsSafely(await detail(accountId, token), 404, 'NOT_FOUND');
      assert.equal(body.data, undefined);
      assert.ok(!JSON.stringify(body).includes('principalAmount'));
    }
  });

  test('if the fixed-deposit list cannot be read the account is still returned, with null and no false empty list', async () => {
    const accountId = await openZeroBalance();
    await addFixedDepositOn(accountId, 'ACTIVE', 3, '1500.00');
    // Disposable database only: take away one column privilege, then give it back.
    await client.query('REVOKE SELECT (status) ON fixed_deposit FROM mims_app');
    let degraded;
    try { degraded = await detail(accountId); }
    finally { await client.query('GRANT SELECT (status) ON fixed_deposit TO mims_app'); }
    assert.equal(degraded.status, 200);
    const data = (await degraded.json()).data;
    assert.equal(data.fixedDeposits, null);
    assert.equal(data.status, 'ACTIVE'); assert.equal(data.currentBalance, '0.00'); assert.equal(data.holders.length, 1);
    assert.ok(!SQL_TEXT.test(JSON.stringify(data)), 'no database detail in the body');
    // Restored: the same account lists its deposit again, so the failure left nothing behind.
    assert.equal((await fixedDepositsOf(accountId)).length, 1);
  });

  test('the last transaction is the last POSTED one, even when timestamps tie or the later row is stamped earlier (ledger_seq)', async () => {
    const accountId = await openZeroBalance();
    const insert = (type, amount, date) => client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
       SELECT $1, $2, channel_id, $3, $4, $5::numeric, $6::timestamptz, $5::numeric FROM transaction_channel LIMIT 1`,
      [accountId, fixture.managerId, `LAST-${randomUUID().slice(0, 10)}`, type, amount, date]);
    // posted first, stamped LATER; posted second, stamped EARLIER (a deposit that waited for the account lock)
    await insert('DEPOSIT', '100.00', '2025-03-05T10:00:00+05:30');
    await insert('DEPOSIT', '250.00', '2025-03-04T10:00:00+05:30');
    assert.equal((await (await detail(accountId)).json()).data.lastTransaction.amount, '250.00');
    // identical timestamps: still the one posted last
    const tied = await openZeroBalance();
    const insertTied = (amount) => client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date, balance_after)
       SELECT $1, $2, channel_id, $3, 'DEPOSIT', $4::numeric, '2025-03-01T10:00:00+05:30', $4::numeric FROM transaction_channel LIMIT 1`,
      [tied, fixture.managerId, `TIED-${randomUUID().slice(0, 10)}`, amount]);
    await insertTied('10.00'); await insertTied('20.00'); await insertTied('30.00');
    assert.equal((await (await detail(tied)).json()).data.lastTransaction.amount, '30.00');
  });
});

