import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createMigrationClient } from '../lib/db/migration-client.mjs';
import { collectSeedMetrics, evaluateSeedMetrics } from './seed-validation.mjs';

const args = process.argv.slice(2);
if (args.some(arg => !['--global', '--all-tests'].includes(arg))) {
  throw new Error('Usage: node scripts/verify-seed-validation.mjs [--global] [--all-tests]');
}
// No configured development URL is ever used by this harness.
const workspace = mkdtempSync(join(tmpdir(), 'mims-seed-validation-'));
const data = join(workspace, 'pgdata');
const passwordFile = join(workspace, 'init-password');
const password = randomBytes(24).toString('hex');
const pgBin = process.env.PG_BIN ?? (process.platform === 'win32' ? ['18', '17', '16', '15']
  .map(version => `C:/Program Files/PostgreSQL/${version}/bin`)
  .find(path => existsSync(join(path, 'initdb.exe'))) : undefined);
let started = false;
function binary(name) {
  return pgBin ? join(pgBin, process.platform === 'win32' ? `${name}.exe` : name) : name;
}
function run(executable, commandArgs, env, quiet = false, allowFailure = false) {
  const control = /^pg_ctl(?:\.exe)?$/.test(basename(executable));
  const result = spawnSync(executable, commandArgs, {
    env, encoding: 'utf8', windowsHide: true,
    stdio: control ? 'ignore' : quiet ? 'pipe' : 'inherit', timeout: control ? 30000 : undefined,
  });
  if (result.error || result.signal || result.status === null) {
    throw new Error(`${basename(executable)} could not complete.`);
  }
  if (result.status !== 0 && !allowFailure) {
    const diagnostic = quiet ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      .split(password).join('[REDACTED]').trim() : '';
    throw new Error(`${basename(executable)} verification failed (exit ${result.status}). ${diagnostic}`);
  }
  return result.status;
}
async function snapshot(env) {
  const client = createMigrationClient(env.DATABASE_MIGRATION_URL);
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const metrics = await collectSeedMetrics(client);
    const { rows } = await client.query(`SELECT
      (SELECT count(*)::text FROM public.account) AS accounts,
      (SELECT coalesce(sum(current_balance), 0)::text FROM public.account) AS balance_total,
      (SELECT coalesce(sum(amount), 0)::text FROM public.transaction) AS transaction_amount_total,
      (SELECT count(*)::text FROM public.customer_agent) AS assignments,
      (SELECT count(*)::text FROM public.account_holder) AS holders,
      (SELECT count(*)::text FROM public.interest_payout) AS payouts`);
    await client.query('COMMIT');
    return { ...metrics, ...rows[0] };
  } finally { await client.end(); }
}

try {
  const port = await new Promise((accept, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => accept(address.port));
    });
  });
  // Existing service/concurrency fixtures explicitly allow this database name.
  const connection = (role, database = 'mims_test_closeout') =>
    `postgresql://${role}:${password}@127.0.0.1:${port}/${database}`;
  const env = { ...process.env, DATABASE_URL: connection('mims_app'),
    DATABASE_MIGRATION_URL: connection('mims_owner'), MIMS_ISOLATED_TEST: '1', PGPOOL_IDLE_TIMEOUT_MS: '100' };
  writeFileSync(passwordFile, password, { mode: 0o600 });
  run(binary('initdb'), ['-D', data, '-U', 'mims_test_admin', '-A', 'scram-sha-256',
    '--pwfile', passwordFile, '--encoding=UTF8', '--locale=C'], process.env, true);
  rmSync(passwordFile);
  run(binary('pg_ctl'), ['-D', data, '-l', join(workspace, 'postgres.log'),
    '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'], process.env, true);
  started = true;
  const admin = createMigrationClient(connection('mims_test_admin', 'postgres'));
  try {
    await admin.connect();
    for (const role of ['mims_owner', 'mims_app']) {
      const { rows } = await admin.query('SELECT format(\'CREATE ROLE %I LOGIN PASSWORD %L\', $1::text, $2::text) AS ddl', [role, password]);
      await admin.query(rows[0].ddl);
    }
    await admin.query('ALTER ROLE mims_owner CREATEDB');
    await admin.query('GRANT mims_app TO mims_owner');
    await admin.query('CREATE DATABASE mims_test_closeout OWNER mims_owner');
  } finally { await admin.end(); }
  console.log('Disposable seed verification ready; the development database is preserved.');
  run(process.execPath, ['scripts/db-rebuild.mjs'], env);
  run(process.execPath, ['scripts/migrate.mjs', 'up'], env);
  run(process.execPath, ['scripts/migrate.mjs', 'verify'], env);
  const first = await snapshot(env);
  run(process.execPath, ['scripts/seed.mjs'], env);
  const second = await snapshot(env);
  assert.deepEqual(second, first, 'Reseeding changed seed counts or exact financial totals.');
  console.log('PASS reseeding preserves all measured counts and exact financial totals.');
  console.log('Seed evidence:', JSON.stringify(second));
  run(process.execPath, ['scripts/seed-check.mjs'], env);
  run(process.execPath, ['scripts/seed-validation.mjs', '--scope=organization'], env);
  const globalExit = run(process.execPath, ['scripts/seed-validation.mjs'], env, false, true);
  assert.equal(globalExit, evaluateSeedMetrics(second).every(result => result.ok) ? 0 : 1,
    'Global CLI exit does not match measured requirements.');
  const tests = ['tests/db/seed-validation-org-customers.test.mjs',
    'tests/db/seed-validation.test.mjs', 'tests/db/sp-post-interest-credit.test.mjs',
    'tests/db/sp-open-fixed-deposit.test.mjs', 'tests/db/fn-check-account-fd-eligible.test.mjs',
    'tests/db/plan-eligibility-function.test.mjs',
    'tests/api/customer-fixed-deposits.test.mjs',
    'tests/db/branch-constraints.test.mjs', 'tests/db/agent-constraints.test.mjs',
    'tests/db/customer-constraints.test.mjs', 'tests/db/customer-agent-constraints.test.mjs',
    'tests/db/customer-document-constraints.test.mjs'];
  run(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--conditions', 'react-server',
    '--test', '--test-concurrency=1', ...tests], env);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], env);
  run(process.execPath, ['node_modules/eslint/bin/eslint.js', '.'], env);
  console.log('M2 SEED VALIDATION: focused tests, rebuild, reseed, typecheck and lint passed.');
  if (globalExit !== 0) console.log('GLOBAL AC-12 remains unmet; see the FAIL metrics above.');
  if (args.includes('--global') && globalExit !== 0) process.exitCode = 1;
  if (args.includes('--all-tests')) {
    mkdirSync('test-results', { recursive: true });
    const allTests = ['api', 'db', 'e2e'].flatMap(folder =>
      readdirSync(join('tests', folder)).filter(file => file.endsWith('.test.mjs')).map(file => join('tests', folder, file)));
    const testExit = run(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--conditions', 'react-server',
      '--test', '--test-concurrency=1', '--test-timeout=30000', '--test-force-exit', ...allTests], env, false, true);
    if (testExit !== 0) process.exitCode = 1;
    console.log(`FULL MERGED-TREE SUITE: ${testExit === 0 ? 'PASS' : 'FAIL'}.`);
  }
} catch (error) {
  console.error(error.code ? `Seed verification failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
} finally {
  if (started && existsSync(join(data, 'postmaster.pid'))) {
    run(binary('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], process.env, true);
  }
  const absolute = resolve(workspace);
  if (!absolute.startsWith(resolve(tmpdir()) + sep) || !basename(absolute).startsWith('mims-seed-validation-')) {
    throw new Error('Refusing cleanup outside the generated temporary workspace.');
  }
  rmSync(absolute, { recursive: true, force: true });
}
