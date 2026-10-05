import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try {
    process.loadEnvFile();
  } catch {
    // The environment may already be provided by the test runner.
  }
}

const connectionString =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("P01-M02-T02: Agent schema constraints", () => {
  let client;
  let roleId;
  let activeBranchId;
  let inactiveBranchId;

  async function cleanFixtures() {
    await client.query(
      `DELETE FROM agent
       WHERE employee_no LIKE 'TEST-AGT-%'`,
    );
    await client.query(
      `DELETE FROM app_user
       WHERE username LIKE 'test_agent_%'`,
    );
    await client.query(
      `DELETE FROM branch
       WHERE branch_code LIKE 'TEST-AGT-%'`,
    );
    await client.query(
      `DELETE FROM role
       WHERE role_name = 'TEST_AGENT_ROLE'`,
    );
  }

  async function createUser(username) {
    const result = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
      [roleId, username, "test-hash-not-a-real-password"],
    );

    return result.rows[0].user_id;
  }

  async function createAgent({
    userId,
    branchId = activeBranchId,
    employeeNo,
    nicPassportNo,
    email,
    status = "ACTIVE",
  }) {
    return client.query(
      `INSERT INTO agent (
         agent_id,
         branch_id,
         employee_no,
         nic_passport_no,
         full_name,
         date_of_birth,
         gender,
         phone,
         address,
         email,
         hired_date,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING agent_id, branch_id, status, updated_at`,
      [
        userId,
        branchId,
        employeeNo,
        nicPassportNo,
        `Test Agent ${employeeNo}`,
        "1990-01-01",
        "OTHER",
        "0710000000",
        "1 Test Agent Road",
        email,
        "2025-01-01",
        status,
      ],
    );
  }

  before(async () => {
    client = new pg.Client({ connectionString });
    await client.connect();
    await cleanFixtures();

    const roleResult = await client.query(
      `INSERT INTO role (role_name, description)
       VALUES ($1, $2)
       RETURNING role_id`,
      ["TEST_AGENT_ROLE", "Role used only by agent constraint tests"],
    );
    roleId = roleResult.rows[0].role_id;

    const activeBranchResult = await client.query(
      `INSERT INTO branch (
         branch_code,
         branch_name,
         address,
         district,
         phone,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       RETURNING branch_id`,
      [
        "TEST-AGT-ACTIVE",
        "Active Agent Test Branch",
        "1 Active Road",
        "Colombo",
        "0110000001",
      ],
    );
    activeBranchId = activeBranchResult.rows[0].branch_id;

    const inactiveBranchResult = await client.query(
      `INSERT INTO branch (
         branch_code,
         branch_name,
         address,
         district,
         phone,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'INACTIVE')
       RETURNING branch_id`,
      [
        "TEST-AGT-INACTIVE",
        "Inactive Agent Test Branch",
        "2 Inactive Road",
        "Kandy",
        "0810000001",
      ],
    );
    inactiveBranchId = inactiveBranchResult.rows[0].branch_id;
  });

  after(async () => {
    await cleanFixtures();
    await client.end();
  });

  test("agent must reference an existing app_user", async () => {
    await assert.rejects(
      createAgent({
        userId: "00000000-0000-0000-0000-000000000099",
        employeeNo: "TEST-AGT-MISSING-USER",
        nicPassportNo: "TEST-NIC-MISSING-USER",
        email: "missing-user@example.test",
      }),
      (error) => {
        assert.equal(error.code, "23503");
        assert.equal(error.constraint, "fk_agent_app_user");
        return true;
      },
    );
  });

  test("employee number, identity number, and email are unique", async () => {
    const firstUserId = await createUser("test_agent_unique_1");
    const secondUserId = await createUser("test_agent_unique_2");

    await createAgent({
      userId: firstUserId,
      employeeNo: "TEST-AGT-UNIQUE-1",
      nicPassportNo: "TEST-NIC-UNIQUE-1",
      email: "unique-1@example.test",
    });

    const duplicateCases = [
      {
        employeeNo: "TEST-AGT-UNIQUE-1",
        nicPassportNo: "TEST-NIC-UNIQUE-2",
        email: "unique-2@example.test",
        constraint: "uq_agent_employee_no",
      },
      {
        employeeNo: "TEST-AGT-UNIQUE-2",
        nicPassportNo: "TEST-NIC-UNIQUE-1",
        email: "unique-2@example.test",
        constraint: "uq_agent_nic_passport_no",
      },
      {
        employeeNo: "TEST-AGT-UNIQUE-2",
        nicPassportNo: "TEST-NIC-UNIQUE-2",
        email: "unique-1@example.test",
        constraint: "uq_agent_email",
      },
    ];

    for (const duplicate of duplicateCases) {
      await assert.rejects(
        createAgent({ userId: secondUserId, ...duplicate }),
        (error) => {
          assert.equal(error.code, "23505");
          assert.equal(error.constraint, duplicate.constraint);
          return true;
        },
      );
    }
  });

  test("active agent cannot belong to an inactive branch", async () => {
    const userId = await createUser("test_agent_inactive_branch");

    await assert.rejects(
      createAgent({
        userId,
        branchId: inactiveBranchId,
        employeeNo: "TEST-AGT-BAD-BRANCH",
        nicPassportNo: "TEST-NIC-BAD-BRANCH",
        email: "bad-branch@example.test",
      }),
      (error) => {
        assert.equal(error.code, "23514");
        assert.equal(error.constraint, "ck_agent_active_branch");
        return true;
      },
    );
  });

  test("inactive agent may remain assigned to an inactive branch", async () => {
    const userId = await createUser("test_agent_inactive");

    const result = await createAgent({
      userId,
      branchId: inactiveBranchId,
      employeeNo: "TEST-AGT-INACTIVE",
      nicPassportNo: "TEST-NIC-INACTIVE",
      email: "inactive@example.test",
      status: "INACTIVE",
    });

    assert.equal(result.rows[0].branch_id, inactiveBranchId);
    assert.equal(result.rows[0].status, "INACTIVE");
  });

  test("branch with active agents cannot be deactivated", async () => {
    const userId = await createUser("test_agent_branch_guard");

    await createAgent({
      userId,
      employeeNo: "TEST-AGT-BRANCH-GUARD",
      nicPassportNo: "TEST-NIC-BRANCH-GUARD",
      email: "branch-guard@example.test",
    });

    await assert.rejects(
      client.query(
        `UPDATE branch
         SET status = 'INACTIVE'
         WHERE branch_id = $1`,
        [activeBranchId],
      ),
      (error) => {
        assert.equal(error.code, "23514");
        assert.equal(error.constraint, "ck_branch_no_active_agents");
        return true;
      },
    );
  });

  test("referenced branch cannot be deleted", async () => {
    await assert.rejects(
      client.query(
        `DELETE FROM branch
         WHERE branch_id = $1`,
        [activeBranchId],
      ),
      (error) => {
        assert.ok(
          error.code === "23001" || error.code === "23503",
          `Expected restrict or foreign-key violation, got ${error.code}`,
        );
        assert.equal(error.constraint, "fk_agent_branch");
        return true;
      },
    );
  });

  test("referenced app_user cannot be deleted", async () => {
    const result = await client.query(
      `SELECT agent_id
       FROM agent
       WHERE employee_no = $1`,
      ["TEST-AGT-BRANCH-GUARD"],
    );

    await assert.rejects(
      client.query(
        `DELETE FROM app_user
         WHERE user_id = $1`,
        [result.rows[0].agent_id],
      ),
      (error) => {
        assert.ok(
          error.code === "23001" || error.code === "23503",
          `Expected restrict or foreign-key violation, got ${error.code}`,
        );
        assert.equal(error.constraint, "fk_agent_app_user");
        return true;
      },
    );
  });

  test("agent updated_at is maintained automatically", async () => {
    const result = await client.query(
      `UPDATE agent
       SET updated_at = $1,
           phone = $2
       WHERE employee_no = $3
       RETURNING updated_at`,
      ["2000-01-01T00:00:00Z", "0710000001", "TEST-AGT-BRANCH-GUARD"],
    );

    assert.ok(
      new Date(result.rows[0].updated_at) > new Date("2000-01-01T00:00:00Z"),
      "updated_at should be replaced by the trigger",
    );
  });

  test("branch and status lookup index exists", async () => {
    const result = await client.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'agent'
         AND indexname = 'ix_agent_branch_status'`,
    );

    assert.equal(result.rows.length, 1);
  });
});
