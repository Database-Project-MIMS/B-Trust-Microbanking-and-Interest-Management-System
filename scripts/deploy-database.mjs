import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createMigrationClient } from "../lib/db/migration-client.mjs";

function runScript(path, args, env) {
  const result = spawnSync(process.execPath, [path, ...args], { stdio: "inherit", env, windowsHide: true });
  if (result.status !== 0) throw new Error("Database deployment step failed; inspect the preceding safe diagnostic.");
}

/** Apply atomic numbered migrations, then install runtime SQL in one transaction; never reset or seed data. */
export async function deployDatabase(env = process.env, runtimeDirectory = "database") {
  if (!env.DATABASE_MIGRATION_URL) throw new Error("DATABASE_MIGRATION_URL is required for deployment.");
  runScript("scripts/migrate.mjs", ["up"], env);
  const client = createMigrationClient(env.DATABASE_MIGRATION_URL);
  try {
    await client.connect();
    await client.query("BEGIN");
    try {
      for (const directory of ["routines", "triggers", "views", "indexes", "roles"]) {
        const path = join(runtimeDirectory, directory);
        for (const file of readdirSync(path).filter(name => name.endsWith(".sql")).sort()) {
          await client.query(readFileSync(join(path, file), "utf8"));
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally { await client.end(); }
  runScript("scripts/verify-setup.mjs", [], env);
  console.log("Database deployment complete. Existing data preserved; no seed applied.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deployDatabase().catch(error => {
    console.error(error.code ? `Database deployment failed (SQLSTATE ${error.code}).` : "Database deployment failed. Check connection configuration and migration diagnostics.");
    process.exitCode = 1;
  });
}
