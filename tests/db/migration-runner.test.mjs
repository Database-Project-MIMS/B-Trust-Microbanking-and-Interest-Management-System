import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { createMigrationClient } from "../../lib/db/migration-client.mjs";

test("P01-M04-T03: rebuild, ledger integrity and atomic migration runner", async (t) => {
  assert.equal(process.env.MIMS_ISOLATED_TEST, "1", "Run npm run verify:phase1 for disposable database tests.");
  const parent = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
  await parent.connect();
  const name = `mims_test_runner_${randomBytes(5).toString("hex")}`;
  const fixture = mkdtempSync(join(tmpdir(), "mims-migrations-"));
  const url = new URL(process.env.DATABASE_MIGRATION_URL);
  url.pathname = "/" + name;
  const appUrl = new URL(process.env.DATABASE_URL);
  appUrl.pathname = "/" + name;
  const env = { ...process.env, DATABASE_MIGRATION_URL: url.href, DATABASE_URL: appUrl.href };
  const run = (script, args = [], overrides = {}) => spawnSync(process.execPath, [script, ...args], {
    env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true,
  });
  let client;
  try {
    // Identifier comes from the fixed prefix and hex-only generator.
    await parent.query(`CREATE DATABASE ${name}`);
    client = createMigrationClient(url.href);
    await client.connect();
    await t.test("rebuild from empty applies every migration and ordered seeds", async () => {
      const result = run("scripts/db-rebuild.mjs");
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /All checks passed/);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM agent WHERE employee_no LIKE 'EMP%'")).rows[0].n, 6);
    });
    await t.test("rebuild refuses a populated database without an explicit reset", () => {
      const result = run("scripts/db-rebuild.mjs");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not empty/);
    });
    // Recreate ONLY this generated disposable test database's schema for fixtures.
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    copyFileSync("database/migrations/0000_p00_shared_foundation.sql", join(fixture, "0000_p00_shared_foundation.sql"));
    writeFileSync(join(fixture, "0001_fixture.sql"), "BEGIN;\nCREATE TABLE runner_fixture (id int PRIMARY KEY);\nCOMMIT;\n");
    env.MIMS_MIGRATIONS_DIR = fixture;
    await t.test("rerunning migrations preserves exactly one ledger row per file", async () => {
      for (let i = 0; i < 2; i++) assert.equal(run("scripts/migrate.mjs", ["up"]).status, 0);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0].n, 2);
    });
    await t.test("editing a copied applied file is rejected by up AND db:verify", () => {
      const file = join(fixture, "0001_fixture.sql");
      const original = readFileSync(file, "utf8");
      try {
        writeFileSync(file, original + "\n-- tampered\n");
        for (const [script, args] of [["scripts/migrate.mjs", ["up"]], ["scripts/verify-setup.mjs", []]]) {
          const result = run(script, args);
          assert.notEqual(result.status, 0);
          assert.match(result.stdout + result.stderr, /immutable/);
        }
      } finally { writeFileSync(file, original); }
    });
    await t.test("verification catches pending migrations and missing disk files", () => {
      const file = join(fixture, "0002_pending.sql");
      writeFileSync(file, "BEGIN;\nCREATE TABLE pending_fixture (id int);\nCOMMIT;\n");
      try {
        const result = run("scripts/verify-setup.mjs");
        assert.notEqual(result.status, 0);
        assert.match(result.stdout, /0002_pending/);
      } finally { rmSync(file); }
      const appliedFile = join(fixture, "0001_fixture.sql");
      const original = readFileSync(appliedFile, "utf8");
      rmSync(appliedFile);
      try {
        assert.notEqual(run("scripts/verify-setup.mjs").status, 0);
        assert.notEqual(run("scripts/migrate.mjs", ["up"]).status, 0);
      } finally { writeFileSync(appliedFile, original); }
    });
    await t.test("a failed migration rolls back its DDL and ledger entry", async () => {
      const file = join(fixture, "0002_failure.sql");
      writeFileSync(file, "BEGIN;\nCREATE TABLE must_rollback (id int);\nSELECT 1/0;\nCOMMIT;\n");
      try {
        assert.notEqual(run("scripts/migrate.mjs", ["up"]).status, 0);
        assert.equal((await client.query("SELECT to_regclass('public.must_rollback') AS object")).rows[0].object, null);
        assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0].n, 2);
      } finally { rmSync(file); }
    });
    await t.test("ledger verification passes after fixtures are restored", () => {
      const result = run("scripts/migrate.mjs", ["verify"]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /verify ok/);
    });
  } finally {
    await client?.end();
    await parent.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await parent.end();
    const absolute = resolve(fixture);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep) && absolute.split(/[\\/]/).pop().startsWith("mims-migrations-"));
    rmSync(absolute, { recursive: true, force: true });
  }
});
