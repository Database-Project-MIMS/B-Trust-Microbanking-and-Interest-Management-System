import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { /* Explicit environment is supported. */ }
}
if (!process.env.DATABASE_MIGRATION_URL) throw new Error('Customer relation tests require the owner connection.');
process.env.DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
export const { pool } = await import('../../lib/db/pool.ts');

export async function createFixture(client) {
  const suffix = randomUUID().slice(0, 8);
  let sequence = 0;
  async function branch() {
    const result = await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, 'Synthetic Relation Branch', 'Synthetic Road', 'Colombo', '0110000000')
       RETURNING branch_id`, [`REL-${suffix}-${++sequence}`],
    );
    return result.rows[0].branch_id;
  }
  const branchId = await branch();
  const otherBranchId = await branch();
  async function staff(roleName = 'AGENT', targetBranchId = branchId) {
    const marker = `${suffix}-${++sequence}`;
    const user = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       SELECT role_id, $1, $2 FROM role WHERE role_name = $3 RETURNING user_id`,
      [`rel-${marker}`, 'synthetic-unusable-hash', roleName],
    );
    assert.ok(user.rows[0], `Seeded ${roleName} role is required.`);
    const userId = user.rows[0].user_id;
    if (['AGENT', 'BRANCH_MANAGER'].includes(roleName)) {
      await client.query(
        `INSERT INTO agent (agent_id, branch_id, employee_no, nic_passport_no, full_name,
          date_of_birth, gender, phone, address, email, hired_date)
         VALUES ($1, $2, $3, $4, 'Synthetic Staff', '1980-01-01', 'OTHER', '0110000000',
           'Synthetic Road', $5, '2020-01-01')`,
        [userId, targetBranchId, `REL-${marker}`, `REL-ID-${marker}`, `staff-${marker}@example.invalid`],
      );
    }
    return userId;
  }
  const agentId = await staff();
  const secondAgentId = await staff();
  const managerId = await staff('BRANCH_MANAGER');
  const otherManagerId = await staff('BRANCH_MANAGER', otherBranchId);
  const customerLoginId = await staff('CUSTOMER');
  async function customer(targetBranchId = branchId) {
    const marker = `${suffix}-${++sequence}`;
    const result = await client.query(
      `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
       VALUES ($1, $2, $3, 'Synthetic Relation Customer', '1990-01-01', $4) RETURNING customer_id`,
      [targetBranchId, `REL-${marker}`, `REL-ID-${marker}`, `customer-${marker}@example.invalid`],
    );
    return result.rows[0].customer_id;
  }
  const customerId = await customer();
  async function assignment(overrides = {}) {
    const value = { customer_id: customerId, agent_id: agentId, assigned_date: '2020-01-01',
      end_date: null, is_active: true, updated_at: '2000-01-01T00:00:00Z', ...overrides };
    const result = await client.query(
      `INSERT INTO customer_agent (customer_id, agent_id, assigned_date, end_date, is_active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING cust_agent_id, customer_id, agent_id, assigned_date,
         end_date, is_active, created_at, updated_at`,
      [value.customer_id, value.agent_id, value.assigned_date, value.end_date, value.is_active, value.updated_at],
    );
    return result.rows[0];
  }
  async function document(overrides = {}) {
    const value = { customer_id: customerId, doc_type: 'NIC', file_path: `synthetic/${suffix}/nic.pdf`,
      verified_by: null, verified_date: null, updated_at: '2000-01-01T00:00:00Z', ...overrides };
    const result = await client.query(
      `INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING doc_id, customer_id, doc_type, file_path,
         uploaded_date, verified_by, verified_date, created_at, updated_at`,
      [value.customer_id, value.doc_type, value.file_path, value.verified_by, value.verified_date, value.updated_at],
    );
    return result.rows[0];
  }
  return { branchId, otherBranchId, agentId, secondAgentId, managerId, otherManagerId,
    customerLoginId, customerId, staff, customer, assignment, document };
}

export async function rejectsSql(client, operation, codes, identifier, field = 'constraint') {
  await client.query('SAVEPOINT expected_failure');
  try {
    await assert.rejects(operation, error => {
      assert.ok([codes].flat().includes(error.code), `Unexpected SQLSTATE ${error.code}`);
      assert.equal(error[field], identifier);
      return true;
    });
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    await client.query('RELEASE SAVEPOINT expected_failure');
  }
}

export async function requireDisposableDatabase(client) {
  const result = await client.query('SELECT current_database() AS name');
  assert.equal(result.rows[0].name, 'mims_test_customer_schema',
    'Committing service/concurrency fixtures is allowed only in the disposable verification database.');
}
