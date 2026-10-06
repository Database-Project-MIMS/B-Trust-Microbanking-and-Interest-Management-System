import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { /* Caller can supply environment. */ }
}
// Constraint tests use the owner through the existing lib/db pool, never importing pg.
if (!process.env.DATABASE_MIGRATION_URL) throw new Error('Owner connection is required for customer constraint tests.');
process.env.DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
const { pool } = await import('../../lib/db/pool.ts');

describe('P02-M02-T01: customer schema constraints', () => {
  let client;
  let branchId;
  let suffix;
  let sequence;

  before(async () => { client = await pool.connect(); });
  beforeEach(async () => {
    await client.query('BEGIN');
    suffix = randomUUID().slice(0, 8);
    sequence = 0;
    const branch = await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING branch_id`,
      [`CT-${suffix}`, 'Synthetic Customer Test Branch', '1 Synthetic Road', 'Colombo', '0110000000'],
    );
    branchId = branch.rows[0].branch_id;
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => {
    client?.release();
    await pool.end();
  });

  async function insertCustomer(overrides = {}) {
    sequence += 1;
    const values = {
      branch_id: branchId,
      customer_number: `CT-${suffix}-${sequence}`,
      nic_passport_no: `SYNTHETIC-${suffix}-${sequence}`,
      full_name: 'Malini Perera',
      date_of_birth: '1990-01-01',
      email: `synthetic-${suffix}-${sequence}@example.invalid`,
      app_user_id: null,
      status: 'ACTIVE',
      ...overrides,
    };
    const result = await client.query(
      `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name,
                             date_of_birth, email, app_user_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING customer_id, app_user_id, customer_number, nic_passport_no, email,
                 status, created_at, updated_at`,
      [values.branch_id, values.customer_number, values.nic_passport_no, values.full_name,
        values.date_of_birth, values.email, values.app_user_id, values.status],
    );
    return result.rows[0];
  }

  async function insertLogin() {
    const result = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       SELECT role_id, $1, $2 FROM role WHERE role_name = 'CUSTOMER' RETURNING user_id`,
      [`customer-test-${suffix}`, 'synthetic-unusable-hash'],
    );
    assert.ok(result.rows[0], 'Seeded CUSTOMER role is required.');
    return result.rows[0].user_id;
  }

  async function rejectsWith(operation, codes, constraintOrColumn, field = 'constraint') {
    await client.query('SAVEPOINT expected_failure');
    try {
      await assert.rejects(operation, error => {
        assert.ok([codes].flat().includes(error.code), `Unexpected SQLSTATE ${error.code}`);
        assert.equal(error[field], constraintOrColumn);
        return true;
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT expected_failure');
      await client.query('RELEASE SAVEPOINT expected_failure');
    }
  }

  test('independent UUID and default lifecycle/timestamps need no login', async () => {
    const result = await client.query(
      `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING customer_id, app_user_id, status, created_at, updated_at`,
      [branchId, `CT-${suffix}`, `SYNTHETIC-${suffix}`, 'Synthetic Customer', '1990-01-01', `${suffix}@example.invalid`],
    );
    const row = result.rows[0];
    assert.match(row.customer_id, /^[0-9a-f-]{36}$/);
    assert.equal(row.app_user_id, null);
    assert.equal(row.status, 'ACTIVE');
    assert.ok(row.created_at instanceof Date && row.updated_at instanceof Date);
    const login = await client.query('SELECT user_id FROM app_user WHERE user_id = $1', [row.customer_id]);
    assert.equal(login.rows.length, 0, 'Customer ID must not be an app_user subtype.');
  });

  test('multiple customers may have NULL login links', async () => {
    const first = await insertCustomer();
    const second = await insertCustomer();
    assert.equal(first.app_user_id, null);
    assert.equal(second.app_user_id, null);
    assert.notEqual(first.customer_id, second.customer_id);
  });

  test('optional existing login links without replacing customer identity', async () => {
    const userId = await insertLogin();
    const customer = await insertCustomer();
    const updated = await client.query(
      'UPDATE customer SET app_user_id = $1 WHERE customer_id = $2 RETURNING customer_id, app_user_id',
      [userId, customer.customer_id],
    );
    assert.equal(updated.rows[0].customer_id, customer.customer_id);
    assert.equal(updated.rows[0].app_user_id, userId);
    assert.notEqual(customer.customer_id, userId);
  });

  for (const [column, constraint] of [
    ['nic_passport_no', 'uq_customer_nic_passport_no'],
    ['email', 'uq_customer_email'],
    ['customer_number', 'uq_customer_number'],
  ]) {
    test(`duplicate ${column} is rejected with 23505`, async () => {
      const first = await insertCustomer();
      await rejectsWith(() => insertCustomer({ [column]: first[column] }), '23505', constraint);
      const count = await client.query('SELECT COUNT(*)::int AS count FROM customer WHERE branch_id = $1', [branchId]);
      assert.equal(count.rows[0].count, 1, 'Rejected insert leaves no extra row.');
    });
  }

  test('two customer profiles cannot share a login', async () => {
    const userId = await insertLogin();
    await insertCustomer({ app_user_id: userId });
    await rejectsWith(() => insertCustomer({ app_user_id: userId }), '23505', 'uq_customer_app_user_id');
  });

  test('unknown branch is rejected', async () => {
    await rejectsWith(() => insertCustomer({ branch_id: randomUUID() }), '23503', 'fk_customer_branch');
  });
  test('unknown optional login is rejected', async () => {
    await rejectsWith(() => insertCustomer({ app_user_id: randomUUID() }), '23503', 'fk_customer_app_user');
  });
  test('future birth date is rejected', async () => {
    const date = await client.query("SELECT (CURRENT_DATE + 1)::text AS date");
    await rejectsWith(() => insertCustomer({ date_of_birth: date.rows[0].date }), '23514', 'ck_customer_birth_date_past');
  });
  test('today birth date is rejected by the strict past-date rule', async () => {
    const date = await client.query('SELECT CURRENT_DATE::text AS date');
    await rejectsWith(() => insertCustomer({ date_of_birth: date.rows[0].date }), '23514', 'ck_customer_birth_date_past');
  });
  test('invalid status is rejected', async () => {
    await rejectsWith(() => insertCustomer({ status: 'DELETED' }), '23514', 'ck_customer_status');
  });
  test('deactivation retains the customer identity', async () => {
    const customer = await insertCustomer();
    const result = await client.query(
      "UPDATE customer SET status = 'INACTIVE' WHERE customer_id = $1 RETURNING customer_id, status",
      [customer.customer_id],
    );
    assert.deepEqual(result.rows[0], { customer_id: customer.customer_id, status: 'INACTIVE' });
  });

  for (const column of ['branch_id', 'customer_number', 'nic_passport_no', 'full_name', 'date_of_birth', 'email', 'status']) {
    test(`required ${column} rejects NULL`, async () => {
      await rejectsWith(() => insertCustomer({ [column]: null }), '23502', column, 'column');
    });
  }

  test('referenced branch deletion is restricted', async () => {
    await insertCustomer();
    await rejectsWith(() => client.query('DELETE FROM branch WHERE branch_id = $1', [branchId]),
      ['23001', '23503'], 'fk_customer_branch');
  });
  test('linked login deletion is restricted', async () => {
    const userId = await insertLogin();
    await insertCustomer({ app_user_id: userId });
    await rejectsWith(() => client.query('DELETE FROM app_user WHERE user_id = $1', [userId]),
      ['23001', '23503'], 'fk_customer_app_user');
  });

  test('GIN trigram index supports fuzzy and case-insensitive substring search', async () => {
    const target = await insertCustomer();
    await insertCustomer({ full_name: 'Synthetic Unrelated Customer' });
    const index = await client.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'customer' AND indexname = $1`,
      ['ix_customer_full_name_trgm'],
    );
    assert.equal(index.rows.length, 1);
    assert.match(index.rows[0].indexdef, /USING gin \(full_name gin_trgm_ops\)/);
    const fuzzy = await client.query(
      'SELECT customer_id FROM customer WHERE branch_id = $1 AND full_name % $2', [branchId, 'Malini Perer'],
    );
    assert.deepEqual(fuzzy.rows, [{ customer_id: target.customer_id }]);
    const substring = await client.query(
      'SELECT customer_id FROM customer WHERE branch_id = $1 AND full_name ILIKE $2', [branchId, '%malini%'],
    );
    assert.deepEqual(substring.rows, [{ customer_id: target.customer_id }]);
  });
  test('branch lookup B-tree index exists', async () => {
    const index = await client.query(
      'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', ['public', 'ix_customer_branch'],
    );
    assert.equal(index.rows.length, 1);
    assert.match(index.rows[0].indexdef, /USING btree \(branch_id\)/);
  });
  test('updated_at is maintained by the shared trigger', async () => {
    // now() is transaction-scoped: pin the insert value to prove the trigger replaces it.
    const inserted = await client.query(
      `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING customer_id, updated_at`,
      [branchId, `OLD-${suffix}`, `OLD-${suffix}`, 'Synthetic Timestamp', '1990-01-01', `old-${suffix}@example.invalid`, '2000-01-01T00:00:00Z'],
    );
    const updated = await client.query(
      'UPDATE customer SET phone = $1 WHERE customer_id = $2 RETURNING updated_at', ['0110000001', inserted.rows[0].customer_id],
    );
    assert.ok(updated.rows[0].updated_at > inserted.rows[0].updated_at);
  });
  test('rollback removes customer insert completely', async () => {
    await client.query('SAVEPOINT rollback_customer');
    const customer = await insertCustomer();
    await client.query('ROLLBACK TO SAVEPOINT rollback_customer');
    const result = await client.query('SELECT customer_id FROM customer WHERE customer_id = $1', [customer.customer_id]);
    assert.equal(result.rows.length, 0);
  });
  test('runtime customer access remains denied until M1 grants scoped privileges', async () => {
    const result = await client.query(
      `SELECT has_table_privilege('mims_app', 'customer', 'SELECT') AS can_read,
              has_table_privilege('mims_app', 'customer', 'INSERT') AS can_insert,
              has_table_privilege('mims_app', 'customer', 'DELETE') AS can_delete`,
    );
    assert.deepEqual(result.rows[0], { can_read: false, can_insert: false, can_delete: false });
  });
});
