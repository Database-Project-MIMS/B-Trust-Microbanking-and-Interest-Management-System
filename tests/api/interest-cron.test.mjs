import { after, before, describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fdFixture, pool, requireDisposableDatabase, useCustomerRuntime } from '../helpers/customer-fixed-deposits.mjs';
import { GET } from '../../app/api/cron/interest/route.ts';

describe('Vercel automatic interest: authentication, bank date and exact financial effects', () => {
  let owner, fixture, restore, fd, savings, originalSecret, originalTimezone;
  const secret = randomBytes(32).toString('hex');
  before(async () => {
    originalSecret = process.env.CRON_SECRET;
    originalTimezone = process.env.BANK_TIMEZONE;
    process.env.CRON_SECRET = secret;
    process.env.BANK_TIMEZONE = 'Pacific/Auckland';
    owner = await pool.connect();
    await requireDisposableDatabase(owner);
    fixture = await fdFixture(owner);
    const account = await fixture.account([fixture.customerId]);
    await owner.query('UPDATE account SET current_balance=0 WHERE account_id=$1', [account.account_id]);
    fd = await fixture.deposit(account.account_id, 'ACTIVE', '100000', '2006-01-01');
    await owner.query('UPDATE fixed_deposit SET interest_rate_at_opening=0.1400 WHERE fd_id=$1', [fd]);
    savings = await fixture.account([fixture.customerId]);
    await owner.query("UPDATE account SET opened_date='2006-07-01',current_balance=73000 WHERE account_id=$1", [savings.account_id]);
    for (const [time, balance] of [['00:00:00', '36500'], ['12:00:00', '73000']]) {
      await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,balance_after,branch_id)
        SELECT $1,$2,channel_id,$3,'DEPOSIT',36500,$4::timestamptz,$5,$6 FROM transaction_channel WHERE channel_name='SYSTEM'`,
      [savings.account_id, fixture.centralId, randomBytes(16).toString('hex'), `2006-07-01T${time}+05:30`, balance, fixture.branchId]);
    }
    restore = useCustomerRuntime(pool);
    mock.timers.enable({ apis: ['Date'], now: new Date('2006-07-01T18:30:00Z') });
  });
  after(async () => {
    mock.timers.reset();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalTimezone === undefined) delete process.env.BANK_TIMEZONE;
    else process.env.BANK_TIMEZONE = originalTimezone;
    await restore?.(); owner?.release(); await pool.end();
  });
  const request = (headers = {}, query = '') => new NextRequest(`http://localhost/api/cron/interest${query}`, { headers });
  test('missing, wrong and malformed bearer headers cannot write audit or control rows', async () => {
    const before = (await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n;
    for (const value of ['', 'Bearer wrong', secret, `Basic ${secret}`, `bearer ${secret}`]) {
      const response = await GET(request({ authorization: value }));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, before);
  });
  test('session cookies alone cannot trigger financial writes through GET', async () => {
    for (const token of [fixture.tokens.admin, fixture.tokens.central, fixture.tokens.agent]) {
      assert.equal((await GET(request({ cookie: `mims_session=${token}` }))).status, 401);
    }
  });
  test('unset secret fails closed and authenticated query parameters are rejected', async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(request({ authorization: `Bearer ${secret}` }))).status, 401);
    process.env.CRON_SECRET = secret;
    assert.equal((await GET(request({ authorization: `Bearer ${secret}` }, '?cycleDate=2999-01-01'))).status, 400);
  });
  test('Colombo midnight pays six exact FD periods and returns principal only once', async () => {
    const response = await GET(request({ authorization: `Bearer ${secret}` }));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.cycleDate, '2006-07-02');
    assert.equal(data.triggeredBy, 'VERCEL_CRON');
    assert.equal(data.status, 'COMPLETED');
    assert.equal(data.exceptionCount, 0);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payouts = (await owner.query('SELECT interest_amount::text AS amount FROM interest_payout WHERE fd_id=$1', [fd])).rows;
    assert.equal(payouts.length, 6);
    assert.ok(payouts.every(row => row.amount === '1150.68'));
    const stored = (await owner.query(`SELECT f.status,a.current_balance::text AS balance,
      (SELECT count(*)::int FROM fd_maturity_receipt WHERE fd_id=f.fd_id) AS receipts
      FROM fixed_deposit f JOIN account a USING(account_id) WHERE f.fd_id=$1`, [fd])).rows[0];
    assert.deepEqual(stored, { status: 'MATURED', balance: '106904.08', receipts: 1 });
    assert.deepEqual((await owner.query(`SELECT a.current_balance::text AS balance,a.savings_interest_through::text AS through,
      p.interest_amount::text AS interest FROM account a JOIN interest_payout p USING(account_id)
      WHERE a.account_id=$1 AND p.source_type='SAVINGS'`, [savings.account_id])).rows,
    [{ balance: '73020.00', through: '2006-07-02', interest: '20.00' }]);
    const replay = await GET(request({ authorization: `Bearer ${secret}` }));
    assert.equal(replay.status, 200);
    const repeated = (await replay.json()).data;
    assert.equal(repeated.replayed, true);
    assert.equal(repeated.runId, data.runId);
    assert.equal(repeated.totalInterest, data.totalInterest);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM interest_payout WHERE fd_id=$1', [fd])).rows[0].n, 6);
    const audit = (await owner.query("SELECT user_id,actor_type FROM audit_log WHERE action='INTEREST_RUN_INITIATED' AND new_values->>'cycle_date'='2006-07-02' ORDER BY logged_at DESC LIMIT 1")).rows[0];
    assert.deepEqual(audit, { user_id: null, actor_type: 'SYSTEM' });
  });
  test('the minute before Colombo midnight belongs to the preceding bank date', async () => {
    mock.timers.setTime(new Date('2006-07-01T18:29:00Z').getTime());
    const response = await GET(request({ authorization: `Bearer ${secret}` }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.cycleDate, '2006-07-01');
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM interest_payout WHERE fd_id=$1', [fd])).rows[0].n, 6);
  });
});
