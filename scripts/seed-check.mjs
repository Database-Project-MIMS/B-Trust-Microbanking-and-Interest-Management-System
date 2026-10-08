import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../lib/db/migration-client.mjs';
import { collectSeedMetrics, evaluateSeedMetrics } from './seed-validation.mjs';

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { /* Caller may supply the environment. */ }
}

async function snapshot(url) {
  const client = createMigrationClient(url);
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const metrics = await collectSeedMetrics(client);
    const { rows } = await client.query(`SELECT
      (SELECT count(*)::text FROM public.app_user) AS users,
      (SELECT count(*)::text FROM public.account) AS accounts,
      (SELECT count(*)::text FROM public.customer_agent) AS assignments,
      (SELECT count(*)::text FROM public.account_holder) AS holders,
      (SELECT count(*)::text FROM public.interest_payout) AS payouts,
      (SELECT coalesce(sum(current_balance), 0)::text FROM public.account) AS balance_total,
      (SELECT coalesce(sum(amount), 0)::text FROM public.transaction) AS transaction_amount_total,
      (SELECT coalesce(sum(interest_amount), 0)::text FROM public.interest_payout) AS payout_total,
      (SELECT coalesce(sum(total_interest), 0)::text FROM public.interest_run) AS run_total`);
    await client.query('COMMIT');
    return { ...metrics, ...rows[0] };
  } finally { await client.end(); }
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/seed-check.mjs');
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_MIGRATION_URL is required for seed verification.');
  const first = await snapshot(url);
  const results = evaluateSeedMetrics(first);
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.key}: ${result.value} (required ${result.expected})`);
  if (results.some(result => !result.ok)) {
    process.exitCode = 1;
    return;
  }
  // This explicit command checks reseeding. db:seed-validate remains read-only.
  const seed = spawnSync(process.execPath, ['scripts/seed.mjs'],
    { env: process.env, stdio: 'inherit', windowsHide: true });
  if (seed.status !== 0 || seed.error) throw new Error('Reseeding did not complete successfully.');
  assert.deepEqual(await snapshot(url), first, 'Reseeding changed counts or exact financial totals.');
  console.log('PASS global seed minimums, financial invariants and reseeding.');
}

main().catch(error => {
  console.error(error.code ? `Seed check failed (SQLSTATE ${error.code}).` : error.message);
  process.exitCode = 1;
});
