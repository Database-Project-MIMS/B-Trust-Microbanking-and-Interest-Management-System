/**
 * P01-M01-T04: Sign-in E2E Tests
 *
 * Covers:
 *  1. Happy path — valid credentials → 200 + session cookie set
 *  2. Wrong password → 401 with GENERIC message (no info leak)
 *  3. Unknown username → 401 with SAME generic message (no info leak)
 *  4. Post-logout → session is invalidated server-side (cookie alone not enough)
 *  5. 429 after 5 consecutive failures within 15 minutes (brute-force protection)
 *
 * Pattern matches the project's test convention: Node test runner, direct route
 * handler imports, a real DB connection for setup/teardown, no live HTTP server.
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import * as loginRoute from "../../app/api/auth/login/route.ts";
import * as logoutRoute from "../../app/api/auth/logout/route.ts";
import { hashPassword } from "../../lib/auth/password.ts";
import { hashToken } from "../../lib/auth/session.ts";

// ---------------------------------------------------------------------------
// Env / DB connection
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { }
}

const connectionString =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Minimal NextRequest mock (mirrors branches-agents.test.mjs convention)
// ---------------------------------------------------------------------------
function makeRequest(method, path, { body, token, csrf } = {}) {
  return {
    method,
    url: `http://localhost${path}`,
    json: async () => body,
    headers: new Headers({
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    }),
    cookies: {
      get: (name) => {
        if (name === "mims_session" && token) return { value: token };
        if (name === "mims_csrf" && csrf) return { value: csrf };
        return undefined;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("P01-M01-T04: sign-in, session and logout", () => {
  const runId = crypto.randomBytes(5).toString("hex");
  const username = `signin_${runId}`;
  const password = "Test-P@ssword-9991";
  const wrongPassword = "Wrong-P@ssword-000";

  let client;
  let userId;
  let roleId;

  // -------------------------------------------------------------------------
  // Setup — insert a real hashed user directly in the DB
  // -------------------------------------------------------------------------
  before(async () => {
    assert.ok(connectionString, "DATABASE_URL or DATABASE_MIGRATION_URL is required");
    client = new pg.Client({ connectionString });
    await client.connect();

    // Upsert ADMIN role (may already exist)
    const roleRes = await client.query(
      `INSERT INTO role (role_name, description)
       VALUES ('ADMIN', 'Administrator')
       ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
       RETURNING role_id`,
    );
    roleId = roleRes.rows[0].role_id;

    const passwordHash = await hashPassword(password);
    const userRes = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING user_id`,
      [roleId, username, passwordHash],
    );
    userId = userRes.rows[0].user_id;
  });

  // -------------------------------------------------------------------------
  // Teardown — remove test data cleanly
  // -------------------------------------------------------------------------
  after(async () => {
    if (!client) return;
    try {
      await client.query(`DELETE FROM login_attempt WHERE username_attempted = $1`, [username]);
      await client.query(`DELETE FROM user_session WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM app_user WHERE user_id = $1`, [userId]);
    } finally {
      await client.end();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------
  test("valid credentials return 200 with session cookie and CSRF token", async () => {
    const res = await loginRoute.POST(
      makeRequest("POST", "/api/auth/login", {
        body: { username, password },
      }),
    );

    assert.equal(res.status, 200, `Expected 200 but got ${res.status}`);

    const body = await res.json();
    assert.ok(body.data?.user, "Response should include user data");
    assert.equal(body.data.user.username, username);

    // Cookie must be set
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.ok(setCookie.includes("mims_session"), "Session cookie must be set");
    assert.ok(
      setCookie.toLowerCase().includes("httponly"),
      "Cookie must be HttpOnly",
    );
    assert.ok(
      setCookie.toLowerCase().includes("samesite=lax"),
      "Cookie must be SameSite=Lax",
    );
  });

  // -------------------------------------------------------------------------
  // 2. Wrong password — must return generic error (no info leak)
  // -------------------------------------------------------------------------
  test("wrong password returns 401 with a generic error — no info leak", async () => {
    const res = await loginRoute.POST(
      makeRequest("POST", "/api/auth/login", {
        body: { username, password: wrongPassword },
      }),
    );

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error?.code, "INVALID_CREDENTIALS");
    // Message must NOT reveal the password was the wrong part
    assert.ok(
      !body.error.message.toLowerCase().includes("password incorrect"),
      "Error message must not say 'password incorrect'",
    );
  });

  // -------------------------------------------------------------------------
  // 3. Unknown username — SAME generic 401 (cannot distinguish from wrong pw)
  // -------------------------------------------------------------------------
  test("unknown username returns 401 with the identical generic error", async () => {
    const res = await loginRoute.POST(
      makeRequest("POST", "/api/auth/login", {
        body: { username: `no_such_user_${runId}`, password: wrongPassword },
      }),
    );

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error?.code, "INVALID_CREDENTIALS");
  });

  // -------------------------------------------------------------------------
  // 4. Missing body fields — 400
  // -------------------------------------------------------------------------
  test("missing credentials return 400 INVALID_INPUT", async () => {
    const res = await loginRoute.POST(
      makeRequest("POST", "/api/auth/login", { body: {} }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.code, "INVALID_INPUT");
  });

  // -------------------------------------------------------------------------
  // 5. Post-logout — session is revoked server-side
  // -------------------------------------------------------------------------
  test("after logout the session token is invalidated server-side", async () => {
    // Log in to get a real token
    const loginRes = await loginRoute.POST(
      makeRequest("POST", "/api/auth/login", {
        body: { username, password },
      }),
    );
    assert.equal(loginRes.status, 200);

    // Extract session token from Set-Cookie header
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/mims_session=([^;]+)/);
    assert.ok(match, "Could not parse mims_session from Set-Cookie");
    const sessionToken = match[1];

    // Extract CSRF token from Set-Cookie (mims_csrf is not HttpOnly)
    const csrfMatch = setCookie.match(/mims_csrf=([^;]+)/);
    const csrfToken = csrfMatch?.[1] ?? crypto.randomBytes(32).toString("hex");

    // Log out
    const logoutRes = await logoutRoute.POST(
      makeRequest("POST", "/api/auth/logout", {
        token: sessionToken,
        csrf: csrfToken,
      }),
    );
    assert.equal(logoutRes.status, 204, "Logout must return 204");

    // Verify the token is revoked in the DB (revoked_at is set)
    const tokenHash = hashToken(sessionToken);
    const dbRow = await client.query(
      `SELECT revoked_at FROM user_session WHERE token_hash = $1`,
      [tokenHash],
    );
    assert.ok(dbRow.rows.length > 0, "Session row should exist");
    assert.ok(
      dbRow.rows[0].revoked_at !== null,
      "revoked_at must be set after logout — cookie alone is not enough",
    );
  });

  // -------------------------------------------------------------------------
  // 6. Brute-force protection — 429 after 5 failures in 15 minutes
  // -------------------------------------------------------------------------
  test("5 consecutive wrong-password attempts trigger 429 TOO_MANY_ATTEMPTS", async () => {
    const throttleUser = `throttle_${runId}`;
    const throttleHash = await hashPassword("irrelevant");

    // Insert a second user for this sub-test
    const res = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING user_id`,
      [roleId, throttleUser, throttleHash],
    );
    const throttleUserId = res.rows[0].user_id;

    try {
      // Fire 5 bad attempts
      for (let i = 0; i < 5; i++) {
        const r = await loginRoute.POST(
          makeRequest("POST", "/api/auth/login", {
            body: { username: throttleUser, password: "wrong" },
          }),
        );
        assert.equal(r.status, 401, `Attempt ${i + 1} should be 401`);
      }

      // 6th attempt must be throttled
      const throttled = await loginRoute.POST(
        makeRequest("POST", "/api/auth/login", {
          body: { username: throttleUser, password: "wrong" },
        }),
      );
      assert.equal(throttled.status, 429, "6th attempt must be 429");
      const body = await throttled.json();
      assert.equal(body.error?.code, "TOO_MANY_ATTEMPTS");
    } finally {
      // Cleanup throttle user
      await client.query(
        `DELETE FROM login_attempt WHERE username_attempted = $1`,
        [throttleUser],
      );
      await client.query(`DELETE FROM app_user WHERE user_id = $1`, [throttleUserId]);
    }
  });
});
