import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_MIGRATION_URL) throw new Error("DATABASE_MIGRATION_URL is required.");
const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(readFileSync(new URL("../database/roles/01_app_grants.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Application grants applied successfully.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Could not apply grants. Apply pending migrations first.", error.code ?? "UNKNOWN");
  process.exitCode = 1;
} finally {
  await client.end();
}
