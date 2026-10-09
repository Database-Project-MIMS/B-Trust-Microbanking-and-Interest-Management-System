import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';
import { validateSeedDatabase } from '../../scripts/seed-validation.mjs';

// Compatibility entry for the original M5 seed-framework tests. Other suites
// deliberately mutate shared fixtures, so validate a freshly rebuilt owned DB.
describe('P01-M05-T03 / P06-M02-T01: seed framework acceptance', () => {
  let admin, environment, created = false;
  before(async () => {
    if (process.env.MIMS_ISOLATED_TEST !== '1') throw new Error('Use the disposable verification harness.');
    admin = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
    await admin.connect();
    const { rows } = await admin.query('SELECT current_database() AS name');
    assert.ok(['mims_test_closeout', 'mims_test_customer_schema'].includes(rows[0].name));
    await admin.query('CREATE DATABASE mims_test_seed_checker OWNER mims_owner');
    created = true;
    const owner = new URL(process.env.DATABASE_MIGRATION_URL);
    const app = new URL(process.env.DATABASE_URL);
    owner.pathname = app.pathname = '/mims_test_seed_checker';
    environment = { ...process.env, DATABASE_MIGRATION_URL: owner.href, DATABASE_URL: app.href };
    const result = spawnSync(process.execPath, ['scripts/db-rebuild.mjs'],
      { env: environment, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(result.status, 0, 'Fresh seed checker rebuild must succeed.');
  });
  after(async () => {
    try { if (created) await admin.query('DROP DATABASE mims_test_seed_checker'); }
    finally { await admin?.end(); }
  });
  test('seeding once meets every minimum and financial invariant', async () => {
    const results = await validateSeedDatabase(environment.DATABASE_MIGRATION_URL);
    assert.deepEqual(results.filter(result => !result.ok), []);
  });
  test('seeding twice preserves measured counts and exact financial totals', () => {
    const result = spawnSync(process.execPath, ['scripts/seed-check.mjs'],
      { env: environment, encoding: 'utf8', windowsHide: true, timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS global seed minimums, financial invariants and reseeding/);
    assert.doesNotMatch(result.stdout, /SKIP/);
  });
});
