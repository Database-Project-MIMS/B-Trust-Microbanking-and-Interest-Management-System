import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createMigrationClient } from "../lib/db/migration-client.mjs";

function runScript(path, args = []) {
  const result = spawnSync(process.execPath, [path, ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`Database setup step failed: ${path}`);
}

async function main() {
  if (!process.env.DATABASE_MIGRATION_URL) throw new Error("DATABASE_MIGRATION_URL is required for setup.");
  runScript("scripts/migrate.mjs", ["up"]);
  const client = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
  await client.connect();
  try {
    // The same ordered, idempotent stages as db:rebuild; never DROP/reset data.
    for (const directory of ["routines", "triggers", "views", "indexes", "roles"]) {
      for (const file of readdirSync(join("database", directory)).filter(name => name.endsWith(".sql")).sort()) {
        await client.query(readFileSync(join("database", directory, file), "utf8"));
      }
    }
    const { rows } = await client.query("SELECT EXISTS (SELECT 1 FROM app_user) AS initialized");
    if (process.env.MIMS_SEED_DEMO === "1" && !rows[0].initialized) {
      runScript("scripts/seed.mjs");
    } else {
      console.log("Existing data preserved; demo seed not applied.");
    }
  } finally {
    await client.end();
  }
  runScript("scripts/verify-setup.mjs");
  console.log("Docker database setup complete.");
}

main().catch(error => {
  console.error(error.code ? `Docker database setup failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
});
