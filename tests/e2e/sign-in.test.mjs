import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { POST as signIn } from "../../app/api/auth/login/route.ts";
import { POST as signOut } from "../../app/api/auth/logout/route.ts";
import { GET as health } from "../../app/api/health/route.ts";
import { NextRequest } from "next/server";
import { sessionFixture } from "../helpers/session-fixture.mjs";
import { createSession, validateSession, hashToken } from "../../lib/auth/session.ts";

describe("P01-M01-T04: sign-in, authenticated navigation and sign-out workflow", () => {
  let fixture, username;
  const password = "SyntheticCloseout!123";
  before(async () => {
    fixture = await sessionFixture();
    const { rows } = await fixture.client.query("UPDATE app_user SET password_hash = $1 WHERE user_id = $2 RETURNING username",
      [await argon2.hash(password, { type: argon2.argon2id }), fixture.userId]);
    username = rows[0].username;
  });
  after(async () => fixture?.cleanup());
  test("login rejects cross-origin requests, non-JSON forms and malformed JSON", async () => {
    for (const [headers, body, expected] of [
      [{ "Content-Type": "application/json", origin: "https://untrusted.example" }, JSON.stringify({ username, password }), 403],
      [{ "Content-Type": "text/plain" }, JSON.stringify({ username, password }), 400],
      [{ "Content-Type": "application/json" }, "{invalid", 400],
    ]) {
      const response = await signIn(new NextRequest("http://localhost/api/auth/login", { method: "POST", headers, body }));
      assert.equal(response.status, expected);
      assert.equal(response.cookies.get("mims_session"), undefined);
    }
  });

  test("login sets secure session/CSRF cookies, authorized request works, logout invalidates it", async () => {
    const originalEnvironment = process.env.NODE_ENV;
    let response;
    try {
      process.env.NODE_ENV = "production";
      response = await signIn(new NextRequest("http://localhost/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
      }));
    } finally {
      if (originalEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnvironment;
    }
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.user.role, "ADMIN");
    assert.equal(data.user.branchId, null);
    assert.equal(data.user.password_hash, undefined);
    const cookie = response.cookies.get("mims_session");
    const csrf = response.cookies.get("mims_csrf");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "lax");
    assert.ok(cookie.expires.getTime() > Date.now() + 7 * 60 * 60 * 1000,
      "Browser cookie must allow active sessions to reach the server's absolute timeout");
    const authenticated = path => new NextRequest(`http://localhost${path}`, {
      method: path.endsWith("logout") ? "POST" : "GET",
      headers: { cookie: `mims_session=${cookie.value}; mims_csrf=${csrf.value}`, "x-csrf-token": csrf.value },
    });
    assert.equal((await health(authenticated("/api/health"))).status, 200);
    assert.equal((await signOut(authenticated("/api/auth/logout"))).status, 204);
    assert.equal(await validateSession(cookie.value), null);
    assert.equal((await health(authenticated("/api/health"))).status, 401);
  });

  test("active requests refresh inactivity expiry, absolute expiry remains enforced", async () => {
    await fixture.client.query("UPDATE user_session SET expires_at = now() + interval '1 minute' WHERE user_id = $1 AND revoked_at IS NULL", [fixture.userId]);
    assert.ok(await validateSession(fixture.token));
    const { rows } = await fixture.client.query("SELECT expires_at > now() + interval '19 minutes' AS refreshed FROM user_session WHERE token_hash = $1", [hashToken(fixture.token)]);
    assert.equal(rows[0].refreshed, true);
    await fixture.client.query("UPDATE user_session SET created_at = now() - interval '9 hours' WHERE user_id = $1 AND revoked_at IS NULL", [fixture.userId]);
    assert.equal(await validateSession(fixture.token), null);
  });
  test("session creation follows configured timeout and rolls back with the caller", async () => {
    let token;
    await fixture.client.query("BEGIN");
    try {
      await fixture.client.query("UPDATE system_parameter SET param_value = '5' WHERE param_key = 'SESSION_IDLE_TIMEOUT_MINUTES'");
      const session = await createSession(fixture.userId, undefined, undefined, fixture.client);
      token = session.token;
      assert.ok(session.expiresAt.getTime() > Date.now() + 4 * 60 * 1000);
      assert.ok(session.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000);
    } finally { await fixture.client.query("ROLLBACK"); }
    assert.equal((await fixture.client.query("SELECT count(*)::int AS n FROM user_session WHERE token_hash = $1", [hashToken(token)])).rows[0].n, 0);
  });
});
