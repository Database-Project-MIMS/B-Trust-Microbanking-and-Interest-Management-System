import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';
import { withTransaction } from '../../lib/db/with-transaction.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

const attemptSql = 'CALL sp_try_post_withdrawal($1,$2,$3,$4,$5::uuid[],$6,$7,NULL,NULL,NULL,NULL,NULL)';

describe('P03-M04-T03: corrected withdrawal, audited rejection and concurrency', () => {
  let client, fixture, adminId, channelId, accountId, savedParameters, savedCalendar, today;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => {
    savedParameters = (await client.query(`SELECT param_key, param_value FROM system_parameter
      WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END','WITHDRAWAL_SINGLE_LIMIT','WITHDRAWAL_DAILY_LIMIT')`)).rows;
    await client.query(`UPDATE system_parameter SET param_value = CASE param_key
      WHEN 'BUSINESS_HOUR_START' THEN '00:00' WHEN 'BUSINESS_HOUR_END' THEN '23:59:59.999999'
      WHEN 'WITHDRAWAL_SINGLE_LIMIT' THEN '100000.00' ELSE '200000.00' END
      WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END','WITHDRAWAL_SINGLE_LIMIT','WITHDRAWAL_DAILY_LIMIT')`);
    today = (await client.query("SELECT to_char((now() AT TIME ZONE 'Asia/Colombo')::date, 'YYYY-MM-DD') AS day")).rows[0].day;
    savedCalendar = (await client.query('SELECT is_business_day, open_time::text, close_time::text FROM business_calendar WHERE calendar_date=$1', [today])).rows[0];
    await client.query(`INSERT INTO business_calendar (calendar_date, is_business_day)
      VALUES ($1, true) ON CONFLICT (calendar_date) DO UPDATE SET is_business_day=true, open_time=NULL, close_time=NULL`, [today]);
    fixture = await createFixture(client);
    adminId = await fixture.staff('ADMIN');
    channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'")).rows[0].channel_id;
    accountId = await account();
  });
  afterEach(async () => {
    for (const row of savedParameters ?? []) await client.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2', [row.param_value, row.param_key]);
    if (savedCalendar) await client.query('UPDATE business_calendar SET is_business_day=$1, open_time=$2, close_time=$3 WHERE calendar_date=$4',
      [savedCalendar.is_business_day, savedCalendar.open_time, savedCalendar.close_time, today]);
    else if (today) await client.query('DELETE FROM business_calendar WHERE calendar_date=$1', [today]);
  });
  after(async () => { client?.release(); await pool.end(); });

  async function account({ plan = 'Adult', balance = '50000.00', holders = [fixture.customerId], mandate = null } = {}) {
    const id = (await client.query(`INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance)
      SELECT $1, plan_id, $2, $3, $4 FROM savings_plan WHERE plan_name=$5 RETURNING account_id`,
      [`WD-${randomUUID().slice(0, 12)}`, fixture.branchId, fixture.agentId, balance, plan])).rows[0].account_id;
    // 0242 validates after each statement: all joint holders must be inserted together.
    await client.query(`INSERT INTO account_holder (account_id, customer_id, holder_type)
      SELECT $1, holder, CASE WHEN ord=1 THEN 'PRIMARY' ELSE 'JOINT' END
      FROM unnest($2::uuid[]) WITH ORDINALITY AS members(holder, ord)`, [id, holders]);
    if (mandate) await client.query('INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES ($1,$2,$3)', [id, mandate, holders.length]);
    return id;
  }
  function input(overrides = {}) {
    const value = { accountId, amount: '250.00', channelId, userId: adminId,
      signers: [fixture.customerId], key: null, narration: 'Synthetic withdrawal', ...overrides };
    return [value.accountId, value.amount, value.channelId, value.userId, value.signers, value.key, value.narration];
  }
  async function post(overrides = {}) {
    const result = await withTransaction(async tx => {
      await setRlsContext(tx, { userId: overrides.userId ?? adminId, roleName: overrides.role ?? 'ADMIN', branchId: overrides.branchId ?? null });
      if (overrides.timezone) await tx.query("SELECT set_config('TimeZone', $1, true)", [overrides.timezone]);
      return (await tx.query(attemptSql, input(overrides))).rows[0];
    });
    // Never throw inside withTransaction after an audited rejection-code result.
    if (result.p_rejection_code) throw Object.assign(new Error(result.p_rejection_code), { code: result.p_rejection_code });
    return result;
  }
  async function state(id = accountId) {
    return (await client.query(`SELECT
      (SELECT current_balance::text FROM account WHERE account_id=$1) AS balance,
      (SELECT COUNT(*)::text FROM transaction WHERE account_id=$1) AS ledger,
      (SELECT COUNT(*)::text FROM audit_log WHERE entity_id=$1 AND action='WITHDRAWAL_REJECTED') AS rejections`, [id])).rows[0];
  }
  async function reject(code, overrides = {}) {
    const id = overrides.accountId ?? accountId;
    const before = await state(id);
    await assert.rejects(post(overrides), error => error.message === code);
    const after = await state(id);
    assert.equal(after.balance, before.balance); assert.equal(after.ledger, before.ledger);
    const { rows } = await client.query(`SELECT new_values->>'reason' AS reason FROM audit_log
      WHERE entity_id=$1 AND action='WITHDRAWAL_REJECTED' ORDER BY logged_at DESC`, [id]);
    assert.equal(rows[0].reason, code);
    assert.equal(BigInt(after.rejections), BigInt(before.rejections) + 1n);
  }

  test('exact debit, balance_after, attributed branch and one success audit agree', async () => {
    const result = await post({ amount: '0.10' });
    assert.equal(result.p_balance_after, '49999.90'); assert.equal(result.p_rejection_code, null);
    const row = (await client.query('SELECT amount, balance_after, transaction_type, agent_id, branch_id FROM transaction WHERE transaction_id=$1', [result.p_transaction_id])).rows[0];
    assert.deepEqual(row, { amount: '0.10', balance_after: '49999.90', transaction_type: 'WITHDRAWAL', agent_id: null, branch_id: fixture.branchId });
    assert.deepEqual(await state(), { balance: '49999.90', ledger: '1', rejections: '0' });
    assert.equal((await client.query("SELECT COUNT(*)::text AS count FROM audit_log WHERE entity_id=$1 AND action='WITHDRAWAL'", [result.p_transaction_id])).rows[0].count, '1');
  });
  test('frozen account is audited once without a ledger row or debit', async () => {
    await client.query("UPDATE account SET status='FROZEN' WHERE account_id=$1", [accountId]); await reject('ACCOUNT_NOT_ACTIVE');
  });
  test('actual configured single limit is enforced', async () => { await reject('LIMIT_EXCEEDED', { amount: '100000.01' }); });
  test('two prior withdrawals plus another cannot breach the configured daily total', async () => {
    await client.query('UPDATE account SET current_balance=500000.00 WHERE account_id=$1', [accountId]);
    await post({ amount: '90000.00', key: randomUUID() }); await post({ amount: '90000.00', key: randomUUID() });
    await reject('LIMIT_EXCEEDED', { amount: '50000.00' });
    assert.deepEqual(await state(), { balance: '320000.00', ledger: '2', rejections: '1' });
  });
  test('insufficient funds is audited without side effects', async () => { await reject('INSUFFICIENT_FUNDS', { amount: '60000.00' }); });
  test('plan minimum is read inside the locked operation', async () => { await reject('BELOW_MINIMUM_BALANCE', { amount: '49000.01' }); });
  test('ALL_HOLDERS rejects one signer and accepts every required signer', async () => {
    const other = await fixture.customer();
    const joint = await account({ plan: 'Joint', holders: [fixture.customerId, other], mandate: 'ALL_HOLDERS' });
    await reject('MANDATE_NOT_SATISFIED', { accountId: joint });
    const result = await post({ accountId: joint, signers: [other, fixture.customerId], amount: '3.50' });
    assert.equal(result.p_balance_after, '49996.50');
  });
  test('same key and same canonical signer set returns the original result with one debit', async () => {
    const key = randomUUID(); const first = await post({ key });
    const second = await post({ key, signers: [fixture.customerId, fixture.customerId] });
    assert.deepEqual(second, first); assert.equal((await state()).ledger, '1');
  });
  test('a changed payload or actor cannot reuse an existing idempotency key', async () => {
    const key = randomUUID(); await post({ key }); const before = await state();
    await assert.rejects(post({ key, amount: '251.00' }), /IDEMPOTENCY_KEY_REUSED/);
    const otherAdmin = await fixture.staff('ADMIN');
    await assert.rejects(post({ key, userId: otherAdmin }), /IDEMPOTENCY_KEY_REUSED/);
    assert.deepEqual(await state(), before);
  });
  test('NULL, non-positive, fractional cents, non-finite and overflowing amounts fail safely', async () => {
    const before = await state();
    for (const amount of [null, '0.00', '-1.00', '0.001', 'NaN', 'Infinity', '10000000000000.00'])
      await assert.rejects(post({ amount }), /INVALID_WITHDRAWAL_AMOUNT/);
    assert.deepEqual(await state(), before);
  });
  test('invalid channel, missing/stale role context and other staff branch fail closed', async () => {
    await assert.rejects(post({ channelId: randomUUID() }), /CHANNEL_UNAVAILABLE/);
    await assert.rejects(post({ role: 'CUSTOMER' }), /WITHDRAWAL_NOT_AUTHORIZED/);
    await assert.rejects(post({ userId: fixture.otherManagerId, role: 'BRANCH_MANAGER', branchId: fixture.otherBranchId }), /WITHDRAWAL_NOT_AUTHORIZED/);
    assert.equal((await state()).ledger, '0');
  });
  test('AGENT captures its trusted profile and operating branch; manager is not inferred as reporting agent', async () => {
    await fixture.assignment();
    const result = await post({ userId: fixture.agentId, role: 'AGENT', branchId: fixture.branchId });
    const row = (await client.query('SELECT agent_id, branch_id FROM transaction WHERE transaction_id=$1', [result.p_transaction_id])).rows[0];
    assert.deepEqual(row, { agent_id: fixture.agentId, branch_id: fixture.branchId });
  });
  test('inactive stored actor, unset context and inactive channel cannot post', async () => {
    await client.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1", [adminId]);
    await assert.rejects(post(), /WITHDRAWAL_NOT_AUTHORIZED/);
    await client.query("UPDATE app_user SET status='ACTIVE' WHERE user_id=$1", [adminId]);
    await assert.rejects(withTransaction(async tx => (await tx.query(attemptSql, input())).rows[0]), /WITHDRAWAL_NOT_AUTHORIZED/);
    await client.query("UPDATE transaction_channel SET status='INACTIVE' WHERE channel_id=$1", [channelId]);
    try { await assert.rejects(post(), /CHANNEL_UNAVAILABLE/); }
    finally { await client.query("UPDATE transaction_channel SET status='ACTIVE' WHERE channel_id=$1", [channelId]); }
    assert.equal((await state()).ledger, '0');
  });
  test('customer self-service cannot claim another joint holder signed', async () => {
    await client.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2', [fixture.customerLoginId, fixture.customerId]);
    const other = await fixture.customer();
    const joint = await account({ plan: 'Joint', holders: [fixture.customerId, other], mandate: 'ALL_HOLDERS' });
    await assert.rejects(post({ accountId: joint, userId: fixture.customerLoginId, role: 'CUSTOMER', signers: [fixture.customerId, other] }), /WITHDRAWAL_NOT_AUTHORIZED/);
    assert.equal((await state(joint)).ledger, '0');
  });
  test('business-calendar closure rejects even during globally configured hours', async () => {
    await client.query('UPDATE business_calendar SET is_business_day=false WHERE calendar_date=$1', [today]);
    await reject('OUTSIDE_BUSINESS_HOURS');
  });
  test('daily limit uses Colombo midnight despite a different PostgreSQL connection timezone', async () => {
    await client.query(`INSERT INTO transaction (account_id, initiated_by_user_id, channel_id,
      reference_number, transaction_type, amount, transaction_date, branch_id)
      VALUES ($1,$2,$3,$4,'WITHDRAWAL',190000.00,($5::date::timestamp AT TIME ZONE 'Asia/Colombo') + interval '1 second',$6)`,
      [accountId, adminId, channelId, `WD-DAY-${randomUUID()}`, today, fixture.branchId]);
    await reject('LIMIT_EXCEEDED', { amount: '20000.00', timezone: 'America/New_York' });
  });
  test('same-key concurrent retries serialize and debit exactly once', async () => {
    const key = randomUUID(); const results = await Promise.all([post({ key }), post({ key })]);
    assert.deepEqual(results[0], results[1]); assert.equal((await state()).ledger, '1');
  });
  test('competing different-key withdrawals re-read the balance after the lock', async () => {
    const tight = await account({ plan: 'Children', balance: '1000.00' });
    const results = await Promise.allSettled([post({ accountId: tight, amount: '600.00', key: randomUUID() }), post({ accountId: tight, amount: '600.00', key: randomUUID() })]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(results.filter(row => row.status === 'rejected').length, 1);
    assert.deepEqual(await state(tight), { balance: '400.00', ledger: '1', rejections: '1' });
  });
  test('unexpected audit failure rolls back both the inserted ledger and the balance update', async () => {
    const before = await state(); await client.query('BEGIN');
    try {
      await setRlsContext(client, { userId: adminId, roleName: 'ADMIN', branchId: null });
      await client.query("ALTER TABLE audit_log ADD CONSTRAINT test_withdrawal_audit_failure CHECK (action <> 'WITHDRAWAL') NOT VALID");
      await client.query('SAVEPOINT attempt');
      await assert.rejects(client.query(attemptSql, input()), { code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT attempt');
      assert.deepEqual(await state(), before);
    } finally { await client.query('ROLLBACK'); }
  });
  test('legacy single-customer signature remains callable', async () => {
    const result = await withTransaction(async tx => {
      await setRlsContext(tx, { userId: adminId, roleName: 'ADMIN', branchId: null });
      return (await tx.query('CALL sp_post_withdrawal($1,$2,$3,$4,$5::uuid,$6,$7,NULL,NULL,NULL,NULL)',
        [accountId, '250.00', channelId, adminId, fixture.customerId, null, 'Synthetic legacy call'])).rows[0];
    });
    assert.equal(result.p_balance_after, '49750.00');
  });
  test('mims_app can execute an in-scope attempt without owner privileges', async () => {
    const result = await withTransaction(async tx => {
      await tx.query('SET LOCAL ROLE mims_app');
      await setRlsContext(tx, { userId: fixture.managerId, roleName: 'BRANCH_MANAGER', branchId: fixture.branchId });
      return (await tx.query(attemptSql, input({ userId: fixture.managerId }))).rows[0];
    });
    assert.equal(result.p_balance_after, '49750.00');
  });
});
