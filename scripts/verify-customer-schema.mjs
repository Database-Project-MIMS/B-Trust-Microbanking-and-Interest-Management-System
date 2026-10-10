import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

// Rebuild proof is confined to this newly initialized cluster, never the configured DB.
const temporaryRoot = mkdtempSync(join(tmpdir(), 'mims-customer-schema-'));
const dataDirectory = join(temporaryRoot, 'pgdata');
const passwordFile = join(temporaryRoot, 'init-password');
const password = randomBytes(24).toString('hex');
const database = 'mims_test_customer_schema';
const pgBin = process.env.PG_BIN ?? (process.platform === 'win32' ? ['18', '17', '16', '15']
  .map(version => `C:/Program Files/PostgreSQL/${version}/bin`)
  .find(directory => existsSync(join(directory, 'initdb.exe'))) : undefined);

function binary(name) {
  return pgBin ? join(pgBin, process.platform === 'win32' ? `${name}.exe` : name) : name;
}
function run(executable, args, environment, input) {
  const control = /^pg_ctl(?:\.exe)?$/.test(basename(executable));
  const result = spawnSync(executable, args, {
    env: environment, input, encoding: 'utf8', windowsHide: true,
    // PostgreSQL's background child must not inherit a pipe held by spawnSync.
    stdio: control ? 'ignore' : input ? ['pipe', 'ignore', 'ignore'] : 'inherit',
    timeout: control ? 30000 : undefined,
  });
  if (result.status !== 0) throw new Error(`${basename(executable)} verification step failed (exit ${result.status ?? 'unavailable'}).`);
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
  const connection = role => `postgresql://${role}:${password}@127.0.0.1:${port}/${database}`;
  const environment = {
    ...process.env,
    PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGPASSWORD: password,
    PGDATABASE: 'postgres', PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PSQL_ADMIN: 'mims_owner',
    DATABASE_URL: connection('mims_app'), DATABASE_MIGRATION_URL: connection('mims_owner'),
    PGPOOL_IDLE_TIMEOUT_MS: '100',
  };
  writeFileSync(passwordFile, password, { mode: 0o600 });
  run(binary('initdb'), ['-D', dataDirectory, '-U', 'postgres', '-A', 'scram-sha-256',
    '--pwfile', passwordFile, '--encoding=UTF8', '--locale=C'], environment);
  rmSync(passwordFile);
  run(binary('pg_ctl'), ['-D', dataDirectory, '-l', join(temporaryRoot, 'postgres.log'),
    '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'], environment);
  // Password is locally generated hex, not request data; SQL goes over stdin, never logs.
  run(binary('psql'), ['-X', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'], environment,
    `CREATE ROLE mims_owner CREATEDB LOGIN PASSWORD '${password}';\nCREATE ROLE mims_app LOGIN PASSWORD '${password}';`
      // Disposable-only membership permits the service test to SET ROLE to the real app role.
      + (process.argv.includes('--registration') || process.argv.includes('--integrity') ? '\nGRANT mims_app TO mims_owner;' : '')
      + '\nCREATE DATABASE mims_test_customer_schema OWNER mims_owner;');

  console.log('Rebuilding in disposable mims_test_customer_schema; development database is preserved.');
  run(process.execPath, ['scripts/db-rebuild.mjs'], environment);
  run(process.execPath, ['scripts/migrate.mjs', 'up'], environment);
  run(process.execPath, ['scripts/migrate.mjs', 'verify'], environment);
  const testFiles = ['tests/db/customer-constraints.test.mjs', 'tests/db/branch-constraints.test.mjs',
    'tests/db/agent-constraints.test.mjs', 'tests/db/organization-audit.test.mjs',
    'tests/api/organization.test.mjs', 'tests/e2e/branches-agents.test.mjs'];
  if (process.argv.includes('--relations')) testFiles.push(
    'tests/db/customer-agent-constraints.test.mjs', 'tests/db/customer-document-constraints.test.mjs',
    'tests/api/customer-document-service.test.mjs',
  );
  if (process.argv.includes('--registration')) testFiles.push(
    'tests/db/customer-registration-transaction.test.mjs', 'tests/api/customer-service.test.mjs',
  );
  if (process.argv.includes('--integrity')) testFiles.push(
    'tests/db/master-data-integrity.test.mjs', 'tests/api/master-data-integrity.test.mjs',
    'tests/api/customers.test.mjs',
  );
  run(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--conditions', 'react-server',
    '--test', '--test-concurrency=1', ...testFiles], environment);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], environment);
  run(process.execPath, ['node_modules/eslint/bin/eslint.js', '.'], environment);
  const scope = process.argv.includes('--integrity') ? 'MASTER-DATA INTEGRITY' : process.argv.includes('--registration') ? 'CUSTOMER REGISTRATION' : process.argv.includes('--relations') ? 'CUSTOMER RELATIONS' : 'CUSTOMER SCHEMA';
  console.log(`${scope}: all selected tests, clean rebuild, typecheck and lint passed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (existsSync(join(dataDirectory, 'postmaster.pid'))) {
    run(binary('pg_ctl'), ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], process.env);
  }
  // Check the resolved absolute target stays under the intended temporary root.
  const absolute = resolve(temporaryRoot);
  if (!absolute.startsWith(resolve(tmpdir()) + sep) || !basename(absolute).startsWith('mims-customer-schema-')) {
    throw new Error('Refusing recursive cleanup outside the generated temporary directory.');
  }
  rmSync(absolute, { recursive: true, force: true });
}
