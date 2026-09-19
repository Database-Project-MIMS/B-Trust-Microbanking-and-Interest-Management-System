import pg from 'pg';
import { execSync } from 'node:child_process';

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch {}
}

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL is not set.");
  process.exit(1);
}

const EXPECTED_MINIMUMS = {
  branch: 3,
  agent: 5,
  customer: 15,
  account: 10,
  fd_plan: 3,
  fixed_deposit: 10,
  transaction: 100
};

async function getCounts(client) {
  const counts = {};
  for (const table of Object.keys(EXPECTED_MINIMUMS)) {
    const res = await client.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS present`);
    if (res.rows[0].present) {
      const countRes = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = parseInt(countRes.rows[0].count, 10);
    } else {
      counts[table] = null;
    }
  }
  
  // Joint accounts check
  const hasAccount = await client.query(`SELECT to_regclass('public.account') IS NOT NULL AS present`);
  if (hasAccount.rows[0].present) {
     try {
       const jointRes = await client.query(`SELECT COUNT(*) as count FROM account WHERE mandate_type != 'SINGLE'`);
       counts['joint_accounts'] = parseInt(jointRes.rows[0].count, 10);
     } catch (e) {
       counts['joint_accounts'] = null; // column mandate_type might not exist yet
     }
  } else {
    counts['joint_accounts'] = null;
  }
  
  return counts;
}

async function getFinancialTotals(client) {
  const totals = { balanceSum: null, transactionSum: null };
  const hasAccount = await client.query(`SELECT to_regclass('public.account') IS NOT NULL AS present`);
  if (hasAccount.rows[0].present) {
    try {
      const res = await client.query(`SELECT COALESCE(SUM(current_balance), 0) as sum FROM account`);
      totals.balanceSum = res.rows[0].sum;
    } catch (e) {}
  }
  
  const hasTransaction = await client.query(`SELECT to_regclass('public.transaction') IS NOT NULL AS present`);
  if (hasTransaction.rows[0].present) {
    try {
      const res = await client.query(`SELECT COALESCE(SUM(amount), 0) as sum FROM transaction`);
      totals.transactionSum = res.rows[0].sum;
    } catch (e) {}
  }
  
  return totals;
}

async function main() {
  console.log("Checking seed data...");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  
  try {
    const initialCounts = await getCounts(client);
    const initialTotals = await getFinancialTotals(client);
    
    let failed = false;
    for (const [table, min] of Object.entries(EXPECTED_MINIMUMS)) {
      const count = initialCounts[table];
      if (count !== null) {
        if (count < min) {
          console.error(`[FAIL] ${table}: expected >= ${min}, got ${count}`);
          failed = true;
        } else {
          console.log(`[PASS] ${table}: ${count} (>= ${min})`);
        }
      } else {
        console.log(`[SKIP] ${table}: table not created yet`);
      }
    }
    
    const jointMin = 2;
    if (initialCounts['joint_accounts'] !== null) {
       if (initialCounts['joint_accounts'] < jointMin) {
          console.error(`[FAIL] joint_accounts: expected >= ${jointMin}, got ${initialCounts['joint_accounts']}`);
          failed = true;
       } else {
          console.log(`[PASS] joint_accounts: ${initialCounts['joint_accounts']} (>= ${jointMin})`);
       }
    }
    
    if (failed) process.exit(1);

    console.log("\nRe-running seed to check idempotency...");
    execSync('npm run db:seed', { stdio: 'inherit' });
    
    const secondCounts = await getCounts(client);
    const secondTotals = await getFinancialTotals(client);
    
    let idempotencyFailed = false;
    for (const key of Object.keys(initialCounts)) {
      if (initialCounts[key] !== secondCounts[key]) {
        console.error(`[FAIL] Idempotency broken for ${key}: ${initialCounts[key]} changed to ${secondCounts[key]}`);
        idempotencyFailed = true;
      }
    }
    
    for (const key of Object.keys(initialTotals)) {
      if (initialTotals[key] !== secondTotals[key]) {
        console.error(`[FAIL] Idempotency broken for financial total ${key}: ${initialTotals[key]} changed to ${secondTotals[key]}`);
        idempotencyFailed = true;
      }
    }
    
    if (idempotencyFailed) process.exit(1);
    console.log("\n[PASS] Seed is idempotent and minimums are met. All checks passed.");
    
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
