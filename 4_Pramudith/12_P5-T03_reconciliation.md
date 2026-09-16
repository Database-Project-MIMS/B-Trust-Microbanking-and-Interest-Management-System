# 🔴 Phase 5 — Task 03: Reconciliation — Ledger vs Balance vs `balance_after`
**Task ID:** `P05-M04-T03` · **Branch:** `feat/p05-m04-reconciliation`
**Status:** TODO
**Depends on:** `P05-M04-T01` (RPT-05 view, shares infrastructure)
**Story Points:** ~4 · **Layer:** Database + Frontend

---

## What This Task Is

`docs/04_database-schema.md` §B.5 documents two intentional denormalisations you own —
**D-1** (`account.current_balance` duplicates the sum of ledger amounts) and **D-2**
(`transaction.balance_after` duplicates a window-function computation) — and commits to
reconciling both against their source in Phase 5. This task is that reconciliation: two
views that prove the denormalised values are still correct, plus a small page showing
the result. If either view ever finds a mismatch, that is a real bug in a posting
routine, not a reporting nuance.

---

## D-1 Reconciliation: `current_balance` vs Ledger Sum

```sql
CREATE VIEW vw_reconciliation_balance AS
SELECT
    a.account_id,
    a.account_number,
    a.current_balance AS stored_balance,
    COALESCE(SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                -- sign depends on what the reversal is compensating for;
                -- derive from transaction_reversal + the original row's type
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN -orig.amount
                    ELSE orig.amount
                 END
                 FROM transaction_reversal tr
                 JOIN transaction orig ON orig.transaction_id = tr.original_transaction_id
                 WHERE tr.reversal_transaction_id = t.transaction_id)
            ELSE 0
        END
    ), 0) AS computed_balance,
    a.current_balance - COALESCE(SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            ELSE 0
        END
    ), 0) AS discrepancy
FROM account a
LEFT JOIN transaction t ON t.account_id = a.account_id AND t.status = 'POSTED'
GROUP BY a.account_id, a.account_number, a.current_balance;
```

Simplify the `REVERSAL` sign logic once you've actually built `sp_reverse_transaction`
(Phase 3, T04) and confirmed exactly how it signs compensating entries — the sketch
above is a starting point, not a final answer; write it to match your actual
implementation, not the other way around.

## D-2 Reconciliation: `balance_after` vs Window Function

```sql
CREATE VIEW vw_reconciliation_running_balance AS
SELECT
    t.transaction_id,
    t.account_id,
    t.balance_after AS stored_balance_after,
    SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            ELSE 0
        END
    ) OVER (
        PARTITION BY t.account_id
        ORDER BY t.transaction_date, t.transaction_id
    ) AS computed_running_balance
FROM transaction t
WHERE t.status = 'POSTED';
```

This is the L13 window-function demonstration G-14 specifically calls out as worth
including alongside the denormalised column, not instead of it.

## Reconciliation Page

`app/reconciliation/page.tsx` — role-gated (`CENTRAL_OPS`, `AUDITOR`, `ADMIN`):
- Table of accounts where `vw_reconciliation_balance.discrepancy <> 0` — should be
  **empty** in a healthy system; if it's ever non-empty, that's the headline finding
- Table of transactions where `stored_balance_after <> computed_running_balance` —
  same expectation
- A summary line: "N accounts reconciled, 0 discrepancies" or similar

---

## How to Implement

### Step 1 — Write the Migration
`database/migrations/0561_p05_m04_reconciliation_views.sql`.

### Step 2 — Write SQL Tests
Create file: `tests/db/reconciliation.test.mjs`

1. ✅ For a manually seeded sequence of deposits, withdrawals and one reversal,
   `vw_reconciliation_balance.discrepancy = 0`
2. ✅ For the same sequence, every row's `stored_balance_after` matches
   `computed_running_balance` in `vw_reconciliation_running_balance`
3. ✅ **Deliberately corrupt** a test account's `current_balance` via a raw `UPDATE`
   bypassing the routines (test-only, direct SQL) and confirm the reconciliation view
   correctly reports a non-zero discrepancy — proves the check actually detects drift,
   not just that it returns zero on already-correct data

### Step 3 — Frontend
`app/reconciliation/page.tsx` as described above.

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` §B.5 — link the reconciliation views against D-1
  and D-2
- Update `docs/16_database-routines-views-indexes.md` — add both views
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Both reconciliation views exist and report zero discrepancies against a correctly
      seeded dataset
- [ ] A deliberately corrupted balance is caught by the view (proves the check has teeth)
- [ ] Reversal sign logic in D-1's view matches the actual `sp_reverse_transaction`
      implementation, not a guess
- [ ] Reconciliation page is role-gated and shows a clear pass/fail summary
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
