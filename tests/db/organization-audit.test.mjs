import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { }
}

const ownerConnectionString =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("P01-M02-T03: organisation audit triggers", () => {
  let client;

  before(async () => {
    client = new pg.Client({ connectionString: ownerConnectionString });
    await client.connect();
  });

  after(async () => {
    if (!client) return;
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  });

  test("branch and agent audit rows share the caller transaction and omit sensitive values", async () => {
    const suffix = crypto.randomBytes(5).toString("hex");
    const branchCode = `AUD${suffix}`.toUpperCase();
    const username = `audit_${suffix}`;
    const passwordHash = `secret-hash-${suffix}`;
    const identity = `secret-identity-${suffix}`;

    await client.query("BEGIN");

    const roleResult = await client.query(
      `INSERT INTO role (role_name, description, status)
       VALUES ('AGENT', 'Audit test agent role', 'ACTIVE')
       ON CONFLICT (role_name) DO UPDATE SET status = 'ACTIVE'
       RETURNING role_id`,
    );
    assert.equal(roleResult.rowCount, 1);

    const branchResult = await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, 'Audit Test Branch', 'Audit address', 'Audit district', '+94110000999')
       RETURNING branch_id`,
      [branchCode],
    );
    const branchId = branchResult.rows[0].branch_id;

    const userResult = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING user_id`,
      [roleResult.rows[0].role_id, username, passwordHash],
    );
    const userId = userResult.rows[0].user_id;

    await client.query(
      `INSERT INTO agent (
         agent_id, branch_id, employee_no, nic_passport_no, full_name,
         date_of_birth, gender, phone, address, email, hired_date, status
       ) VALUES (
         $1, $2, $3, $4, 'Audit Test Agent',
         DATE '1990-01-01', 'OTHER', '+94110000888', 'Audit address', $5,
         DATE '2020-01-01', 'ACTIVE'
       )`,
      [userId, branchId, `AUD-${suffix}`, identity, `${username}@example.test`],
    );

    const auditResult = await client.query(
      `SELECT entity_type, entity_id, new_values
         FROM audit_log
        WHERE (entity_type = 'branch' AND entity_id = $1)
           OR (entity_type IN ('app_user', 'agent') AND entity_id = $2)
        ORDER BY entity_type`,
      [branchId, userId],
    );

    assert.deepEqual(
      auditResult.rows.map((row) => row.entity_type),
      ["agent", "app_user", "branch"],
    );
    for (const row of auditResult.rows) {
      assert.equal("password_hash" in row.new_values, false);
      assert.equal("nic_passport_no" in row.new_values, false);
      assert.equal(JSON.stringify(row.new_values).includes(passwordHash), false);
      assert.equal(JSON.stringify(row.new_values).includes(identity), false);
    }

    await client.query("ROLLBACK");

    const rolledBack = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM audit_log
        WHERE (entity_type = 'branch' AND entity_id = $1)
           OR (entity_type IN ('app_user', 'agent') AND entity_id = $2)`,
      [branchId, userId],
    );
    assert.equal(rolledBack.rows[0].count, 0);
  });
});
