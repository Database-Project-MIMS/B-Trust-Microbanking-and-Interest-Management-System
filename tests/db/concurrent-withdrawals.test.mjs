import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';
import { withTransaction } from '../../lib/db/with-transaction.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';

// P06-M03-T01 / AC-06: parallel withdrawals on one account cannot overspend.
// Every racer runs in its own withTransaction (its own pooled connection), so the account
// row lock taken by sp_post_withdrawal is genuinely contended rather than called in series.
const attemptSql = 'CALL sp_try_post_withdrawal($1,$2,$3,$4,$5::uuid[],$6,$7,NULL,NULL,NULL,NULL,NULL)';
const depositSql = 'CALL sp_post_deposit($1,$2,$3,$4,$5,$6,NULL,NULL,NULL,NULL)';
const SHORTFALL_CODES = ['INSUFFICIENT_FUNDS', 'BELOW_MINIMUM_BALANCE'];

describe('P06-M03-T01: concurrent withdrawals cannot overspend (AC-06)', () => {
  let client, fixture, adminId, channelId, savedParameters, savedCalendar, today;

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
  });
  afterEach(async () => {
    for (const row of savedParameters ?? []) await client.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2', [row.param_value, row.param_key]);
    if (savedCalendar) await client.query('UPDATE business_calendar SET is_business_day=$1, open_time=$2, close_time=$3 WHERE calendar_date=$4',
      [savedCalendar.is_business_day, savedCalendar.open_time, savedCalendar.close_time, today]);
    else if (today) await client.query('DELETE FROM business_calendar WHERE calendar_date=$1', [today]);
  });
  after(async () => { client?.release(); await pool.end(); });

  async function account(plan, balance) {
    const id = (await client.query(`INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, current_balance)
      SELECT $1, plan_id, $2, $3, $4 FROM savings_plan WHERE plan_name=$5 RETURNING account_id`,
      [`CW-${randomUUID().slice(0, 12)}`, fixture.branchId, fixture.agentId, balance, plan])).rows[0].account_id;
    await client.query(`INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1,$2,'PRIMARY')`, [id, fixture.customerId]);
    return id;
  }

  // One racer = one transaction on its own pooled connection. A rejection code is returned,
  // never thrown, so Promise.all observes every outcome.
  function withdraw(accountId, amount) {
    return withTransaction(async tx => {
      await setRlsContext(tx, { userId: adminId, roleName: 'ADMIN', branchId: null });
      const row = (await tx.query(attemptSql,
        [accountId, amount, channelId, adminId, [fixture.customerId], randomUUID(), 'Synthetic race'])).rows[0];
      return { ok: row.p_rejection_code === null, code: row.p_rejection_code, balanceAfter: row.p_balance_after };
    });
  }
  function deposit(accountId, amount) {
    return withTransaction(async tx => {
      await setRlsContext(tx, { userId: adminId, roleName: 'ADMIN', branchId: null });
      const row = (await tx.query(depositSql, [accountId, amount, channelId, adminId, randomUUID(), 'Synthetic race deposit'])).rows[0];
      return { ok: true, balanceAfter: row.p_balance_after };
    });
  }

  // Ledger/balance reconciliation (the D-1 check) exercised after a race, not sequentially.
  async function reconcile(accountId, start, outcomes) {
    const { rows: [acc] } = await client.query(`SELECT current_balance::text AS balance,
      (current_balance >= 0) AS non_negative FROM account WHERE account_id=$1`, [accountId]);
    assert.equal(acc.non_negative, true, 'balance must never go negative');
    const { rows: [ledger] } = await client.query(`SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type='WITHDRAWAL'),0)::text AS withdrawn,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type='DEPOSIT'),0)::text AS deposited,
      COUNT(*) FILTER (WHERE transaction_type='WITHDRAWAL')::int AS withdrawals,
      COUNT(*) FILTER (WHERE transaction_type='DEPOSIT')::int AS deposits FROM transaction WHERE account_id=$1`, [accountId]);
    const expected = (await client.query('SELECT ($1::numeric + $2::numeric - $3::numeric)::text AS value', [start, ledger.deposited, ledger.withdrawn])).rows[0].value;
    assert.equal(acc.balance, expected, 'current_balance must equal start + deposits - withdrawals from the ledger');
    // Every row's balance_after chains from the previous one in posting order: no lost update.
    const { rows: [chain] } = await client.query(`SELECT COALESCE(bool_and(t.balance_after = t.prev + CASE WHEN t.transaction_type='DEPOSIT' THEN t.amount ELSE -t.amount END), true) AS intact,
      COALESCE(MAX(t.balance_after) FILTER (WHERE t.is_last), $2::numeric)::text AS last_balance
      FROM (SELECT transaction_type, amount, balance_after,
              COALESCE(lag(balance_after) OVER w, $2::numeric) AS prev,
              (row_number() OVER w = count(*) OVER ()) AS is_last
            FROM transaction WHERE account_id=$1 WINDOW w AS (ORDER BY ledger_seq)) t`, [accountId, start]);
    assert.equal(chain.intact, true, 'balance_after must chain exactly through the ledger in ledger_seq order');
    assert.equal(chain.last_balance, acc.balance, 'last ledger balance_after must equal current_balance');
    const wins = outcomes.filter(o => o.ok && o.kind !== 'deposit').length;
    assert.equal(ledger.withdrawals, wins, 'one WITHDRAWAL ledger row per successful racer');
    const failures = outcomes.filter(o => !o.ok).length;
    const { rows: [audit] } = await client.query(`SELECT COUNT(*)::int AS n FROM audit_log
      WHERE entity_id=$1 AND action='WITHDRAWAL_REJECTED'`, [accountId]);
    assert.equal(audit.n, failures, 'one audited rejection per failed racer');
    return { balance: acc.balance, withdrawals: ledger.withdrawals };
  }

  const settled = outcomes => outcomes.map(o => ({ ...o }));

  test('two racers of 600 on 1000 (no plan minimum): exactly one wins, other is INSUFFICIENT_FUNDS', async () => {
    const id = await account('Children', '1000.00');
    const outcomes = settled(await Promise.all([withdraw(id, '600.00'), withdraw(id, '600.00')]));
    assert.equal(outcomes.filter(o => o.ok).length, 1, 'never both, never neither');
    assert.equal(outcomes.find(o => !o.ok).code, 'INSUFFICIENT_FUNDS');
    const result = await reconcile(id, '1000.00', outcomes);
    assert.equal(result.balance, '400.00');
  });

  test('plan minimum is enforced under a race: Teen 1500 with two 600 racers leaves 900 and BELOW_MINIMUM_BALANCE', async () => {
    const id = await account('Teen', '1500.00');
    const outcomes = settled(await Promise.all([withdraw(id, '600.00'), withdraw(id, '600.00')]));
    assert.equal(outcomes.filter(o => o.ok).length, 1);
    assert.equal(outcomes.find(o => !o.ok).code, 'BELOW_MINIMUM_BALANCE');
    assert.equal((await reconcile(id, '1500.00', outcomes)).balance, '900.00');
  });

  test('five racers of 300 on 1000: exactly three succeed, two INSUFFICIENT_FUNDS, balance 100.00', async () => {
    const id = await account('Children', '1000.00');
    const outcomes = settled(await Promise.all(Array.from({ length: 5 }, () => withdraw(id, '300.00'))));
    assert.equal(outcomes.filter(o => o.ok).length, 3);
    assert.deepEqual(outcomes.filter(o => !o.ok).map(o => o.code), ['INSUFFICIENT_FUNDS', 'INSUFFICIENT_FUNDS']);
    assert.equal((await reconcile(id, '1000.00', outcomes)).balance, '100.00');
  });

  test('five racers of 400 on 1000: exactly two succeed, balance 200.00, no overdraft', async () => {
    const id = await account('Children', '1000.00');
    const outcomes = settled(await Promise.all(Array.from({ length: 5 }, () => withdraw(id, '400.00'))));
    assert.equal(outcomes.filter(o => o.ok).length, 2);
    assert.ok(outcomes.filter(o => !o.ok).every(o => SHORTFALL_CODES.includes(o.code)));
    assert.equal((await reconcile(id, '1000.00', outcomes)).balance, '200.00');
  });

  test('cent-exact amounts do not drift: four racers of 333.33 on 1000.00 leave 0.01', async () => {
    const id = await account('Children', '1000.00');
    const outcomes = settled(await Promise.all(Array.from({ length: 4 }, () => withdraw(id, '333.33'))));
    assert.equal(outcomes.filter(o => o.ok).length, 3);
    assert.equal((await reconcile(id, '1000.00', outcomes)).balance, '0.01');
  });

  test('racers genuinely block on the account row lock and still serialise correctly', async () => {
    const id = await account('Children', '1000.00');
    const holder = await pool.connect();
    let racers;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT account_id FROM account WHERE account_id=$1 FOR UPDATE', [id]);
      racers = Promise.all(Array.from({ length: 3 }, () => withdraw(id, '600.00')));
      // Non-vacuity: all three racers must be queued behind our lock before it is released.
      const deadline = Date.now() + 10_000;
      let waiting = 0;
      while (Date.now() < deadline) {
        waiting = (await client.query(`SELECT COUNT(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'CALL sp_try_post_withdrawal%'`)).rows[0].n;
        if (waiting >= 3) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(waiting, 3, 'all racers must be blocked on the row lock');
      await holder.query('COMMIT');
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      holder.release();
    }
    const outcomes = settled(await racers);
    assert.equal(outcomes.filter(o => o.ok).length, 1);
    assert.equal((await reconcile(id, '1000.00', outcomes)).balance, '400.00');
  });

  test('deposits racing withdrawals reconcile: balance = start + deposits - successful withdrawals', async () => {
    const id = await account('Children', '1000.00');
    const outcomes = settled(await Promise.all([
      withdraw(id, '700.00'), deposit(id, '250.00').then(o => ({ ...o, kind: 'deposit' })),
      withdraw(id, '700.00'), deposit(id, '250.00').then(o => ({ ...o, kind: 'deposit' })),
      withdraw(id, '700.00'),
    ]));
    const result = await reconcile(id, '1000.00', outcomes);
    // 1000 + 500 = 1500 available overall, so at most two 700 withdrawals can ever succeed.
    assert.ok(result.withdrawals >= 1 && result.withdrawals <= 2, `unexpected successes: ${result.withdrawals}`);
  });

  test('repeated rounds stay safe: 10 rounds of two racers never produce zero or two winners', async () => {
    for (let round = 0; round < 10; round += 1) {
      const id = await account('Children', '1000.00');
      const outcomes = settled(await Promise.all([withdraw(id, '600.00'), withdraw(id, '600.00')]));
      assert.equal(outcomes.filter(o => o.ok).length, 1, `round ${round}`);
      assert.equal((await reconcile(id, '1000.00', outcomes)).balance, '400.00');
    }
  });
});
