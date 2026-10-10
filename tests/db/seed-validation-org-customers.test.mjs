import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';
import { collectSeedMetrics, evaluateSeedMetrics } from '../../scripts/seed-validation.mjs';

describe('P06-M02-T01: real organization/customer seed validation', () => {
  let client, admin, snapshot, seedEnvironment, created = false;
  before(async () => {
    if (process.env.MIMS_ISOLATED_TEST !== '1') throw new Error('Run via the disposable verification harness.');
    admin = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
    await admin.connect();
    const { rows } = await admin.query('SELECT current_database() AS name');
    assert.ok(['mims_test_closeout', 'mims_test_customer_schema'].includes(rows[0].name),
      'Seed test rebuilds are restricted to the existing disposable verification cluster.');
    // Other suites can leave committed synthetic customers behind. Always validate a
    // freshly rebuilt seed database rather than counting their fixtures as seed data.
    await admin.query('CREATE DATABASE mims_test_seed_validation OWNER mims_owner');
    created = true;
    const ownerUrl = new URL(process.env.DATABASE_MIGRATION_URL);
    const appUrl = new URL(process.env.DATABASE_URL);
    ownerUrl.pathname = '/mims_test_seed_validation';
    appUrl.pathname = '/mims_test_seed_validation';
    seedEnvironment = { ...process.env, DATABASE_MIGRATION_URL: ownerUrl.href, DATABASE_URL: appUrl.href };
    const rebuild = spawnSync(process.execPath, ['scripts/db-rebuild.mjs'],
      { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(rebuild.status, 0, 'Fresh disposable seed database rebuild must pass.');
    client = createMigrationClient(ownerUrl.href);
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    snapshot = await collectSeedMetrics(client, 'organization');
    await client.query('COMMIT');
  });
  after(async () => {
    try {
      await client?.end();
      if (created) await admin.query('DROP DATABASE mims_test_seed_validation');
    } finally { await admin?.end(); }
  });

  for (const [key, minimum] of [['branches', 3n], ['ordinary_agents', 5n], ['customers', 15n]]) {
    test(`${key} meets its documented minimum (${minimum})`, () => {
      assert.ok(BigInt(snapshot[key]) >= minimum, `${key}: got ${snapshot[key]}, expected >= ${minimum}`);
    });
  }
  test('every active staff profile references exactly one active branch', () => {
    assert.equal(snapshot.invalid_active_agent_branches, '0');
  });
  test('every seeded customer has exactly one active assignment, including customers with no assignment', () => {
    assert.equal(snapshot.invalid_customer_assignment_counts, '0');
  });
  test('current assignments use an active ordinary agent in the customer branch and have no end date', () => {
    assert.equal(snapshot.invalid_current_assignments, '0');
  });
  test('all six organization checks pass together', () => {
    assert.deepEqual(evaluateSeedMetrics(snapshot, 'organization').filter(result => !result.ok), []);
  });

  test('ending an assignment is detected even though the partial unique index permits zero active rows', async () => {
    await client.query('BEGIN');
    try {
      await client.query(`UPDATE public.customer_agent SET is_active = false, end_date = assigned_date
        WHERE cust_agent_id = (SELECT cust_agent_id FROM public.customer_agent WHERE is_active LIMIT 1)`);
      const broken = await collectSeedMetrics(client, 'organization');
      assert.equal(broken.invalid_customer_assignment_counts, '1');
      assert.ok(evaluateSeedMetrics(broken, 'organization').some(result => !result.ok));
    } finally { await client.query('ROLLBACK'); }
  });
  test('an ended row incorrectly retained as active is detected', async () => {
    await client.query('BEGIN');
    try {
      await client.query(`UPDATE public.customer_agent SET end_date = assigned_date
        WHERE cust_agent_id = (SELECT cust_agent_id FROM public.customer_agent WHERE is_active LIMIT 1)`);
      const broken = await collectSeedMetrics(client, 'organization');
      assert.equal(broken.invalid_current_assignments, '1');
    } finally { await client.query('ROLLBACK'); }
  });
  test('an inactive login behind assigned active agents is detected', async () => {
    await client.query('BEGIN');
    try {
      await client.query(`UPDATE public.app_user SET status = 'INACTIVE' WHERE user_id = (
        SELECT agent_id FROM public.customer_agent WHERE is_active LIMIT 1)`);
      const broken = await collectSeedMetrics(client, 'organization');
      assert.ok(BigInt(broken.invalid_current_assignments) > 0n);
    } finally { await client.query('ROLLBACK'); }
  });
  test('negative probes leave all seed metrics intact after rollback', async () => {
    assert.deepEqual(await collectSeedMetrics(client, 'organization'), snapshot);
  });
  test('organization CLI succeeds without mutating the seed or claiming global acceptance', async () => {
    const result = spawnSync(process.execPath, ['scripts/seed-validation.mjs', '--scope=organization'],
      { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /M2 ORGANIZATION SEEDS: PASS/);
    assert.match(result.stdout, /does not certify global AC-12/);
    assert.doesNotMatch(result.stdout, /SKIP|GLOBAL AC-12 MINIMUMS: PASS/);
    assert.deepEqual(await collectSeedMetrics(client, 'organization'), snapshot);
  });
  test('default CLI certifies global minimums without skipping or mutating data', async () => {
    const full = await collectSeedMetrics(client);
    const passed = evaluateSeedMetrics(full).every(result => result.ok);
    const result = spawnSync(process.execPath, ['scripts/seed-validation.mjs'],
      { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, passed ? 0 : 1, result.stderr);
    assert.match(result.stdout, new RegExp(`GLOBAL AC-12 MINIMUMS: ${passed ? 'PASS' : 'FAIL'}`));
    assert.doesNotMatch(result.stdout, /SKIP/);
    assert.deepEqual(await collectSeedMetrics(client), full);
  });
  test('the clean seed passes every global requirement with funded FDs and real payouts', async () => {
    const full = await collectSeedMetrics(client);
    assert.deepEqual(evaluateSeedMetrics(full).filter(result => !result.ok), []);
    assert.equal(full.fixed_deposits, '12');
    assert.equal(full.interest_runs, '3');
    const { rows } = await client.query(`SELECT count(*)::text AS n FROM public.fixed_deposit f
      JOIN public.transaction t ON t.account_id = f.account_id
        AND t.idempotency_key = 'seed-fd-principal-' || right(f.fd_id::text, 12)::integer::text
      WHERE t.transaction_type = 'WITHDRAWAL' AND t.amount = f.principal_amount`);
    assert.equal(rows[0].n, '12');
    assert.equal((await client.query(`SELECT count(*)::text AS n FROM public.fixed_deposit f
      JOIN public.audit_log a ON a.entity_id = f.fd_id AND a.entity_type = 'fixed_deposit'
        AND a.action = 'FD_OPENED' WHERE a.new_values->>'seed_import' = 'true'`)).rows[0].n, '12');
    assert.equal((await client.query('SELECT count(*)::text AS n FROM public.interest_payout')).rows[0].n, '30');
  });
  for (const [label, sql, metric] of [
    ['missing role login', "UPDATE public.app_user SET status = 'INACTIVE' WHERE username = 'auditor'", 'roles_without_active_users'],
    ['unlinked customer login', "UPDATE public.customer SET app_user_id = NULL WHERE app_user_id IS NOT NULL", 'invalid_customer_logins'],
    ['balance changed without ledger', 'UPDATE public.account SET current_balance = current_balance + 1 WHERE account_id = (SELECT account_id FROM public.account LIMIT 1)', 'unreconciled_accounts'],
    ['incorrect run total', "UPDATE public.interest_run SET total_interest = total_interest + 1 WHERE cycle_date = DATE '2026-02-01'", 'invalid_interest_controls'],
    ['incorrect payout amount', 'UPDATE public.interest_payout SET interest_amount = interest_amount + 1 WHERE interest_id = (SELECT interest_id FROM public.interest_payout LIMIT 1)', 'invalid_interest_payouts'],
    ['empty run masquerading as success', "UPDATE public.interest_run SET fd_count = 0 WHERE cycle_date <> DATE '2026-02-01'", 'interest_runs'],
  ]) {
    test(`${label} fails strict global validation`, async () => {
      await client.query('BEGIN');
      try {
        await client.query(sql);
        const full = await collectSeedMetrics(client);
        assert.equal(evaluateSeedMetrics(full).find(result => result.key === metric).ok, false);
      } finally { await client.query('ROLLBACK'); }
    });
  }
  test('interest references distinguish shared UUID prefixes and cycle dates without delays', async () => {
    await client.query('BEGIN');
    try {
      const results = [];
      for (const [n, date] of [[1, '2099-01-01'], [2, '2099-01-01'], [1, '2099-01-31']]) {
        const fd = (await client.query('SELECT fd_id, account_id FROM public.fixed_deposit WHERE fd_id = $1',
          [`00000000-0000-0000-0901-${String(n).padStart(12, '0')}`])).rows[0];
        const result = await client.query('CALL public.sp_post_interest_credit($1::uuid, 1.00::numeric, $2::uuid, $3::date, NULL::uuid, NULL::varchar, NULL::numeric)',
          [fd.account_id, fd.fd_id, date]);
        results.push(result.rows[0].p_reference_number);
      }
      assert.equal(new Set(results).size, 3);
      for (const reference of results) assert.match(reference, /^INT-\d{8}-[0-9a-f]{32}$/);
    } finally { await client.query('ROLLBACK'); }
  });
  test('same FD/cycle cannot produce a second credit and its failed transaction rolls back', async () => {
    await client.query('BEGIN');
    try {
      const fd = (await client.query('SELECT fd_id, account_id FROM public.fixed_deposit ORDER BY fd_id LIMIT 1')).rows[0];
      const call = "CALL public.sp_post_interest_credit($1::uuid, 1.00::numeric, $2::uuid, DATE '2099-02-01', NULL::uuid, NULL::varchar, NULL::numeric)";
      await client.query(call, [fd.account_id, fd.fd_id]);
      await assert.rejects(client.query(call, [fd.account_id, fd.fd_id]), error => error.code === '23505');
    } finally { await client.query('ROLLBACK'); }
    assert.equal((await collectSeedMetrics(client)).unreconciled_accounts, '0');
  });
  test('the steward checker proves strict acceptance and measured reseeding', () => {
    const result = spawnSync(process.execPath, ['scripts/seed-check.mjs'],
      { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS global seed minimums, financial invariants and reseeding/);
    assert.doesNotMatch(result.stdout, /SKIP/);
  });
  test('the steward checker exits nonzero for missing role coverage and performs no reseed', async () => {
    // This suite owns its separate disposable database; expose the probe to the CLI,
    // then restore the synthetic user even if an assertion fails.
    await client.query("UPDATE public.app_user SET status = 'INACTIVE' WHERE username = 'auditor'");
    try {
      const result = spawnSync(process.execPath, ['scripts/seed-check.mjs'],
        { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 10000 });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /FAIL roles_without_active_users: 1/);
      assert.doesNotMatch(result.stdout, /Seeding:|SKIP|PASS global/);
    } finally { await client.query("UPDATE public.app_user SET status = 'ACTIVE' WHERE username = 'auditor'"); }
  });
  test('reseeding restores the actual configured hours and limits instead of hardcoded defaults', async () => {
    const keys = ['BUSINESS_HOUR_START', 'BUSINESS_HOUR_END', 'WITHDRAWAL_SINGLE_LIMIT', 'WITHDRAWAL_DAILY_LIMIT'];
    const previous = (await client.query('SELECT param_key, param_value FROM public.system_parameter WHERE param_key = ANY($1::text[])', [keys])).rows;
    const values = ['09:30', '15:30', '777.00', '888.00'];
    try {
      for (let i = 0; i < keys.length; i++) await client.query('UPDATE public.system_parameter SET param_value = $1 WHERE param_key = $2', [values[i], keys[i]]);
      const result = spawnSync(process.execPath, ['scripts/seed-check.mjs'],
        { env: seedEnvironment, encoding: 'utf8', windowsHide: true, timeout: 15000 });
      assert.equal(result.status, 0, result.stderr);
      const actual = (await client.query('SELECT param_key, param_value FROM public.system_parameter WHERE param_key = ANY($1::text[])', [keys])).rows;
      for (let i = 0; i < keys.length; i++) assert.equal(actual.find(row => row.param_key === keys[i]).param_value, values[i]);
    } finally {
      for (const row of previous) await client.query('UPDATE public.system_parameter SET param_value = $1 WHERE param_key = $2', [row.param_value, row.param_key]);
    }
  });
});

describe('P06-M02-T01: strict count evidence and scope', () => {
  const valid = {
    branches: '3', ordinary_agents: '5', customers: '15',
    invalid_active_agent_branches: '0', invalid_customer_assignment_counts: '0',
    invalid_current_assignments: '0', joint_accounts: '2', fixed_deposits: '10',
    transactions: '100', interest_runs: '2', roles_without_active_users: '0',
    invalid_customer_logins: '0', unresolved_reversals: '0', unreconciled_accounts: '0',
    invalid_branch_staff_logins: '0',
    accounts_below_minimum: '0', invalid_interest_payouts: '0',
    unlinked_interest_credits: '0', invalid_interest_controls: '0',
  };
  test('exact minimum boundaries pass the global checks', () => {
    assert.ok(evaluateSeedMetrics(valid).every(result => result.ok));
  });
  for (const [key, below] of [['branches', '2'], ['ordinary_agents', '4'], ['customers', '14'],
    ['joint_accounts', '1'], ['fixed_deposits', '9'], ['transactions', '99'], ['interest_runs', '1']]) {
    test(`${key} below its minimum fails explicitly`, () => {
      const failed = evaluateSeedMetrics({ ...valid, [key]: below }).filter(result => !result.ok);
      assert.deepEqual(failed.map(result => result.key), [key]);
    });
  }
  test('empty and absent datasets fail instead of being skipped', () => {
    for (const value of ['0', undefined, null, 'NaN', '-1', '1.5', 15]) {
      assert.equal(evaluateSeedMetrics({ ...valid, customers: value }).find(result => result.key === 'customers').ok, false);
    }
  });
  test('counts above JavaScript safe-integer range stay exact', () => {
    const results = evaluateSeedMetrics({ ...valid, transactions: '9007199254740993' });
    assert.equal(results.find(result => result.key === 'transactions').value, '9007199254740993');
    assert.ok(results.every(result => result.ok));
  });
  test('missing active users for configured roles fails', () => {
    assert.equal(evaluateSeedMetrics({ ...valid, roles_without_active_users: '1' })
      .find(result => result.key === 'roles_without_active_users').ok, false);
  });
  test('organization scope cannot imply that unseeded FD and interest datasets pass globally', () => {
    const partial = { ...valid, fixed_deposits: '0', interest_runs: '0' };
    assert.ok(evaluateSeedMetrics(partial, 'organization').every(result => result.ok));
    assert.deepEqual(evaluateSeedMetrics(partial).filter(result => !result.ok).map(result => result.key),
      ['fixed_deposits', 'interest_runs']);
  });
  test('unknown scopes are rejected', () => {
    assert.throws(() => evaluateSeedMetrics(valid, 'customers; DROP TABLE customer'), /Unknown/);
  });
  test('the CLI rejects arbitrary arguments before loading a database connection', () => {
    const result = spawnSync(process.execPath, ['scripts/seed-validation.mjs', '--scope=invalid'],
      { env: process.env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
    assert.doesNotMatch(result.stderr, /postgresql:|password|stack|SELECT/);
  });
});
