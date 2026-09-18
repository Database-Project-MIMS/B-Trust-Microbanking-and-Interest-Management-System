import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch {}
}

// Try to find psql, fallback to default Windows install path if missing from PATH
let PSQL_CMD = 'psql';
try {
  execSync('psql --version', { stdio: 'ignore' });
} catch (e) {
  const fallbackPaths = [
    'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe'
  ];
  for (const path of fallbackPaths) {
    if (existsSync(path)) {
      PSQL_CMD = `"${path}"`;
      break;
    }
  }
}

const DB_NAME = process.argv[2] || 'mims_dev';
const PSQL_ADMIN = process.env.PSQL_ADMIN || 'postgres';

function runCmd(cmd) {
  const finalCmd = cmd.startsWith('psql ') ? cmd.replace('psql ', `${PSQL_CMD} `) : cmd;
  try {
    execSync(finalCmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n[ERROR] Command failed: ${finalCmd}\nEnsure your PostgreSQL password is correct and psql is in your PATH.`);
    process.exit(1);
  }
}

console.log(`==> Dropping and recreating database '${DB_NAME}'`);
runCmd(`psql -v ON_ERROR_STOP=1 -U ${PSQL_ADMIN} -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" -c "CREATE DATABASE ${DB_NAME};"`);

console.log("==> 1/7 migrations");
runCmd("node --env-file=.env scripts/migrate.mjs up");

function applyDir(dir, label) {
  console.log(`==> ${label}`);
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    if (files.length > 0) {
      for (const f of files) {
        console.log(`    ${f}`);
        runCmd(`psql -v ON_ERROR_STOP=1 -U ${PSQL_ADMIN} -d ${DB_NAME} -f "${join(dir, f)}" -q`);
      }
      return;
    }
  }
  console.log("    (none yet)");
}

applyDir("database/routines", "2/7 routines");
applyDir("database/triggers", "3/7 triggers");
applyDir("database/views", "4/7 views");
applyDir("database/indexes", "5/7 indexes");
applyDir("database/roles", "6/7 roles and RLS");
applyDir("database/seed", "7/7 seed data");

console.log("==> Rebuild complete. Verifying:");
runCmd("node --env-file=.env scripts/verify-setup.mjs");
