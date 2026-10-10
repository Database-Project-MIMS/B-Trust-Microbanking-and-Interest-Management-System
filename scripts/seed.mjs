import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createMigrationClient } from '../lib/db/migration-client.mjs';

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch {}
}

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL is not set.");
  process.exit(1);
}

const SEED_DIR = join(import.meta.dirname, '..', 'database', 'seed');
const loadOrder = readFileSync(join(SEED_DIR, '_load-order.txt'), 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

async function seed() {
  // Missing ordered stages fail before any database write.
  for (const file of loadOrder) {
    if (!existsSync(join(SEED_DIR, file))) throw new Error(`Required seed file is missing: ${file}`);
  }
  const client = createMigrationClient(url);
  await client.connect();

  try {
    await client.query('BEGIN');
    for (const file of loadOrder) {
      const filePath = join(SEED_DIR, file);
      const sql = readFileSync(filePath, 'utf8');
      console.log(`Seeding: ${file}`);
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.code ? `Seed failed (SQLSTATE ${err.code}).` : 'Seed failed.');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seed().catch(error => {
  console.error(error.code ? `Seed failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
});
