import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';
const { dispatchPending } = await import('../../services/notification-service.ts');
const { GET, POST } = await import('../../app/api/notifications/dispatch/route.ts');
const { renderEmail } = await import('../../lib/email/templates.ts');

// Committed fixtures: allowed only in the disposable verification database.
describe('P07-M00: notification dispatcher and sweep route', () => {
  let client, fixture, accountId, email;
  const saved = {};

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    for (const key of ['CRON_SECRET', 'NOTIFICATION_WORKER_TOKEN', 'NOTIFICATIONS_ENABLED']) saved[key] = process.env[key];
    fixture = await createFixture(client);
    email = (await client.query('SELECT email FROM customer WHERE customer_id = $1', [fixture.customerId])).rows[0].email;
    const planId = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0].plan_id;
    // One transaction, as in production, so the holder insert is recognised as an account opening.
    await client.query('BEGIN');
    accountId = (await client.query(
      `INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id) VALUES ($1,$2,$3,$4) RETURNING account_id`,
      [`DSP-${randomUUID().slice(0, 8)}`, planId, fixture.branchId, fixture.agentId])).rows[0].account_id;
    await client.query("INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1,$2,'PRIMARY')", [accountId, fixture.customerId]);
    await client.query('COMMIT');
  });
  after(async () => {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    client.release();
    await pool.end();
  });

  // Moves our rows to the front of the queue so unrelated pending rows cannot starve the assertions.
  const prioritise = () => client.query(
    "UPDATE notification_outbox SET next_attempt_at = now() - interval '1 day' WHERE account_id = $1 AND status = 'PENDING'", [accountId]);
  const enqueue = async (key, amount) => client.query("SELECT fn_enqueue_notification('TXN_DEPOSIT', $1, $2, $3::jsonb)",
    [key, accountId, JSON.stringify({ amount, referenceNumber: 'R-1', occurredAt: new Date().toISOString() })]);

  test('a successful send marks the row SENT and delivers a masked, balance-free message', async () => {
    await prioritise();
    const sent = [];
    const result = await dispatchPending({ force: true, limit: 50, mailer: { send: async mail => { sent.push(mail); } } });
    assert.ok(result.sent >= 1);
    const mail = sent.find(m => m.to === email);
    assert.ok(mail, 'the holder receives the e-mail');
    assert.match(mail.subject, /account has been opened/i);
    const number = (await client.query('SELECT account_number FROM account WHERE account_id = $1', [accountId])).rows[0].account_number;
    assert.ok(mail.text.includes(`Account: ****${number.slice(-4)}\n`));
    assert.ok(!mail.text.includes(number), 'the full account number stays private');
    assert.equal(mail.messageId.length, 36);
    const row = (await client.query("SELECT status, sent_at FROM notification_outbox WHERE account_id = $1 AND event_type = 'ACCOUNT_OPENED'", [accountId])).rows[0];
    assert.equal(row.status, 'SENT');
    assert.ok(row.sent_at);
  });

  test('a failing send backs off, keeps only a short error code, and finally gives up', async () => {
    const key = `TEST:${randomUUID()}`;
    await enqueue(key, '10.00');
    await prioritise();
    const failing = { send: async () => { throw Object.assign(new Error(`rejected ${email}`), { code: 'EAUTH' }); } };
    const first = await dispatchPending({ force: true, limit: 50, mailer: failing });
    assert.ok(first.retried >= 1);
    const pending = (await client.query(
      "SELECT notification_id, last_error, next_attempt_at > now() AS deferred FROM notification_outbox WHERE event_key = $1", [key])).rows[0];
    assert.equal(pending.last_error, 'SMTP_EAUTH');
    assert.ok(!pending.last_error.includes('@'));
    assert.ok(pending.deferred);
    await client.query("UPDATE notification_outbox SET attempts = 4, next_attempt_at = now() - interval '1 day' WHERE notification_id = $1", [pending.notification_id]);
    const last = await dispatchPending({ force: true, limit: 50, mailer: failing });
    assert.ok(last.failed >= 1);
    const done = (await client.query('SELECT status FROM notification_outbox WHERE notification_id = $1', [pending.notification_id])).rows[0];
    assert.equal(done.status, 'FAILED');
  });

  test('a disabled environment sends nothing and leaves rows pending', async () => {
    delete process.env.NOTIFICATIONS_ENABLED;
    let called = false;
    const result = await dispatchPending({ mailer: { send: async () => { called = true; } } });
    assert.equal(result.enabled, false);
    assert.equal(called, false);
  });

  test('time budget expiry leaves unsent rows unclaimed without consuming attempts', async () => {
    const firstKey = `TEST:${randomUUID()}`, secondKey = `TEST:${randomUUID()}`;
    await enqueue(firstKey, '1.00');
    await enqueue(secondKey, '2.00');
    await client.query("UPDATE notification_outbox SET next_attempt_at = now() - interval '2 days' WHERE event_key = $1", [firstKey]);
    await client.query("UPDATE notification_outbox SET next_attempt_at = now() - interval '1 day' WHERE event_key = $1", [secondKey]);
    const originalNow = Date.now;
    let clock = originalNow();
    Date.now = () => clock;
    try {
      const result = await dispatchPending({ force: true, limit: 50, mailer: { send: async () => { clock += 9000; } } });
      assert.equal(result.claimed, 1);
      assert.equal(result.sent, 1);
      const row = (await client.query('SELECT status, attempts FROM notification_outbox WHERE event_key = $1', [secondKey])).rows[0];
      assert.equal(row.status, 'PENDING');
      assert.equal(row.attempts, 0);
    } finally { Date.now = originalNow; }
  });

  test('concurrent dispatchers never send the same notice twice', async () => {
    const key = `TEST:${randomUUID()}`;
    await enqueue(key, '7.00');
    await prioritise();
    const id = (await client.query('SELECT notification_id FROM notification_outbox WHERE event_key = $1', [key])).rows[0].notification_id;
    const seen = [];
    const mailer = { send: async mail => { seen.push(mail.messageId); await new Promise(done => setTimeout(done, 50)); } };
    await Promise.all([1, 2, 3].map(() => dispatchPending({ force: true, limit: 50, mailer })));
    assert.equal(seen.filter(value => value === id).length, 1);
  });

  test('the sweep route requires the cron or worker secret', async () => {
    process.env.CRON_SECRET = 'cron-secret-for-test';
    process.env.NOTIFICATION_WORKER_TOKEN = 'worker-secret-for-test';
    delete process.env.NOTIFICATIONS_ENABLED;
    const call = (method, token) => (method === 'GET' ? GET : POST)(new NextRequest('http://localhost/api/notifications/dispatch', {
      method, headers: token ? { authorization: `Bearer ${token}` } : {} }));
    assert.equal((await call('GET')).status, 401);
    assert.equal((await call('GET', 'wrong')).status, 401);
    assert.equal((await call('POST', 'wrong')).status, 401);
    assert.equal((await GET(new NextRequest('http://localhost/api/notifications/dispatch', {
      headers: { authorization: 'cron-secret-for-test' } }))).status, 401);
    const ok = await call('GET', 'cron-secret-for-test');
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.enabled, false);
    assert.equal((await call('POST', 'worker-secret-for-test')).status, 200);
  });

  test('templates escape markup and never print a balance', () => {
    const mail = renderEmail({ eventType: 'TXN_WITHDRAWAL', payload: {
      recipientName: '<b>Eve</b>', accountMask: '****9999', amount: '1234567.5', referenceNumber: 'REF&1', occurredAt: '2026-10-13T04:00:00Z' } });
    assert.ok(!mail.html.includes('<b>Eve</b>'));
    assert.match(mail.text, /LKR 1,234,567\.50/);
    assert.ok(!/balance/i.test(mail.text));
  });
});
