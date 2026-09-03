#!/usr/bin/env node
/**
 * Verify the local setup. Run after `npm run db:rebuild`.
 * Checks the things that silently break a Database Systems project.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });

const client = new pg.Client({ connectionString: url });
await client.connect();

const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];

const v = await one("SHOW server_version");
check("PostgreSQL 15+", parseInt(v.server_version, 10) >= 15, `found ${v.server_version}`);

const mig = await one(
  "SELECT to_regclass('public.schema_migration') IS NOT NULL AS present",
);
check("schema_migration exists", mig.present);

if (mig.present) {
  const n = await one("SELECT count(*)::int AS n FROM schema_migration");
  check("migrations applied", n.n > 0, `${n.n} applied`);
}

const dom = await one(
  `SELECT count(*)::int AS n FROM pg_type
   WHERE typname IN ('money_amount','positive_money','interest_rate','record_status')`,
);
check("shared domains present", dom.n === 4, `${dom.n}/4`);

const fl = await one(
  `SELECT count(*)::int AS n
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type IN ('real','double precision')
     AND (column_name LIKE '%amount%' OR column_name LIKE '%balance%'
          OR column_name LIKE '%rate%' OR column_name LIKE '%principal%')`,
);
check("no floating-point money columns", fl.n === 0, `${fl.n} offending column(s)`);

const nopk = await one(
  `SELECT count(*)::int AS n FROM information_schema.tables t
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints c
       WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
         AND c.constraint_type = 'PRIMARY KEY')`,
);
check("every table has a primary key", nopk.n === 0, `${nopk.n} without PK`);

await client.end();

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
}
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
