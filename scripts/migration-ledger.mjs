import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function migrationFiles(directory) {
  return existsSync(directory)
    ? readdirSync(directory).filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort()
    : [];
}

export function migrationChecksum(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function checksumMatches(recorded, text) {
  return [text, text.replace(/\r\n/g, "\n"), text.replace(/\r?\n/g, "\r\n")]
    .some((variant) => migrationChecksum(variant) === recorded);
}

/** Checks both directions, including changed content, without applying anything. */
export async function verifyMigrationLedger(client, directory) {
  const files = migrationFiles(directory);
  const { rows } = await client.query("SELECT filename, checksum FROM schema_migration ORDER BY filename");
  const applied = new Map(rows.map((row) => [row.filename, row.checksum]));
  const missing = files.filter((file) => !applied.has(file));
  const unknown = rows.filter((row) => !files.includes(row.filename));
  if (missing.length || unknown.length) {
    throw new Error(`Migration ledger mismatch. Pending: ${missing.join(", ") || "none"}; missing files: ${unknown.map((row) => row.filename).join(", ") || "none"}.`);
  }
  for (const file of files) {
    if (!checksumMatches(applied.get(file), readFileSync(join(directory, file), "utf8"))) {
      throw new Error(`${file} was already applied but its contents changed. A merged migration is immutable.`);
    }
  }
  return files.length;
}
