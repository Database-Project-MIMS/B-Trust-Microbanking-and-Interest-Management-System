import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createMigrationClient } from "../../lib/db/migration-client.mjs";
import { deployDatabase } from "../../scripts/deploy-database.mjs";

test("Database deployment initializes runtime objects and preserves existing data without seeds", async (t) => {
  assert.equal(process.env.MIMS_ISOLATED_TEST, "1", "Use the disposable verification harness.");
  const parent = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
  await parent.connect();
  const name = `mims_test_deploy_${randomBytes(5).toString("hex")}`;
  const ownerUrl = new URL(process.env.DATABASE_MIGRATION_URL);
  ownerUrl.pathname = "/" + name;
  const env = { ...process.env, DATABASE_MIGRATION_URL: ownerUrl.href, MIMS_SEED_DEMO: "1" };
  delete env.DATABASE_URL;
  const run = (overrides = {}) => spawnSync(process.execPath, ["scripts/deploy-database.mjs"], {
    env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true, timeout: 60000,
  });
  let client;
  try {
    await parent.query(`CREATE DATABASE ${name} OWNER mims_owner`);
    client = createMigrationClient(ownerUrl.href);
    await client.connect();
    await t.test("fresh deployment installs the full schema and runtime controls without demo users", async () => {
      const result = run();
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Database deployment complete/);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0].n, 70);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM app_user")).rows[0].n, 0);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM transaction")).rows[0].n, 0);
      assert.equal((await client.query("SELECT to_regprocedure('public.fn_fd_control_actor_is_current()') IS NOT NULL AS present")).rows[0].present, true);
    });
    await t.test("repeated deployment preserves all seeded financial and audit data", async () => {
      const seeded = spawnSync(process.execPath, ["scripts/seed.mjs"], { env, encoding: "utf8", windowsHide: true, timeout: 60000 });
      assert.equal(seeded.status, 0, seeded.stdout + seeded.stderr);
      await client.query("UPDATE app_user SET username = $1 WHERE username = $2", ["deploy_preserved", "admin"]);
      const snapshot = async () => (await client.query(`
        SELECT (SELECT jsonb_agg(to_jsonb(u) ORDER BY user_id) FROM app_user u) AS users,
          (SELECT jsonb_agg(to_jsonb(a) ORDER BY account_id) FROM account a) AS accounts,
          (SELECT jsonb_agg(to_jsonb(t) ORDER BY transaction_id) FROM transaction t) AS ledger,
          (SELECT jsonb_agg(to_jsonb(p) ORDER BY interest_id) FROM interest_payout p) AS payouts,
          (SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM audit_log l) AS audit,
          (SELECT jsonb_agg(to_jsonb(m) ORDER BY filename) FROM schema_migration m) AS migrations
      `)).rows[0];
      const before = await snapshot();
      for (let i = 0; i < 2; i++) {
        const result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.deepEqual(await snapshot(), before);
      }
    });
    await t.test("missing migration URL fails even when a runtime URL is supplied", () => {
      const result = run({ DATABASE_MIGRATION_URL: "", DATABASE_URL: ownerUrl.href });
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stdout, /applied|deployment complete/);
    });
    await t.test("a runtime installation failure rolls back earlier runtime definitions", async () => {
      const fixture = mkdtempSync(join(tmpdir(), "mims-deploy-runtime-"));
      try {
        for (const directory of ["routines", "triggers", "views", "indexes", "roles"]) {
          mkdirSync(join(fixture, directory));
        }
        writeFileSync(join(fixture, "routines", "01_fixture.sql"), "CREATE FUNCTION deploy_rollback_fixture() RETURNS int LANGUAGE sql AS 'SELECT 1';");
        writeFileSync(join(fixture, "indexes", "01_failure.sql"), "SELECT 1/0;");
        await assert.rejects(deployDatabase(env, fixture), { code: "22012" });
        assert.equal((await client.query("SELECT to_regprocedure('public.deploy_rollback_fixture()') AS object")).rows[0].object, null);
        assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0].n, 70);
      } finally {
        const absolute = resolve(fixture);
        assert.ok(absolute.startsWith(resolve(tmpdir()) + sep)
          && absolute.split(/[\\/]/).pop().startsWith("mims-deploy-runtime-"));
        rmSync(absolute, { recursive: true, force: true });
      }
    });
  } finally {
    await client?.end();
    await parent.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await parent.end();
  }
});
