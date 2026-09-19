import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

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
  .filter(line => line.trim() && !line.startsWith('#'));

async function seed() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('BEGIN');
    for (const file of loadOrder) {
      const sql = readFileSync(join(SEED_DIR, file), 'utf8');
      console.log(`Seeding: ${file}`);
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
