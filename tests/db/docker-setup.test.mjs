import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createMigrationClient } from "../../lib/db/migration-client.mjs";

test("Docker setup initializes and preserves an existing database", async (t) => {
  assert.equal(process.env.MIMS_ISOLATED_TEST, "1", "Use the disposable verification harness.");
  const parent = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
  await parent.connect();
  const name = `mims_test_docker_${randomBytes(5).toString("hex")}`;
  const ownerUrl = new URL(process.env.DATABASE_MIGRATION_URL);
  ownerUrl.pathname = "/" + name;
  const env = { ...process.env, DATABASE_MIGRATION_URL: ownerUrl.href, MIMS_SEED_DEMO: "1" };
  delete env.DATABASE_URL;
  const run = (overrides = {}) => spawnSync(process.execPath, ["scripts/docker-setup.mjs"], {
    env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true, timeout: 60000,
  });
  let client;
  try {
    // Identifier is generated exclusively from a fixed prefix and random hex.
    await parent.query(`CREATE DATABASE ${name} OWNER mims_owner`);
    client = createMigrationClient(ownerUrl.href);
    await client.connect();
    await t.test("empty database gets every migration, runtime object and demo data", async () => {
      const result = run();
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Docker database setup complete/);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0].n, 70);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM fixed_deposit")).rows[0].n, 12);
    });
    await t.test("rerun preserves modified user data and every financial row", async () => {
      await client.query("UPDATE app_user SET username = $1 WHERE username = $2", ["docker_preserved", "admin"]);
      const snapshot = async () => (await client.query(`
        SELECT (SELECT jsonb_agg(to_jsonb(u) ORDER BY user_id) FROM app_user u) AS users,
          (SELECT jsonb_agg(to_jsonb(a) ORDER BY account_id) FROM account a) AS accounts,
          (SELECT jsonb_agg(to_jsonb(t) ORDER BY transaction_id) FROM transaction t) AS ledger,
          (SELECT jsonb_agg(to_jsonb(p) ORDER BY interest_id) FROM interest_payout p) AS payouts,
          (SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM audit_log l) AS audit
      `)).rows[0];
      const before = await snapshot();
      const result = run();
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Existing data preserved/);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("missing owner connection fails before any setup", () => {
      const result = run({ DATABASE_MIGRATION_URL: "" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DATABASE_MIGRATION_URL is required/);
    });
  } finally {
    await client?.end();
    await parent.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await parent.end();
  }
});
