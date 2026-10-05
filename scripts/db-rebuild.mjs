import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createMigrationClient } from "../lib/db/migration-client.mjs";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { /* Caller can supply the environment. */ }
}

function runScript(path) {
  const result = spawnSync(process.execPath, [path, ...(path.endsWith("migrate.mjs") ? ["up"] : [])], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`Rebuild step failed: ${path}`);
}

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is not set.");
  const target = new URL(url);
  if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname !== target.pathname) {
    throw new Error("Application and migration URLs must target the same database.");
  }
  const database = decodeURIComponent(target.pathname.slice(1));
  const client = createMigrationClient(url);
  await client.connect();
  try {
    const { rows } = await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
    if (rows[0].n > 0) {
      if (!process.argv.includes("--reset")) throw new Error("Database is not empty. Use --reset explicitly for a disposable development database.");
      if (database !== "mims_dev" && !/^mims_test_[a-z0-9_]+$/.test(database)) {
        throw new Error("--reset is restricted to mims_dev or mims_test_* databases.");
      }
      // The exact configured development database is checked before destructive DDL.
      await client.query("DROP SCHEMA public CASCADE");
      await client.query("CREATE SCHEMA public");
      await client.query("GRANT USAGE ON SCHEMA public TO mims_app");
    }
    console.log("==> 1/7 migrations");
    runScript("scripts/migrate.mjs");
    for (const [index, dir] of ["routines", "triggers", "views", "indexes", "roles"].entries()) {
      console.log(`==> ${index + 2}/7 ${dir}`);
      const path = join("database", dir);
      if (existsSync(path)) {
        for (const file of readdirSync(path).filter((name) => name.endsWith(".sql")).sort()) {
          await client.query(readFileSync(join(path, file), "utf8"));
        }
      }
    }
    console.log("==> 7/7 ordered seed data");
    runScript("scripts/seed.mjs");
    runScript("scripts/verify-setup.mjs");
    console.log("Rebuild complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.code ? `Rebuild failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
});
