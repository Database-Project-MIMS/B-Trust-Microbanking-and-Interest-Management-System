#!/usr/bin/env node
/**
 * Minimal migration runner. No ORM, no migration framework — just ordered SQL.
 *
 *   node scripts/migrate.mjs up      apply pending migrations
 *   node scripts/migrate.mjs status  show applied / pending
 *   node scripts/migrate.mjs seed    apply database/seed/*.sql
 *
 * Uses DATABASE_MIGRATION_URL (owner role), never DATABASE_URL (app role).
 *
 * Enforces AGENTS.md §8: a migration that has already been applied is immutable.
 * If its checksum changes, this runner refuses to continue.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = "database/migrations";
const SEED_DIR = "database/seed";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch {}
}

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL is not set. Copy .env.example to .env.");
  process.exit(1);
}

const sqlFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    : [];

const checksum = (text) => createHash("sha256").update(text).digest("hex");

async function main() {
  const command = process.argv[2] ?? "status";
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    if (command === "seed") {
      for (const file of sqlFiles(SEED_DIR)) {
        process.stdout.write(`seed  ${file} ... `);
        await client.query(readFileSync(join(SEED_DIR, file), "utf8"));
        console.log("ok");
      }
      return;
    }

    const hasLedger = await client.query(
      "SELECT to_regclass('public.schema_migration') IS NOT NULL AS present",
    );
    const applied = new Map();
    if (hasLedger.rows[0].present) {
      const rows = await client.query("SELECT filename, checksum FROM schema_migration");
      for (const r of rows.rows) applied.set(r.filename, r.checksum);
    }

    const files = sqlFiles(MIGRATIONS_DIR);
    if (files.length === 0) console.warn(`No migrations found in ${MIGRATIONS_DIR}`);

    for (const file of files) {
      const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const sum = checksum(text);
      const previous = applied.get(file);

      if (previous !== undefined) {
        // 'bootstrap' is the self-recorded value from migration 0000.
        if (previous !== "bootstrap" && previous !== sum) {
          console.error(
            `\nERROR: ${file} was already applied but its contents changed.\n` +
              "A merged migration is immutable (AGENTS.md §8).\n" +
              "Add a NEW migration in your reserved block instead of editing this one.",
          );
          process.exit(1);
        }
        if (command === "status") console.log(`applied  ${file}`);
        continue;
      }

      if (command === "status") {
        console.log(`PENDING  ${file}`);
        continue;
      }

      process.stdout.write(`apply ${file} ... `);
      await client.query(text);
      await client.query(
        `INSERT INTO schema_migration (filename, checksum) VALUES ($1, $2)
         ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [file, sum],
      );
      console.log("ok");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
