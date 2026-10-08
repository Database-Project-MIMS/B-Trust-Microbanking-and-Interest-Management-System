import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../app/api/health/route.ts";
import { sessionFixture } from "../helpers/session-fixture.mjs";
import { pool } from "../../lib/db/index.ts";

describe("P01-M04-T04: authenticated health contract", () => {
  let admin, auditor;
  before(async () => { admin = await sessionFixture(); auditor = await sessionFixture("AUDITOR"); });
  after(async () => { await admin?.cleanup(); await auditor?.cleanup(); });

  test("missing or forged legacy cookie yields 401 and no internals", async () => {
    for (const options of [{ authenticated: false }, { legacyCookie: true }]) {
      const response = await GET(admin.request("/api/health", options));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }
  });
  test("privileged valid session receives real pool and migration details", async () => {
    const response = await GET(admin.request("/api/health"));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.status, "ok");
    assert.equal(data.db.connected, true);
    assert.equal(typeof data.db.poolTotal, "number");
    const count = await admin.client.query("SELECT count(*)::int AS n FROM schema_migration");
    assert.equal(data.migrationsApplied, count.rows[0].n);
    assert.match(data.lastMigration, /^\d{4}_/);
  });
  test("non-privileged valid session receives status only", async () => {
    const response = await GET(auditor.request("/api/health"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { status: "ok" } });
  });
  test("expired and revoked sessions are rejected", async () => {
    for (const assignment of ["expires_at = now() - interval '1 second'", "revoked_at = now()"]) {
      await auditor.client.query(`UPDATE user_session SET ${assignment} WHERE user_id = $1`, [auditor.userId]);
      assert.equal((await GET(auditor.request("/api/health"))).status, 401);
    }
  });
  test("database errors yield a safe 503 envelope", async () => {
    const original = pool.query;
    pool.query = async () => { throw { code: "XX000", message: "SELECT secret_password FROM private_table" }; };
    try {
      const response = await GET(admin.request("/api/health"));
      assert.equal(response.status, 503);
      const text = await response.text();
      assert.ok(!text.includes("secret_password") && !text.includes("SELECT"));
      assert.equal(JSON.parse(text).error.code, "SERVICE_UNAVAILABLE");
    } finally { pool.query = original; }
  });
});
