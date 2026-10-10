#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMigrationClient } from "../lib/db/migration-client.mjs";
import { checksumMatches, migrationChecksum, migrationFiles, verifyMigrationLedger } from "./migration-ledger.mjs";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { /* Environment may be supplied by the caller. */ }
}

const command = process.argv[2] ?? "status";
const directory = process.env.MIMS_MIGRATIONS_DIR ?? "database/migrations";
const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

async function main() {
  if (!url) throw new Error("DATABASE_MIGRATION_URL is not set.");
  if (!["up", "status", "verify"].includes(command)) throw new Error("Use up, status or verify.");
  const client = createMigrationClient(url);
  await client.connect();
  try {
    if (command === "verify") {
      const count = await verifyMigrationLedger(client, directory);
      console.log(`verify ok: ${count} migrations, filenames and checksums match`);
      return;
    }
    const { rows: present } = await client.query("SELECT to_regclass('public.schema_migration') IS NOT NULL AS present");
    const applied = new Map();
    if (present[0].present) {
      const { rows } = await client.query("SELECT filename, checksum FROM schema_migration");
      for (const row of rows) applied.set(row.filename, row.checksum);
    }
    const files = migrationFiles(directory);
    for (const file of applied.keys()) {
      if (!files.includes(file)) throw new Error(`Applied migration is missing from disk: ${file}`);
    }
    // Validate ALL applied files before allowing any new migration to run.
    for (const file of files) {
      if (applied.has(file) && !checksumMatches(applied.get(file), readFileSync(join(directory, file), "utf8"))) {
        throw new Error(`${file} was already applied but its contents changed. A merged migration is immutable.`);
      }
    }
    for (const file of files) {
      if (applied.has(file)) {
        if (command === "status") console.log(`applied  ${file}`);
        continue;
      }
      if (command === "status") {
        console.log(`PENDING  ${file}`);
        continue;
      }
      const text = readFileSync(join(directory, file), "utf8");
      // DDL and its ledger entry share a boundary without editing merged SQL.
      const body = text.replace(/(^|\n)[ \t]*BEGIN;[ \t]*\r?\n/, "$1")
        .replace(/(^|\n)[ \t]*COMMIT;\s*$/, "$1");
      await client.query("BEGIN");
      try {
        await client.query(body);
        await client.query("INSERT INTO schema_migration (filename, checksum) VALUES ($1, $2)", [file, migrationChecksum(text)]);
        await client.query("COMMIT");
        console.log(`applied  ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        if (process.env.MIMS_ISOLATED_TEST === "1") console.error(`Disposable migration ${file}: ${error.message}`);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.code ? `Migration failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
});
