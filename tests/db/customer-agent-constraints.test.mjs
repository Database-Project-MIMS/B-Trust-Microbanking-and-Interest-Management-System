import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, rejectsSql } from '../helpers/customer-relations.mjs';

describe('P02-M02-T02: assignment constraints and history', () => {
  let client;
  let fixture;
  before(async () => { client = await pool.connect(); });
  beforeEach(async () => { await client.query('BEGIN'); fixture = await createFixture(client); });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });

  test('default UUID/current date/active flag/timestamps work without customer login', async () => {
    const result = await client.query(
      `INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1,$2)
       RETURNING cust_agent_id, is_active, assigned_date, end_date, created_at, updated_at,
         assigned_date = CURRENT_DATE AS today`, [fixture.customerId, fixture.agentId],
    );
    const row = result.rows[0];
    assert.match(row.cust_agent_id, /^[0-9a-f-]{36}$/);
    assert.equal(row.is_active, true);
    assert.equal(row.today, true);
    assert.equal(row.end_date, null);
    assert.ok(row.created_at instanceof Date && row.updated_at instanceof Date);
  });
  test('second active assignment to another agent is rejected', async () => {
    await fixture.assignment();
    await rejectsSql(client, () => fixture.assignment({ agent_id: fixture.secondAgentId }),
      '23505', 'ux_customer_agent_one_active');
  });
  test('duplicate active assignment to the same agent is rejected', async () => {
    await fixture.assignment();
    await rejectsSql(client, () => fixture.assignment(), '23505', 'ux_customer_agent_one_active');
  });
  test('reassignment preserves the old row and admits one new current agent', async () => {
    const old = await fixture.assignment();
    await client.query('UPDATE customer_agent SET is_active = false, end_date = $1 WHERE cust_agent_id = $2',
      ['2021-01-01', old.cust_agent_id]);
    const current = await fixture.assignment({ agent_id: fixture.secondAgentId, assigned_date: '2021-01-01' });
    const rows = await client.query(
      'SELECT cust_agent_id, is_active, end_date::text FROM customer_agent WHERE customer_id = $1 ORDER BY is_active',
      [fixture.customerId],
    );
    assert.deepEqual(rows.rows, [
      { cust_agent_id: old.cust_agent_id, is_active: false, end_date: '2021-01-01' },
      { cust_agent_id: current.cust_agent_id, is_active: true, end_date: null },
    ]);
  });
  test('many inactive histories are permitted', async () => {
    await fixture.assignment({ is_active: false, end_date: '2021-01-01' });
    await fixture.assignment({ is_active: false, end_date: '2021-01-01' });
    await fixture.assignment();
    const count = await client.query('SELECT count(*)::int AS count FROM customer_agent WHERE customer_id = $1', [fixture.customerId]);
    assert.equal(count.rows[0].count, 3);
  });
  test('one agent may serve multiple customers', async () => {
    await fixture.assignment();
    await fixture.assignment({ customer_id: await fixture.customer() });
  });
  test('activation of an inactive history cannot bypass uniqueness', async () => {
    await fixture.assignment();
    const old = await fixture.assignment({ is_active: false });
    await rejectsSql(client, () => client.query('UPDATE customer_agent SET is_active = true WHERE cust_agent_id = $1',
      [old.cust_agent_id]), '23505', 'ux_customer_agent_one_active');
  });
  test('end date before assigned date is rejected on insert', async () => {
    await rejectsSql(client, () => fixture.assignment({ end_date: '2019-12-31' }), '23514', 'ck_customer_agent_dates');
  });
  test('end date before assigned date is rejected on update', async () => {
    const row = await fixture.assignment();
    await rejectsSql(client, () => client.query('UPDATE customer_agent SET end_date = $1 WHERE cust_agent_id = $2',
      ['2019-12-31', row.cust_agent_id]), '23514', 'ck_customer_agent_dates');
  });
  test('same-day assignment end is accepted', async () => {
    await fixture.assignment({ is_active: false, end_date: '2020-01-01' });
  });
  for (const [column, constraint] of [['customer_id', 'fk_customer_agent_customer'], ['agent_id', 'fk_customer_agent_agent']]) {
    test(`unknown ${column} is rejected`, async () => {
      await rejectsSql(client, () => fixture.assignment({ [column]: randomUUID() }), '23503', constraint);
    });
  }
  for (const column of ['customer_id', 'agent_id', 'assigned_date', 'is_active', 'created_at', 'updated_at']) {
    test(`required ${column} rejects NULL`, async () => {
      if (column === 'created_at') {
        await rejectsSql(client, () => client.query(
          'INSERT INTO customer_agent (customer_id, agent_id, created_at) VALUES ($1,$2,NULL)',
          [fixture.customerId, fixture.agentId]), '23502', column, 'column');
      } else await rejectsSql(client, () => fixture.assignment({ [column]: null }), '23502', column, 'column');
    });
  }
  test('customer deletion is restricted even for inactive history', async () => {
    await fixture.assignment({ is_active: false });
    await rejectsSql(client, () => client.query('DELETE FROM customer WHERE customer_id = $1', [fixture.customerId]),
      ['23001', '23503'], 'fk_customer_agent_customer');
  });
  test('agent deletion is restricted even for inactive history', async () => {
    await fixture.assignment({ is_active: false });
    await rejectsSql(client, () => client.query('DELETE FROM agent WHERE agent_id = $1', [fixture.agentId]),
      ['23001', '23503'], 'fk_customer_agent_agent');
  });
  test('updated_at changes while created_at is retained', async () => {
    const row = await fixture.assignment();
    const updated = await client.query(
      'UPDATE customer_agent SET is_active = false WHERE cust_agent_id = $1 RETURNING created_at, updated_at',
      [row.cust_agent_id],
    );
    assert.deepEqual(updated.rows[0].created_at, row.created_at);
    assert.ok(updated.rows[0].updated_at > row.updated_at);
  });
  test('failed reassignment rolls back the old assignment deactivation', async () => {
    const old = await fixture.assignment();
    await client.query('SAVEPOINT reassign');
    await client.query('UPDATE customer_agent SET is_active = false WHERE cust_agent_id = $1', [old.cust_agent_id]);
    await assert.rejects(() => fixture.assignment({ agent_id: randomUUID() }), { code: '23503' });
    await client.query('ROLLBACK TO SAVEPOINT reassign');
    const result = await client.query('SELECT is_active FROM customer_agent WHERE cust_agent_id = $1', [old.cust_agent_id]);
    assert.equal(result.rows[0].is_active, true);
  });
  test('partial unique predicate and history/FK indexes are installed', async () => {
    const result = await client.query(
      'SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2', ['public', 'customer_agent'],
    );
    const indexes = new Map(result.rows.map(row => [row.indexname, row.indexdef]));
    assert.match(indexes.get('ux_customer_agent_one_active'), /UNIQUE INDEX.*\(customer_id\) WHERE is_active/);
    assert.match(indexes.get('ix_customer_agent_customer'), /\(customer_id\)/);
    assert.match(indexes.get('ix_customer_agent_agent'), /\(agent_id\)/);
  });
});
