#!/usr/bin/env node
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
  console.error("DATABASE_MIGRATION_URL is not set.");
  process.exit(1);
}

const sqlFiles = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];
const checksum = (text) => createHash("sha256").update(text).digest("hex");

async function main() {
  const command = process.argv[2] ?? "status";
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    if (command === "verify") {
      const dbRows = await client.query("SELECT filename FROM schema_migration ORDER BY filename");
      const dbFiles = dbRows.rows.map(r => r.filename);
      const diskFiles = sqlFiles(MIGRATIONS_DIR);
      if (dbFiles.length !== diskFiles.length) throw new Error(`Verify failed: ${dbFiles.length} DB vs ${diskFiles.length} disk.`);
      for (let i = 0; i < diskFiles.length; i++) {
        if (dbFiles[i] !== diskFiles[i]) throw new Error(`Verify failed: Mismatch at ${diskFiles[i]}`);
      }
      console.log("verify ok");
      return;
    }

    if (command === "seed") {
      for (const file of sqlFiles(SEED_DIR)) {
        await client.query(readFileSync(join(SEED_DIR, file), "utf8"));
      }
      return;
    }

    const hasLedger = await client.query("SELECT to_regclass('public.schema_migration') IS NOT NULL AS present");
    const applied = new Map();
    if (hasLedger.rows[0].present) {
      const rows = await client.query("SELECT filename, checksum FROM schema_migration");
      for (const r of rows.rows) applied.set(r.filename, r.checksum);
    }

    const files = sqlFiles(MIGRATIONS_DIR);
    for (const file of files) {
      const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const sum = checksum(text);
      const previous = applied.get(file);

      if (previous !== undefined) {
        const lfSum = checksum(text.replace(/\r\n/g, "\n"));
        const crlfSum = checksum(text.replace(/\r?\n/g, "\r\n"));
        if (previous !== "bootstrap" && previous !== sum && previous !== lfSum && previous !== crlfSum) {
          console.error(`\nERROR: ${file} was already applied but its contents changed.\nA merged migration is immutable.`);
          process.exit(1);
        }
        if (command === "status") console.log(`applied  ${file}`);
        continue;
      }

      if (command === "status") {
        console.log(`PENDING  ${file}`);
        continue;
      }

      await client.query(text);
      await client.query(
        `INSERT INTO schema_migration (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [file, sum]
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});