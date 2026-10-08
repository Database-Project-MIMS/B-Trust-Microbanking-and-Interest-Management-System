import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';

// The upgrade scenario temporarily exercises pre-0320 DDL in a rolled-back transaction.
// Never run this suite against a normal development/production database.
if (process.env.MIMS_ISOLATED_TEST !== '1' || !process.env.DATABASE_MIGRATION_URL) {
  throw new Error('Use the disposable verification runner for attribution tests.');
}

describe('P03-M02-T01: transaction attribution', () => {
  let client;
  let agentId;
  let branchId;
  let otherBranchId;
  let channelId;
  let accountId;
  let suffix;
  let sequence;

  before(async () => {
    client = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
    await client.connect();
    const agent = (await client.query(
      `SELECT a.agent_id, a.branch_id FROM agent a
       JOIN app_user u ON u.user_id = a.agent_id JOIN role r ON r.role_id = u.role_id
       WHERE a.status = 'ACTIVE' AND r.role_name = 'AGENT' ORDER BY a.employee_no LIMIT 1`,
    )).rows[0];
    assert.ok(agent, 'A seeded agent is required.');
    agentId = agent.agent_id;
    branchId = agent.branch_id;
    otherBranchId = (await client.query(
      "SELECT branch_id FROM branch WHERE branch_id <> $1 AND status = 'ACTIVE' ORDER BY branch_code LIMIT 1",
      [branchId],
    )).rows[0].branch_id;
    channelId = (await client.query(
      "SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM'",
    )).rows[0].channel_id;
  });
  beforeEach(async () => {
    await client.query('BEGIN');
    suffix = randomUUID().slice(0, 8);
    sequence = 0;
    accountId = (await client.query(
      `INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id)
       SELECT $1, plan_id, $2, $3 FROM savings_plan WHERE plan_name = 'Children'
       RETURNING account_id`,
      [`TEST-ATTR-${suffix}`, branchId, agentId],
    )).rows[0].account_id;
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { await client?.end(); });

  async function insert({ agent = agentId, branch = branchId, type = 'DEPOSIT' } = {}) {
    return (await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id,
                               reference_number, transaction_type, amount, agent_id, branch_id)
       VALUES ($1, $2, $3, $4, $5, 125.50, $6, $7)
       RETURNING transaction_id, agent_id, branch_id, amount`,
      [accountId, agentId, channelId, `ATTR-${suffix}-${++sequence}`, type, agent, branch],
    )).rows[0];
  }
  async function rejects(operation, codes, constraint) {
    await client.query('SAVEPOINT expected_failure');
    try {
      await assert.rejects(operation, error => {
        assert.ok([codes].flat().includes(error.code), `Unexpected SQLSTATE ${error.code}`);
        if (constraint) assert.equal(error.constraint, constraint);
        return true;
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT expected_failure');
      await client.query('RELEASE SAVEPOINT expected_failure');
    }
  }

  test('both attribution columns are nullable UUIDs', async () => {
    const { rows } = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'transaction'
         AND column_name IN ('agent_id', 'branch_id') ORDER BY column_name`,
    );
    assert.deepEqual(rows, [
      { column_name: 'agent_id', data_type: 'uuid', is_nullable: 'YES' },
      { column_name: 'branch_id', data_type: 'uuid', is_nullable: 'YES' },
    ]);
  });

  test('valid reporting indexes use the actual ledger timestamp', async () => {
    const { rows } = await client.query(
      `SELECT c.relname AS name, i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
       FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
       WHERE i.indrelid = 'public.transaction'::regclass
         AND c.relname IN ('ix_transaction_agent_date', 'ix_transaction_branch_date')
       ORDER BY c.relname`,
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.valid));
    assert.match(rows[0].definition, /USING btree \(agent_id, transaction_date\)/);
    assert.match(rows[1].definition, /USING btree \(branch_id, transaction_date\)/);
  });

  test('valid attribution is stored separately from the responsible login', async () => {
    const row = await insert();
    assert.equal(row.agent_id, agentId);
    assert.equal(row.branch_id, branchId);
    assert.equal(row.amount, '125.50');
  });

  test('system credit supports NULL agent and branch attribution', async () => {
    const row = await insert({ agent: null, branch: null, type: 'INTEREST_CREDIT' });
    assert.equal(row.agent_id, null);
    assert.equal(row.branch_id, null);
  });

  test('unattributed postings can retain a known branch', async () => {
    const row = await insert({ agent: null });
    assert.equal(row.agent_id, null);
    assert.equal(row.branch_id, branchId);
  });

  test('existing producer column lists still insert with NULL attribution', async () => {
    const row = (await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id,
                               reference_number, transaction_type, amount)
       VALUES ($1, $2, $3, $4, 'DEPOSIT', 10.00) RETURNING agent_id, branch_id`,
      [accountId, agentId, channelId, `LEGACY-${suffix}`],
    )).rows[0];
    assert.deepEqual(row, { agent_id: null, branch_id: null });
  });

  test('unknown reporting agent is rejected by its named FK', async () => {
    await rejects(() => insert({ agent: randomUUID() }), '23503', 'fk_transaction_agent');
  });

  test('unknown posting branch is rejected by its named FK', async () => {
    await rejects(() => insert({ branch: randomUUID() }), '23503', 'fk_transaction_branch');
  });

  test('an attribution-only branch cannot be deleted', async () => {
    const branch = (await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, 'Synthetic Attribution Branch', '1 Test Road', 'Colombo', '0110000000')
       RETURNING branch_id`, [`ATTR-${suffix}`],
    )).rows[0].branch_id;
    await insert({ agent: null, branch });
    await rejects(() => client.query('DELETE FROM branch WHERE branch_id = $1', [branch]),
      ['23001', '23503'], 'fk_transaction_branch');
  });

  test('an attribution-only agent cannot be deleted', async () => {
    const user = (await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       SELECT role_id, $1, 'synthetic-unusable-hash' FROM role WHERE role_name = 'AGENT'
       RETURNING user_id`, [`attr-${suffix}`],
    )).rows[0].user_id;
    await client.query(
      `INSERT INTO agent (agent_id, branch_id, employee_no, nic_passport_no, full_name,
                          date_of_birth, gender, phone, address, email, hired_date)
       VALUES ($1, $2, $3, $4, 'Synthetic Attribution Agent', '1990-01-01', 'OTHER',
               '0710000000', '1 Test Road', $5, '2025-01-01')`,
      [user, branchId, `ATTR-${suffix}`, `SYN-${suffix}`, `${suffix}@example.invalid`],
    );
    await insert({ agent: user });
    await rejects(() => client.query('DELETE FROM agent WHERE agent_id = $1', [user]),
      ['23001', '23503'], 'fk_transaction_agent');
  });

  test('an agent transfer does not change historical branch attribution or totals', async () => {
    await insert();
    await client.query('UPDATE agent SET branch_id = $1 WHERE agent_id = $2', [otherBranchId, agentId]);
    const { rows } = await client.query(
      `SELECT branch_id, count(*)::int AS count, sum(amount)::text AS total
       FROM transaction WHERE account_id = $1 AND agent_id = $2 GROUP BY branch_id`,
      [accountId, agentId],
    );
    assert.deepEqual(rows, [{ branch_id: branchId, count: 1, total: '125.50' }]);
  });

  test('the ledger trigger rejects attribution edits and deletion even for the owner', async () => {
    const row = await insert();
    await rejects(() => client.query('UPDATE transaction SET agent_id = NULL WHERE transaction_id = $1',
      [row.transaction_id]), 'P0001');
    await rejects(() => client.query('UPDATE transaction SET branch_id = $1 WHERE transaction_id = $2',
      [otherBranchId, row.transaction_id]), 'P0001');
    await rejects(() => client.query('DELETE FROM transaction WHERE transaction_id = $1',
      [row.transaction_id]), 'P0001');
  });

  test('runtime role inserts attribution but retains no UPDATE/DELETE privileges', async () => {
    await client.query('SET LOCAL ROLE mims_app');
    await insert();
    const { rows } = await client.query(
      `SELECT has_table_privilege(current_user, 'transaction', 'UPDATE') AS upd,
              has_table_privilege(current_user, 'transaction', 'DELETE') AS del`,
    );
    assert.deepEqual(rows[0], { upd: false, del: false });
    await rejects(() => client.query('UPDATE transaction SET agent_id = NULL WHERE account_id = $1',
      [accountId]), '42501');
    await rejects(() => client.query('DELETE FROM transaction WHERE account_id = $1', [accountId]), '42501');
  });

  test('a rolled-back posting retains neither attribution nor a ledger row', async () => {
    await client.query('SAVEPOINT posting');
    const row = await insert();
    await client.query('ROLLBACK TO SAVEPOINT posting');
    assert.equal((await client.query('SELECT transaction_id FROM transaction WHERE transaction_id = $1',
      [row.transaction_id])).rows.length, 0);
    assert.equal((await client.query('SELECT current_balance FROM account WHERE account_id = $1',
      [accountId])).rows[0].current_balance, '0.00');
  });

  test('0320 upgrades a populated immutable ledger without rewriting legacy rows', async () => {
    // Recreate the pre-0320 shape only within this disposable, rolled-back scenario.
    await client.query('ALTER TABLE transaction DROP COLUMN agent_id, DROP COLUMN branch_id');
    const row = (await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id,
                               reference_number, transaction_type, amount)
       VALUES ($1, $2, $3, $4, 'DEPOSIT', 10.00)
       RETURNING transaction_id, reference_number, amount, transaction_date, created_at`,
      [accountId, agentId, channelId, `UPGRADE-${suffix}`],
    )).rows[0];
    const sql = readFileSync(new URL('../../database/migrations/0320_p03_m02_transaction_attribution.sql',
      import.meta.url), 'utf8').replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
    await client.query(sql);
    const upgraded = (await client.query(
      `SELECT transaction_id, reference_number, amount, transaction_date, created_at, agent_id, branch_id
       FROM transaction WHERE transaction_id = $1`, [row.transaction_id],
    )).rows[0];
    assert.deepEqual(upgraded, { ...row, agent_id: null, branch_id: null });
    await rejects(() => client.query('UPDATE transaction SET agent_id = $1 WHERE transaction_id = $2',
      [agentId, row.transaction_id]), 'P0001');
  });
});
