import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// Load .env if not already in environment
if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile();
    } catch {
        // ignore if loaded by runner
    }
}

const connectionString =
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("Step 2: Identity Schema Constraints", () => {
    let client;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
    });

    after(async () => {
        await client.end();
    });

    // 1. Duplicate username is rejected (error 23505)
    test("1. Duplicate username is rejected with code 23505", async () => {
        const roleRes = await client.query(
            `INSERT INTO role (role_name, description) VALUES ('TEST_ROLE_1', 'Test role') RETURNING role_id`
        );
        const roleId = roleRes.rows[0].role_id;

        try {
            await client.query(
                `INSERT INTO app_user (role_id, username, password_hash)
         VALUES ($1, 'duplicate_user', 'hash123')`,
                [roleId]
            );

            await assert.rejects(
                client.query(
                    `INSERT INTO app_user (role_id, username, password_hash)
           VALUES ($1, 'duplicate_user', 'hash456')`,
                    [roleId]
                ),
                (err) => {
                    assert.equal(err.code, "23505", "Expected unique_violation (23505)");
                    return true;
                }
            );
        } finally {
            await client.query(`DELETE FROM app_user WHERE username = 'duplicate_user'`);
            await client.query(`DELETE FROM role WHERE role_id = $1`, [roleId]);
        }
    });

    // 2. Deleting a role that is referenced by app_user is rejected (RESTRICT: 23503)
    test("2. Deleting a role referenced by app_user is rejected with code 23503", async () => {
        const roleRes = await client.query(
            `INSERT INTO role (role_name, description) VALUES ('RESTRICT_ROLE', 'Test') RETURNING role_id`
        );
        const roleId = roleRes.rows[0].role_id;

        await client.query(
            `INSERT INTO app_user (role_id, username, password_hash)
       VALUES ($1, 'user_with_role', 'hash123')`,
            [roleId]
        );

        try {
            await assert.rejects(
                client.query(`DELETE FROM role WHERE role_id = $1`, [roleId]),
                (err) => {
                    assert.ok(
                        err.code === "23001" || err.code === "23503",
                        `Expected restrict_violation (23001) or foreign_key_violation (23503), got ${err.code}`
                    );
                    return true;
                }
            );
        } finally {
            await client.query(`DELETE FROM app_user WHERE username = 'user_with_role'`);
            await client.query(`DELETE FROM role WHERE role_id = $1`, [roleId]);
        }
    });

    // 3. No plaintext password column exists
    test("3. No plaintext password column exists in app_user", async () => {
        const checkPlaintext = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_user'
        AND column_name = 'password';
    `);
        assert.equal(checkPlaintext.rows.length, 0, "No 'password' column should exist");

        const checkHash = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_user'
        AND column_name = 'password_hash';
    `);
        assert.equal(checkHash.rows.length, 1, "'password_hash' column must exist");
    });

    // 4. NULL username is rejected (not_null_violation: 23502)
    test("4. NULL username is rejected with code 23502", async () => {
        const roleRes = await client.query(
            `INSERT INTO role (role_name, description) VALUES ('NULL_USER_ROLE', 'Test') RETURNING role_id`
        );
        const roleId = roleRes.rows[0].role_id;

        try {
            await assert.rejects(
                client.query(
                    `INSERT INTO app_user (role_id, username, password_hash)
           VALUES ($1, NULL, 'hash123')`,
                    [roleId]
                ),
                (err) => {
                    assert.equal(err.code, "23502", "Expected not_null_violation (23502)");
                    return true;
                }
            );
        } finally {
            await client.query(`DELETE FROM role WHERE role_id = $1`, [roleId]);
        }
    });

    // 5. Invalid status values are rejected by CHECK constraint (23514)
    test("5. Invalid status values are rejected with code 23514", async () => {
        await assert.rejects(
            client.query(`INSERT INTO role (role_name, status) VALUES ('BAD_STATUS_ROLE', 'INVALID_STATUS')`),
            (err) => {
                assert.equal(err.code, "23514", "Expected check_violation (23514)");
                return true;
            }
        );
    });
});
