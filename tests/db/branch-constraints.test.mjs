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

const testBranchCodes = [
  "TEST-DUPLICATE",
  "TEST-INVALID",
  "TEST-NULL",
  "TEST-TRIGGER",
];

describe("P01-M02-T01: Branch schema constraints", () => {
  let client;

  before(async () => {
    client = new pg.Client({ connectionString });
    await client.connect();

    await client.query(
      `DELETE FROM branch
       WHERE branch_code = ANY($1::text[])`,
      [testBranchCodes],
    );
  });

  after(async () => {
    await client.query(
      `DELETE FROM branch
       WHERE branch_code = ANY($1::text[])`,
      [testBranchCodes],
    );

    await client.end();
  });

  test("duplicate branch_code is rejected with code 23505", async () => {
    await client.query(
      `INSERT INTO branch (
         branch_code,
         branch_name,
         address,
         district,
         phone
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "TEST-DUPLICATE",
        "Test Branch One",
        "1 Test Road",
        "Colombo",
        "0111111111",
      ],
    );

    await assert.rejects(
      client.query(
        `INSERT INTO branch (
           branch_code,
           branch_name,
           address,
           district,
           phone
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "TEST-DUPLICATE",
          "Test Branch Two",
          "2 Test Road",
          "Colombo",
          "0112222222",
        ],
      ),
      (error) => {
        assert.equal(error.code, "23505");
        assert.equal(error.constraint, "uq_branch_branch_code");
        return true;
      },
    );
  });

  test("invalid branch status is rejected with code 23514", async () => {
    await assert.rejects(
      client.query(
        `INSERT INTO branch (
           branch_code,
           branch_name,
           address,
           district,
           phone,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "TEST-INVALID",
          "Invalid Status Branch",
          "3 Test Road",
          "Gampaha",
          "0333333333",
          "DELETED",
        ],
      ),
      (error) => {
        assert.equal(error.code, "23514");
        return true;
      },
    );
  });

  test("required branch_name is rejected when null", async () => {
    await assert.rejects(
      client.query(
        `INSERT INTO branch (
           branch_code,
           branch_name,
           address,
           district,
           phone
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "TEST-NULL",
          null,
          "4 Test Road",
          "Kandy",
          "0811111111",
        ],
      ),
      (error) => {
        assert.equal(error.code, "23502");
        assert.equal(error.column, "branch_name");
        return true;
      },
    );
  });

  test("status defaults to ACTIVE and updated_at changes automatically", async () => {
    const inserted = await client.query(
      `INSERT INTO branch (
         branch_code,
         branch_name,
         address,
         district,
         phone,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING status, updated_at`,
      [
        "TEST-TRIGGER",
        "Trigger Test Branch",
        "5 Test Road",
        "Galle",
        "0911111111",
        "2000-01-01T00:00:00Z",
      ],
    );

    assert.equal(inserted.rows[0].status, "ACTIVE");

    const previousUpdatedAt = new Date(inserted.rows[0].updated_at);

    const updated = await client.query(
      `UPDATE branch
       SET phone = $1
       WHERE branch_code = $2
       RETURNING updated_at`,
      ["0912222222", "TEST-TRIGGER"],
    );

    const newUpdatedAt = new Date(updated.rows[0].updated_at);

    assert.ok(
      newUpdatedAt > previousUpdatedAt,
      "updated_at should be changed by the trigger",
    );
  });
});
