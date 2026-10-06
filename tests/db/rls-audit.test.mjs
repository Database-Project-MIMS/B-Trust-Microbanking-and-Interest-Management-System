import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// P02-M01-T01/T02: RLS backstop and audit masking, exercised as the RUNTIME role (mims_app).
// Everything runs inside a transaction that is rolled back, so no data persists.
if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(); } catch { /* Caller can supply the environment. */ }
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL (mims_app) is required.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

describe('P02-M01-T01/T02: RLS and audit coverage', () => {
  let client;
  let suffix;
  let n;
  let branchA; let branchB; let agentA; let planId;
  let custA; let custB; let accA; let accB; let customerLogin;

  async function ctx(role, branchId = null, userId = null) {
    await client.query(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_branch_id', $2, true),
              set_config('app.current_user_role', $3, true)`,
      [userId ?? '', branchId ?? '', role ?? ''],
    );
  }
  async function branch() {
    const r = await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, 'Synthetic RLS Branch', 'Synthetic Road', 'Colombo', '0110000000') RETURNING branch_id`,
      [`RLS-${suffix}-${++n}`]);
    return r.rows[0].branch_id;
  }
  async function customer(branchId, appUserId = null) {
    const k = `${suffix}-${++n}`;
    const r = await client.query(
      `INSERT INTO customer (app_user_id, branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
       VALUES ($1, $2, $3, $4, 'Synthetic RLS Customer', '1990-01-01', $5) RETURNING customer_id`,
      [appUserId, branchId, `RLS-C-${k}`, `RLS-NIC-${k}`, `rls-${k}@example.invalid`]);
    return r.rows[0].customer_id;
  }
  async function account(branchId) {
    const r = await client.query(
      `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
       VALUES ($1, $2, $3, $4) RETURNING account_id`,
      [planId, branchId, agentA, `RLS-A-${suffix}-${++n}`]);
    return r.rows[0].account_id;
  }
  const ids = async (sql) => (await client.query(sql)).rows.map(r => Object.values(r)[0]);

  before(async () => { client = await pool.connect(); });
  after(async () => { client?.release(); await pool.end(); });
  beforeEach(async () => {
    await client.query('BEGIN');
    suffix = randomUUID().slice(0, 8);
    n = 0;
    await ctx('ADMIN');
    branchA = await branch();
    branchB = await branch();
    const user = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       SELECT role_id, $1, 'synthetic-unusable-hash' FROM role WHERE role_name = 'AGENT' RETURNING user_id`,
      [`rls-agent-${suffix}`]);
    agentA = user.rows[0].user_id;
    await client.query(
      `INSERT INTO agent (agent_id, branch_id, employee_no, nic_passport_no, full_name, date_of_birth,
         gender, phone, address, email, hired_date)
       VALUES ($1, $2, $3, $4, 'Synthetic Agent', '1980-01-01', 'OTHER', '0110000000', 'Synthetic Road', $5, '2020-01-01')`,
      [agentA, branchA, `RLS-E-${suffix}`, `RLS-AG-${suffix}`, `rls-agent-${suffix}@example.invalid`]);
    const plan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'");
    planId = plan.rows[0].plan_id;
    const login = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       SELECT role_id, $1, 'synthetic-unusable-hash' FROM role WHERE role_name = 'CUSTOMER' RETURNING user_id`,
      [`rls-cust-${suffix}`]);
    customerLogin = login.rows[0].user_id;
    custA = await customer(branchA, customerLogin);
    custB = await customer(branchB);
    accA = await account(branchA);
    accB = await account(branchB);
  });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function expectDenied(operation) {
    await client.query('SAVEPOINT denied');
    try {
      await assert.rejects(operation, e => ['42501', '23514'].includes(e.code) || /row-level security/i.test(e.message));
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT denied');
    }
  }

  test('RLS is enabled on customer and account', async () => {
    const r = await client.query(
      `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('customer','account') ORDER BY relname`);
    assert.deepEqual(r.rows.map(x => x.relrowsecurity), [true, true]);
  });

  test('branch-scoped staff read only their own branch customers', async () => {
    await ctx('BRANCH_MANAGER', branchA, agentA);
    const list = await ids(`SELECT customer_id FROM customer WHERE branch_id IN ('${branchA}','${branchB}')`);
    assert.deepEqual(list, [custA]);
    assert.equal((await client.query('SELECT 1 FROM customer WHERE customer_id = $1', [custB])).rows.length, 0);
  });

  test('branch-scoped staff read only their own branch accounts', async () => {
    await ctx('AGENT', branchA, agentA);
    const list = await ids(`SELECT account_id FROM account WHERE account_id IN ('${accA}','${accB}')`);
    assert.deepEqual(list, [accA]);
  });

  test('bank-wide roles (ADMIN, CENTRAL_OPS, AUDITOR) read all branches', async () => {
    for (const role of ['ADMIN', 'CENTRAL_OPS', 'AUDITOR']) {
      await ctx(role);
      const list = await ids(`SELECT customer_id FROM customer WHERE customer_id IN ('${custA}','${custB}')`);
      assert.equal(list.length, 2, role);
      const accounts = await ids(`SELECT account_id FROM account WHERE account_id IN ('${accA}','${accB}')`);
      assert.equal(accounts.length, 2, role);
    }
  });

  test('missing context fails closed (no rows, not bank-wide)', async () => {
    await ctx(null);
    assert.equal((await client.query('SELECT 1 FROM customer WHERE customer_id = ANY($1)', [[custA, custB]])).rows.length, 0);
    assert.equal((await client.query('SELECT 1 FROM account WHERE account_id = ANY($1)', [[accA, accB]])).rows.length, 0);
  });

  test('branch role with no branch id sees nothing', async () => {
    await ctx('AGENT', null, agentA);
    assert.equal((await client.query('SELECT 1 FROM customer WHERE customer_id = ANY($1)', [[custA, custB]])).rows.length, 0);
  });

  test('CUSTOMER role sees only its own customer row and no unheld accounts', async () => {
    await ctx('CUSTOMER', null, customerLogin);
    const own = await ids(`SELECT customer_id FROM customer WHERE customer_id IN ('${custA}','${custB}')`);
    assert.deepEqual(own, [custA]);
    assert.equal((await client.query('SELECT 1 FROM account WHERE account_id = ANY($1)', [[accA, accB]])).rows.length, 0);
  });

  test('cross-branch writes are rejected by RLS', async () => {
    await ctx('BRANCH_MANAGER', branchA, agentA);
    await expectDenied(() => customer(branchB));
    await expectDenied(() => account(branchB));
    // UPDATE on another branch's row affects zero rows (invisible under USING).
    const upd = await client.query(`UPDATE customer SET phone = '0770000000' WHERE customer_id = $1`, [custB]);
    assert.equal(upd.rowCount, 0);
  });

  test('moving a row to another branch is rejected (WITH CHECK)', async () => {
    await ctx('BRANCH_MANAGER', branchA, agentA);
    await expectDenied(() => client.query('UPDATE customer SET branch_id = $1 WHERE customer_id = $2', [branchB, custA]));
  });

  test('read-only roles (AUDITOR) cannot write', async () => {
    await ctx('AUDITOR');
    await expectDenied(() => customer(branchA));
  });

  test('customer audit rows mask NIC/passport and e-mail and record the actor', async () => {
    await ctx('AGENT', branchA, agentA);
    const id = await customer(branchA);
    const row = await client.query(
      `SELECT user_id, actor_type, entity_id, new_values, old_values FROM audit_log
        WHERE entity_type = 'customer' AND entity_id = $1 AND action = 'INSERT'`, [id]);
    assert.equal(row.rows.length, 1);
    const a = row.rows[0];
    assert.equal(a.user_id, agentA);
    assert.equal(a.actor_type, 'USER');
    assert.equal(a.old_values, null);
    assert.match(a.new_values.nic_passport_no, /^\*{4}.{0,4}$/);
    assert.ok(!a.new_values.nic_passport_no.includes('RLS-NIC'));
    assert.match(a.new_values.email, /^.\*\*\*@\*\*\*$/);
    assert.equal(a.new_values.full_name, 'Synthetic RLS Customer');
  });

  test('customer UPDATE and account INSERT/UPDATE are audited; no audit without context is USER', async () => {
    await ctx('ADMIN', null, agentA);
    await client.query(`UPDATE customer SET phone = '0771111111' WHERE customer_id = $1`, [custA]);
    await client.query(`UPDATE account SET status = 'FROZEN' WHERE account_id = $1`, [accA]);
    const actions = await client.query(
      `SELECT entity_type, action FROM audit_log
        WHERE entity_id = ANY($1) AND entity_type IN ('customer','account') ORDER BY entity_type, action`,
      [[custA, accA]]);
    const seen = actions.rows.map(r => `${r.entity_type}:${r.action}`);
    for (const expected of ['customer:INSERT', 'customer:UPDATE', 'account:INSERT', 'account:UPDATE']) {
      assert.ok(seen.includes(expected), `${expected} missing from ${seen}`);
    }
    // Setup inserts ran under ADMIN context with an empty user id → SYSTEM actor.
    const system = await client.query(
      `SELECT actor_type FROM audit_log WHERE entity_type = 'customer' AND entity_id = $1 AND action = 'INSERT'`, [custA]);
    assert.equal(system.rows[0].actor_type, 'SYSTEM');
  });

  test('P02-M01-T03: route SQL predicate scopes in the WHERE clause and tampered branch ids return nothing', async () => {
    const sql = `SELECT customer_id FROM customer
                  WHERE ($1::uuid IS NULL OR branch_id = $1::uuid) AND ($2::uuid IS NULL OR branch_id = $2::uuid)
                    AND customer_id = ANY($3)`;
    // Branch manager (scope = A): requesting branch B via URL/body (as $2) yields nothing.
    await ctx('BRANCH_MANAGER', branchA, agentA);
    assert.equal((await client.query(sql, [branchA, branchB, [custA, custB]])).rows.length, 0);
    assert.deepEqual((await client.query(sql, [branchA, null, [custA, custB]])).rows.map(r => r.customer_id), [custA]);
    // Bank-wide scope (null) sees both branches.
    await ctx('ADMIN');
    assert.equal((await client.query(sql, [null, null, [custA, custB]])).rows.length, 2);
  });

  test('audit_log never contains an unmasked customer identifier', async () => {
    const leaks = await client.query(
      `SELECT count(*)::int AS n FROM audit_log
        WHERE entity_type = 'customer' AND (new_values::text LIKE '%RLS-NIC-%' OR new_values::text LIKE '%example.invalid%')`);
    assert.equal(leaks.rows[0].n, 0);
  });
});
