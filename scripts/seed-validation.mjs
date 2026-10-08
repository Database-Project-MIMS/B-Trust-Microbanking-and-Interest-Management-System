import { pathToFileURL } from 'node:url';
import { createMigrationClient } from '../lib/db/migration-client.mjs';

// Fixed SQL inventory: neither relation names nor predicates come from CLI input.
const metrics = [
  { key: 'branches', scope: 'organization', minimum: 3n,
    sql: 'SELECT count(*)::text AS value FROM public.branch' },
  { key: 'ordinary_agents', scope: 'organization', minimum: 5n,
    sql: `SELECT count(*)::text AS value FROM public.agent a
      JOIN public.app_user u ON u.user_id = a.agent_id
      JOIN public.role r ON r.role_id = u.role_id WHERE r.role_name = 'AGENT'` },
  { key: 'customers', scope: 'organization', minimum: 15n,
    sql: 'SELECT count(*)::text AS value FROM public.customer' },
  { key: 'invalid_active_agent_branches', scope: 'organization', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.agent a
      LEFT JOIN public.branch b ON b.branch_id = a.branch_id
      WHERE a.status = 'ACTIVE' AND (b.branch_id IS NULL OR b.status <> 'ACTIVE')` },
  { key: 'invalid_customer_assignment_counts', scope: 'organization', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM (
      SELECT c.customer_id FROM public.customer c
      LEFT JOIN public.customer_agent ca ON ca.customer_id = c.customer_id AND ca.is_active
      GROUP BY c.customer_id HAVING count(ca.cust_agent_id) <> 1
    ) AS invalid` },
  { key: 'invalid_current_assignments', scope: 'organization', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.customer_agent ca
      JOIN public.customer c ON c.customer_id = ca.customer_id
      JOIN public.agent a ON a.agent_id = ca.agent_id
      JOIN public.app_user u ON u.user_id = a.agent_id
      JOIN public.role r ON r.role_id = u.role_id
      JOIN public.branch b ON b.branch_id = a.branch_id
      WHERE ca.is_active AND (ca.end_date IS NOT NULL OR a.branch_id <> c.branch_id
        OR a.status <> 'ACTIVE' OR u.status <> 'ACTIVE' OR r.status <> 'ACTIVE'
        OR r.role_name <> 'AGENT' OR b.status <> 'ACTIVE')` },
  { key: 'joint_accounts', scope: 'full', minimum: 2n,
    sql: `SELECT count(*)::text AS value FROM public.account a
      JOIN public.savings_plan p ON p.plan_id = a.plan_id
      JOIN public.joint_mandate m ON m.account_id = a.account_id
      JOIN LATERAL (SELECT count(*) AS n FROM public.account_holder h
        WHERE h.account_id = a.account_id) holders ON true
      WHERE p.min_holders >= 2 AND holders.n BETWEEN p.min_holders AND p.max_holders
        AND ((m.mandate_type = 'ANY_ONE' AND m.required_signatories = 1)
          OR (m.mandate_type = 'ALL_HOLDERS' AND m.required_signatories = holders.n))` },
  { key: 'fixed_deposits', scope: 'full', minimum: 10n,
    sql: 'SELECT count(*)::text AS value FROM public.fixed_deposit' },
  { key: 'transactions', scope: 'full', minimum: 100n,
    sql: 'SELECT count(*)::text AS value FROM public.transaction' },
  { key: 'interest_runs', scope: 'full', minimum: 2n,
    sql: `SELECT count(*)::text AS value FROM public.interest_run
      WHERE status = 'COMPLETED' AND fd_count > 0 AND exception_count = 0` },
  { key: 'roles_without_active_users', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.role r WHERE r.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM public.app_user u
        WHERE u.role_id = r.role_id AND u.status = 'ACTIVE')` },
  { key: 'invalid_customer_logins', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.app_user u
      JOIN public.role r ON r.role_id = u.role_id WHERE r.role_name = 'CUSTOMER'
      AND u.status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM public.customer c
        WHERE c.app_user_id = u.user_id AND c.status = 'ACTIVE')` },
  { key: 'invalid_branch_staff_logins', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.app_user u
      JOIN public.role r ON r.role_id = u.role_id WHERE r.role_name IN ('AGENT', 'BRANCH_MANAGER')
      AND u.status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM public.agent a
        JOIN public.branch b ON b.branch_id = a.branch_id
        WHERE a.agent_id = u.user_id AND a.status = 'ACTIVE' AND b.status = 'ACTIVE')` },
  { key: 'unresolved_reversals', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.transaction t
      LEFT JOIN public.transaction_reversal r ON r.reversal_transaction_id = t.transaction_id
      LEFT JOIN public.transaction o ON o.transaction_id = r.original_transaction_id
      WHERE t.transaction_type = 'REVERSAL' AND (o.transaction_id IS NULL
        OR o.transaction_type NOT IN ('DEPOSIT', 'WITHDRAWAL', 'INTEREST_CREDIT')
        OR o.account_id <> t.account_id OR o.amount <> t.amount)` },
  { key: 'unreconciled_accounts', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.account a
      LEFT JOIN LATERAL (SELECT sum(CASE
        WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
        WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
        WHEN t.transaction_type = 'REVERSAL' AND o.transaction_type = 'WITHDRAWAL' THEN t.amount
        WHEN t.transaction_type = 'REVERSAL' AND o.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN -t.amount
        ELSE NULL END) AS balance FROM public.transaction t
        LEFT JOIN public.transaction_reversal r ON r.reversal_transaction_id = t.transaction_id
        LEFT JOIN public.transaction o ON o.transaction_id = r.original_transaction_id
        WHERE t.account_id = a.account_id) ledger ON true
      WHERE a.current_balance IS DISTINCT FROM coalesce(ledger.balance, 0)` },
  { key: 'accounts_below_minimum', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.account a
      JOIN public.savings_plan p ON p.plan_id = a.plan_id
      WHERE a.status = 'ACTIVE' AND a.current_balance < p.min_balance` },
  { key: 'invalid_interest_payouts', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.interest_payout p
      JOIN public.fixed_deposit f ON f.fd_id = p.fd_id
      JOIN public.interest_run r ON r.run_id = p.interest_run_id
      LEFT JOIN public.transaction t ON t.transaction_id = p.transaction_id
      WHERE t.transaction_id IS NULL OR t.transaction_type <> 'INTEREST_CREDIT'
        OR t.account_id <> f.account_id OR t.amount <> p.interest_amount
        OR p.cycle_date <> r.cycle_date OR p.interest_amount <= 0
        OR p.interest_amount IS DISTINCT FROM round(f.principal_amount * f.interest_rate_at_opening * 30 / 365, 2)` },
  { key: 'unlinked_interest_credits', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.transaction t
      WHERE t.transaction_type = 'INTEREST_CREDIT' AND NOT EXISTS
        (SELECT 1 FROM public.interest_payout p WHERE p.transaction_id = t.transaction_id)` },
  { key: 'invalid_interest_controls', scope: 'full', maximum: 0n,
    sql: `SELECT count(*)::text AS value FROM public.interest_run r
      LEFT JOIN LATERAL (SELECT count(*) AS n, coalesce(sum(p.interest_amount), 0) AS total
        FROM public.interest_payout p WHERE p.interest_run_id = r.run_id) payouts ON true
      WHERE r.status <> 'COMPLETED' OR r.exception_count IS DISTINCT FROM 0
        OR r.fd_count IS DISTINCT FROM payouts.n OR r.total_interest IS DISTINCT FROM payouts.total` },
];

function scopeMetrics(scope) {
  if (!['organization', 'full'].includes(scope)) throw new Error('Unknown seed-validation scope.');
  return metrics.filter(metric => scope === 'full' || metric.scope === scope);
}

/** Reads aggregate seed evidence inside the caller's snapshot; performs no writes. */
export async function collectSeedMetrics(client, scope = 'full') {
  const snapshot = {};
  for (const metric of scopeMetrics(scope)) {
    snapshot[metric.key] = (await client.query(metric.sql)).rows[0].value;
  }
  return snapshot;
}

/** Returns every unmet count/invariant; absent evidence is always a failure. */
export function evaluateSeedMetrics(snapshot, scope = 'full') {
  return scopeMetrics(scope).map(metric => {
    const value = snapshot[metric.key];
    const valid = typeof value === 'string' && /^\d+$/.test(value);
    const expected = metric.minimum === undefined ? `= ${metric.maximum}` : `>= ${metric.minimum}`;
    const ok = valid && (metric.minimum === undefined
      ? BigInt(value) <= metric.maximum : BigInt(value) >= metric.minimum);
    return { key: metric.key, value: valid ? value : 'missing/invalid', expected, ok };
  });
}

/** Runs all selected checks in one read-only repeatable-read transaction. */
export async function validateSeedDatabase(url, scope = 'full') {
  scopeMetrics(scope);
  const client = createMigrationClient(url);
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const results = evaluateSeedMetrics(await collectSeedMetrics(client, scope), scope);
    await client.query('COMMIT');
    return results;
  } finally { await client.end(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--scope=organization', '--scope=full'].includes(arg)) || args.length > 1) {
    throw new Error('Usage: node scripts/seed-validation.mjs [--scope=organization|full]');
  }
  if (!process.env.DATABASE_MIGRATION_URL && !process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* Environment may be supplied by the caller. */ }
  }
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_MIGRATION_URL is required for seed verification.');
  const scope = args[0]?.split('=')[1] ?? 'full';
  const results = await validateSeedDatabase(url, scope);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.key}: ${result.value} (required ${result.expected})`);
  }
  const passed = results.every(result => result.ok);
  console.log(scope === 'organization'
    ? `M2 ORGANIZATION SEEDS: ${passed ? 'PASS' : 'FAIL'}; this does not certify global AC-12.`
    : `GLOBAL AC-12 MINIMUMS: ${passed ? 'PASS' : 'FAIL'}.`);
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.code ? `Seed validation failed (SQLSTATE ${error.code}).` : error.message);
    process.exitCode = 1;
  });
}
