# 🔴 Phase 6 — Member 5 Tasks: Testing, Ops & Deployment
**Task IDs:** `P06-M05-T01`, `P06-M05-T02`  
**Story Points:** ~8 total · **Layer:** Tests + Ops + Docs

---

## Overview

Phase 6 is the final phase — verification and delivery. Your 2 tasks prove that the interest cycle is correct and idempotent, and that the system can be backed up, restored, and demonstrated.

---

## Task 1: Interest Re-run Idempotency & Report Reconciliation (`P06-M05-T01`)
**Branch:** `feat/p06-m05-idempotency-tests`  
**Depends on:** P05-M05-T03

### What to Do

Prove with automated tests that:
1. Re-running the same interest cycle does **not** create duplicate payouts or ledger rows (AC-08, AC-09)
2. Report totals **reconcile** with the underlying data — RPT-03 totals match the FD ledger, RPT-04 totals match the payout records

### How to Implement

Create `tests/db/interest-idempotency.test.mjs`:

```javascript
import { describe, it, assert } from 'node:test';

describe('Interest cycle idempotency (AC-08)', () => {
  
  it('first run processes all due FDs and credits interest', async () => {
    // 1. Seed FDs with next_interest_date <= today
    // 2. Run sp_run_interest_cycle(today)
    // 3. Assert: interest_run row created, payouts match fd_count
    // 4. Assert: each payout has a linked INTEREST_CREDIT transaction
    // 5. Assert: account balances increased by the correct amounts
  });

  it('re-running the same cycle date is rejected (23505)', async () => {
    // 1. Run sp_run_interest_cycle(today) again
    // 2. Assert: UNIQUE violation on interest_run.cycle_date
    // 3. Assert: no new payout rows created
    // 4. Assert: no new transaction rows created
    // 5. Assert: account balances unchanged
  });

  it('same FD + same cycle_date payout is rejected (23505)', async () => {
    // Try to manually insert a duplicate interest_payout
    // Assert: UNIQUE violation on (fd_id, cycle_date)
  });

  it('partial failure does not roll back completed payouts', async () => {
    // 1. Set up one FD that will fail (e.g., linked to a CLOSED account)
    // 2. Run the cycle
    // 3. Assert: successful FDs have payouts, exception_count = 1
    // 4. Assert: the failing FD has no payout and no transaction
  });
});

describe('Report totals reconciliation (AC-09)', () => {
  
  it('RPT-03 total principal matches SUM of active FD principals', async () => {
    const reportTotal = await query(`
      SELECT SUM(principal_amount) AS total 
      FROM vw_rpt03_active_fds
    `);
    const directTotal = await query(`
      SELECT SUM(principal_amount) AS total 
      FROM fixed_deposit WHERE status = 'ACTIVE'
    `);
    assert.strictEqual(
      reportTotal.rows[0].total, 
      directTotal.rows[0].total,
      'RPT-03 principal total must match direct query'
    );
  });

  it('RPT-04 total interest matches SUM of interest_payout amounts', async () => {
    const reportTotal = await query(`
      SELECT SUM(total_interest) AS total 
      FROM vw_rpt04_interest_distribution 
      WHERE cycle_date IS NOT NULL  -- exclude ROLLUP grand total row
    `);
    const directTotal = await query(`
      SELECT SUM(interest_amount) AS total 
      FROM interest_payout
    `);
    assert.strictEqual(
      reportTotal.rows[0].total, 
      directTotal.rows[0].total,
      'RPT-04 interest total must match payout records'
    );
  });

  it('interest payout count matches INTEREST_CREDIT transaction count', async () => {
    const payoutCount = await query(`
      SELECT COUNT(*) AS cnt FROM interest_payout
    `);
    const txnCount = await query(`
      SELECT COUNT(*) AS cnt FROM transaction 
      WHERE transaction_type = 'INTEREST_CREDIT'
    `);
    assert.strictEqual(
      payoutCount.rows[0].cnt, 
      txnCount.rows[0].cnt,
      'Every payout must have exactly one INTEREST_CREDIT'
    );
  });
});
```

### Tests Summary

| Test | What it verifies | AC |
|---|---|---|
| First interest run processes all due FDs | Happy path | — |
| Re-run same cycle → `23505` | Cycle idempotency | AC-08 |
| Duplicate payout → `23505` | Payout idempotency | AC-08 |
| One FD fails → others committed | Partial failure handling | FR-INT-04 |
| RPT-03 principal total = SUM(active FD principals) | Report reconciliation | AC-09 |
| RPT-04 interest total = SUM(payout amounts) | Report reconciliation | AC-09 |
| Payout count = INTEREST_CREDIT transaction count | Ledger integrity | — |
| Account balance after interest = previous + interest | Balance correctness | — |

---

## Task 2: Backup, Restore, Migration Rollback & Demo Script (`P06-M05-T02`)
**Branch:** `feat/p06-m05-ops-deployment`  
**Depends on:** all phases

### What to Do

Produce evidence that the system can be backed up, restored, and demonstrated. Create a demonstration script that walks through all major features.

### Part A — Backup & Restore Evidence

Create `scripts/backup-restore-test.sh`:

```bash
#!/bin/bash
# Evidence: backup and restore produces an identical database

set -e

echo "=== Step 1: Take a backup ==="
pg_dump -Fc mims > /tmp/mims_backup.dump
echo "Backup size: $(ls -lh /tmp/mims_backup.dump | awk '{print $5}')"

echo "=== Step 2: Record checksums ==="
psql mims -c "SELECT COUNT(*) FROM fixed_deposit" > /tmp/pre_restore_counts.txt
psql mims -c "SELECT SUM(current_balance) FROM account" >> /tmp/pre_restore_counts.txt
psql mims -c "SELECT SUM(interest_amount) FROM interest_payout" >> /tmp/pre_restore_counts.txt

echo "=== Step 3: Drop and restore ==="
dropdb mims_test_restore 2>/dev/null || true
createdb mims_test_restore
pg_restore -d mims_test_restore /tmp/mims_backup.dump

echo "=== Step 4: Compare checksums ==="
psql mims_test_restore -c "SELECT COUNT(*) FROM fixed_deposit" > /tmp/post_restore_counts.txt
psql mims_test_restore -c "SELECT SUM(current_balance) FROM account" >> /tmp/post_restore_counts.txt
psql mims_test_restore -c "SELECT SUM(interest_amount) FROM interest_payout" >> /tmp/post_restore_counts.txt

diff /tmp/pre_restore_counts.txt /tmp/post_restore_counts.txt
echo "✅ Backup and restore produce identical data"

echo "=== Step 5: Cleanup ==="
dropdb mims_test_restore
rm /tmp/mims_backup.dump
```

### Part B — Migration Rollback Evidence

Document in `docs/migration-rollback-evidence.md`:
1. Full rebuild from empty: `npm run db:rebuild` → success
2. Each migration applies cleanly in order
3. Recording that editing an applied migration is rejected

### Part C — Demonstration Script

Create `docs/demonstration-script.md`:

```markdown
# MIMS Demonstration Script

## 1. System Setup (2 min)
- Show the database with seeded data
- Sign in as ADMIN
- Navigate the app shell (role-aware nav)

## 2. Customer & Account Management (3 min)
- Search for a customer
- View customer profile
- Open a new savings account (show eligibility check)
- Open a joint account with 2 holders

## 3. Financial Transactions (5 min)
- Post a deposit (show balance update)
- Post a withdrawal (show minimum balance check)
- Attempt an overdraft (show rejection)
- Reverse a transaction (manager only)
- View the transaction statement with balance_after

## 4. Fixed Deposits (5 min)
- Open an FD against an active account
- Show principal debited from savings balance
- Show rate snapshot (interest_rate_at_opening)
- Attempt second FD on same account (show rejection)

## 5. Interest Cycle (5 min)
- Trigger an interest run
- Show FDs processed, total interest, exceptions
- Show INTEREST_CREDIT in the statement
- Show next_interest_date advanced
- Re-run same cycle (show idempotency)

## 6. Reports (5 min)
- RPT-01: Agent-wise transactions (with branch scope)
- RPT-02: Account-wise summary
- RPT-03: Active FDs and next payout
- RPT-04: Monthly interest distribution (show ROLLUP subtotals)
- RPT-05: Customer activity
- Export CSV (show identical totals)

## 7. Security & Audit (3 min)
- Show audit trail
- Attempt cross-branch access (denied)
- Show RLS enforcement
```

### Update Docs
- Update `docs/12_testing-and-acceptance.md` with backup/restore evidence
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Re-running the same interest cycle produces no duplicate payouts or ledger rows (AC-08)
- [ ] Report totals reconcile with the underlying data (AC-09)
- [ ] Partial interest failure does not roll back completed distributions (FR-INT-04)
- [ ] Backup and restore produce identical row counts and financial totals
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] Demonstration script covers all major features
- [ ] Evidence is documented and reproducible
