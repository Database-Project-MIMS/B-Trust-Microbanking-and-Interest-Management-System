import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';

// Everything runs in ONE transaction that is rolled back; nothing is committed.
describe('P07-M00: notification_outbox enqueue triggers', () => {
  let client, fixture, planId, channelId, adminId;

  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    planId = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0].plan_id;
    channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM'")).rows[0].channel_id;
  });
  beforeEach(async () => {
    await client.query('ROLLBACK').catch(() => {});
    await client.query('BEGIN');
    fixture = await createFixture(client);
    adminId = await fixture.staff('ADMIN');
  });
  after(async () => {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  });

  async function openAccount(customerId, suffix = randomUUID().slice(0, 8)) {
    const accountId = (await client.query(
      `INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id)
       VALUES ($1,$2,$3,$4) RETURNING account_id`,
      [`NTF-${suffix}`, planId, fixture.branchId, fixture.agentId])).rows[0].account_id;
    await client.query("INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ($1,$2,'PRIMARY')", [accountId, customerId]);
    return accountId;
  }
  async function post(accountId, type = 'DEPOSIT', amount = '50.00', narration = null) {
    return (await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, narration)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING transaction_id`,
      [accountId, adminId, channelId, `NTF-${randomUUID()}`, type, amount, narration])).rows[0].transaction_id;
  }
  const outbox = async accountId => (await client.query(
    'SELECT event_type, to_email, status, payload FROM notification_outbox WHERE account_id = $1 ORDER BY created_at, event_type', [accountId])).rows;
  const firstId = async accountId => (await client.query(
    'SELECT notification_id FROM notification_outbox WHERE account_id = $1 ORDER BY created_at LIMIT 1', [accountId])).rows[0].notification_id;

  test('opening an account notifies the holder with a masked account number', async () => {
    const accountId = await openAccount(fixture.customerId, 'AB1234');
    const rows = await outbox(accountId);
    assert.deepEqual(rows.map(r => r.event_type), ['ACCOUNT_OPENED']);
    assert.match(rows[0].to_email, /@example\.invalid$/);
    assert.equal(rows[0].status, 'PENDING');
    assert.equal(rows[0].payload.accountMask, '****1234');
    assert.equal(rows[0].payload.planName, 'Adult');
  });

  test('a posted deposit enqueues exactly one notice, without a balance', async () => {
    const accountId = await openAccount(fixture.customerId);
    await post(accountId, 'DEPOSIT', '1250.50');
    const deposits = (await outbox(accountId)).filter(r => r.event_type === 'TXN_DEPOSIT');
    assert.equal(deposits.length, 1);
    assert.equal(deposits[0].payload.amount, '1250.50');
    assert.ok(!('balance' in deposits[0].payload) && !('balanceAfter' in deposits[0].payload));
  });

  test('every ledger type maps to its own event', async () => {
    const accountId = await openAccount(fixture.customerId);
    const types = ['WITHDRAWAL', 'INTEREST_CREDIT', 'REVERSAL', 'FD_MATURITY'];
    for (const type of types) await post(accountId, type);
    const events = (await outbox(accountId)).map(r => r.event_type);
    for (const type of types) assert.ok(events.includes(`TXN_${type}`), type);
  });

  test('the fixed deposit opening principal debit is not announced as a withdrawal', async () => {
    const accountId = await openAccount(fixture.customerId);
    await post(accountId, 'WITHDRAWAL', '5000.00', 'Fixed Deposit Opening Principal Debit');
    assert.ok(!(await outbox(accountId)).some(r => r.event_type === 'TXN_WITHDRAWAL'));
  });

  test('a rolled-back posting leaves no notice behind', async () => {
    const accountId = await openAccount(fixture.customerId);
    await client.query('SAVEPOINT posting');
    await post(accountId, 'DEPOSIT', '10.00');
    await client.query('ROLLBACK TO SAVEPOINT posting');
    assert.ok(!(await outbox(accountId)).some(r => r.event_type === 'TXN_DEPOSIT'));
  });

  test('a status change is announced', async () => {
    const accountId = await openAccount(fixture.customerId);
    await client.query("UPDATE account SET status = 'FROZEN' WHERE account_id = $1", [accountId]);
    const row = (await outbox(accountId)).find(r => r.event_type === 'ACCOUNT_STATUS_CHANGED');
    assert.ok(row);
    assert.equal(row.payload.newStatus, 'FROZEN');
  });

  test('inactive customers are not notified', async () => {
    await client.query("UPDATE customer SET status = 'INACTIVE' WHERE customer_id = $1", [fixture.customerId]);
    const accountId = await openAccount(fixture.customerId);
    await post(accountId);
    assert.equal((await outbox(accountId)).length, 0);
  });

  test('a repeated event key never duplicates a notice', async () => {
    const accountId = await openAccount(fixture.customerId);
    const key = `TEST:${randomUUID()}`;
    for (let i = 0; i < 3; i += 1) await client.query("SELECT fn_enqueue_notification('TXN_DEPOSIT', $1, $2, '{}'::jsonb)", [key, accountId]);
    const count = (await client.query('SELECT count(*)::int AS n FROM notification_outbox WHERE event_key = $1', [key])).rows[0].n;
    assert.equal(count, 1);
  });

  test('the table rejects deletes and edits of the notice content', async () => {
    const accountId = await openAccount(fixture.customerId);
    const id = await firstId(accountId);
    for (const sql of ['DELETE FROM notification_outbox WHERE notification_id = $1',
      "UPDATE notification_outbox SET to_email = 'x@example.invalid' WHERE notification_id = $1",
      "UPDATE notification_outbox SET payload = '{}'::jsonb WHERE notification_id = $1"]) {
      await client.query('SAVEPOINT guard');
      await assert.rejects(client.query(sql, [id]), /NOTIFICATION_IMMUTABLE/);
      await client.query('ROLLBACK TO SAVEPOINT guard');
    }
  });

  test('the runtime role can update delivery state only, and cannot insert or delete', async () => {
    const accountId = await openAccount(fixture.customerId);
    const id = await firstId(accountId);
    await client.query('SET LOCAL ROLE mims_app');
    try {
      await client.query("UPDATE notification_outbox SET status = 'SENT', sent_at = now() WHERE notification_id = $1", [id]);
      for (const sql of ['DELETE FROM notification_outbox WHERE notification_id = $1',
        "UPDATE notification_outbox SET to_email = 'y@example.invalid' WHERE notification_id = $1",
        "INSERT INTO notification_outbox (event_type, event_key, customer_id, to_email) SELECT 'TXN_DEPOSIT', 'forged', customer_id, to_email FROM notification_outbox WHERE notification_id = $1"]) {
        await client.query('SAVEPOINT denied');
        await assert.rejects(client.query(sql, [id]), error => error.code === '42501');
        await client.query('ROLLBACK TO SAVEPOINT denied');
      }
    } finally {
      await client.query('RESET ROLE');
    }
  });
});
