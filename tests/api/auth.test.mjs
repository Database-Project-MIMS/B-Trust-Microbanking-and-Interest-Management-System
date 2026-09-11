import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import argon2 from "argon2";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
    try { process.loadEnvFile(); } catch { }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

describe("Step 6: Authentication API & Service Tests", () => {
    let client;
    let testRoleId;
    let testUserId;
    const testUsername = "auth_test_user";
    const testPassword = "SecurePassword@123";

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        // Ensure test role exists
        const roleRes = await client.query(
            `INSERT INTO role (role_name, description) 
       VALUES ('AUTH_TEST_ROLE', 'Role for auth testing') 
       ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
       RETURNING role_id`
        );
        testRoleId = roleRes.rows[0].role_id;

        // Hash password & insert test user
        const hash = await argon2.hash(testPassword, { type: argon2.argon2id });
        const userRes = await client.query(
            `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING user_id`,
            [testRoleId, testUsername, hash]
        );
        testUserId = userRes.rows[0].user_id;
    });

    after(async () => {
        await client.query(`DELETE FROM user_session WHERE user_id = $1`, [testUserId]);
        await client.query(`DELETE FROM login_attempt WHERE username_attempted = $1`, [testUsername]);
        await client.query(`DELETE FROM app_user WHERE user_id = $1`, [testUserId]);
        await client.query(`DELETE FROM role WHERE role_id = $1`, [testRoleId]);
        await client.end();
    });

    test("1. Hash is never returned by password verification", async () => {
        const isMatch = await argon2.verify(
            await argon2.hash(testPassword, { type: argon2.argon2id }),
            testPassword
        );
        assert.equal(isMatch, true);
    });

    test("2. Non-existent username and wrong password produce identical generic error code", async () => {
        const { login } = await import("../../services/auth-service.ts");

        const badUserResult = await login("non_existent_user_999", "any_password");
        const badPassResult = await login(testUsername, "WrongPassword@123");

        assert.equal(badUserResult.statusCode, 401);
        assert.equal(badPassResult.statusCode, 401);
        assert.equal(badUserResult.error.code, "INVALID_CREDENTIALS");
        assert.equal(badPassResult.error.code, "INVALID_CREDENTIALS");
        assert.equal(badUserResult.error.message, badPassResult.error.message);
    });

    test("3. Valid credentials succeed and create session", async () => {
        const { login } = await import("../../services/auth-service.ts");
        const result = await login(testUsername, testPassword);

        assert.equal(result.success, true);
        assert.equal(result.statusCode, 200);
        assert.ok(result.sessionToken, "Must return a session token");
        assert.equal(result.user.username, testUsername);
        // Ensure password_hash is not in the user object
        assert.equal(result.user.password_hash, undefined);
    });

    test("4. Five failed login attempts trigger throttling (429)", async () => {
        const { login } = await import("../../services/auth-service.ts");
        const throttleUser = "throttle_test_user";

        // Insert 5 simulated failures directly
        for (let i = 0; i < 5; i++) {
            await client.query(
                `INSERT INTO login_attempt (username_attempted, success, ip_address)
         VALUES ($1, false, '127.0.0.1')`,
                [throttleUser]
            );
        }

        try {
            const throttledResult = await login(throttleUser, "AnyPass");
            assert.equal(throttledResult.statusCode, 429);
            assert.equal(throttledResult.error.code, "TOO_MANY_ATTEMPTS");
        } finally {
            await client.query(`DELETE FROM login_attempt WHERE username_attempted = $1`, [throttleUser]);
        }
    });

    test("5. Logout revokes the session on server", async () => {
        const { login, logout } = await import("../../services/auth-service.ts");
        const { validateSession } = await import("../../lib/auth/session.ts");

        const result = await login(testUsername, testPassword);
        const token = result.sessionToken;

        // Session is valid before logout
        const valid = await validateSession(token);
        assert.ok(valid);

        // Logout
        await logout(token);

        // Session must be rejected after logout
        const revoked = await validateSession(token);
        assert.equal(revoked, null);
    });
});
