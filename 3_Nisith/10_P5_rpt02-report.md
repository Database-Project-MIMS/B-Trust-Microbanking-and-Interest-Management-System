# 🔴 Phase 5 — Tasks 01–02: RPT-02 Account Summary Report
**Task IDs:** `P05-M03-T01`, `P05-M03-T02` · **Branch:** `feat/p05-m03-rpt02-account-summary`
**Migration:** `0540_p05_m03_rpt02_view.sql` · **Status:** TODO
**Depends on:** `P03-M04-T02` (M4's `sp_post_deposit`, for real ledger data), **I-7**
(report shell from M1)
**Story Points:** ~3 + ~4 = ~7 · **Layer:** Database + Backend + Frontend

---

## What This Task Is

**Your** report from the original assignment table: **RPT-02 — Account-wise transaction
summary**, with opening and closing balance. Same pattern as M2's RPT-01 and M5's
RPT-03/04 — a view plus a page built on M1's report shell (I-7).

---

## T01 — `vw_rpt02_account_summary`

Opening balance for a date range and closing balance both require reconstructing the
balance as of a point in time. `transaction.balance_after` (G-14, M4's column) makes
this tractable: the closing balance for a range is the `balance_after` of the last
transaction on or before `to`; the opening balance is the `balance_after` of the last
transaction **before** `from` (or the account's balance at opening if there is none).

```sql
CREATE VIEW vw_rpt02_account_summary AS
SELECT
    a.account_id,
    a.account_number,
    a.branch_id,
    a.plan_id,
    sp.plan_name,
    a.status,
    t.transaction_id,
    t.transaction_type,
    t.amount,
    t.balance_after,
    t.posted_at
FROM account a
JOIN savings_plan sp ON sp.plan_id = a.plan_id
LEFT JOIN transaction t ON t.account_id = a.account_id AND t.status = 'POSTED';
```

Keep the view row-per-transaction (like M2's RPT-01 pattern) and let the report query in
T02 compute the opening/closing balance and subtotals for the requested range — pushing
date-range logic into the view would make it unusable for other date ranges. The report
query should do roughly:

```sql
-- closing balance: latest balance_after at or before :to
-- opening balance: latest balance_after strictly before :from, or 0 if none
-- (both via DISTINCT ON (account_id) ... ORDER BY posted_at DESC)
```

Confirm `transaction.balance_after` (G-14) has actually landed in M4's schema before
writing this — check `docs/04_database-schema.md` Part B.

---

## T02 — RPT-02 API, Page & CSV

### `GET /api/reports/account-summary`
Follows the shared report contract from `docs/05_api-and-pages.md` §"Reports":

- **Roles** `BRANCH_MANAGER` (own branch), `CENTRAL_OPS`, `AUDITOR`, `ADMIN`
- **Query** `from`, `to`, `branchId`, `accountId`, `planId`, `format=json|csv`, `page`,
  `pageSize`
- **Validation** dates valid and ordered; `branchId`/`accountId` inside the caller's
  scope; sort column via `allowListed()`
- **SQL** query `vw_rpt02_account_summary`, aggregate to one row per account with
  `opening_balance`, `closing_balance`, transaction counts by type, filtered by
  parameterized predicates **plus branch scope in the `WHERE` clause**
- **Success** `{ data: { rows, subtotals, grandTotal, filters, generatedAt,
  requestedBy } }`
- **CSV** identical query and identical totals to JSON (REP-COM-04); streamed
- **Audit** every access logged via M1's shared helper (REP-COM-06)
- **Page** `/reports/account-summary`

### Step 1 — Confirm I-7 Is Published
```bash
grep -n "P05-M01-T01" docs/09_task-tracker.md
```

### Step 2 — Backend
`services/report-service.ts` (or a dedicated module, matching whatever pattern I-7's
handoff describes): `getAccountSummaryReport(filters, scope)`.

### Step 3 — Frontend
`app/reports/account-summary/page.tsx` built on M1's report shell — filter bar, results
table (opening/closing balance columns are the distinguishing feature of this report),
CSV export button.

### Step 4 — Write Tests
- `tests/db/rpt02-view.test.mjs`: opening/closing balance computed correctly against a
  manually seeded sequence of deposits and withdrawals, including a case with **no**
  transactions in the range (opening = closing = last known balance)
- `tests/api/rpt02-report.test.mjs`: CSV and JSON totals match exactly; `BRANCH_MANAGER`
  outside scope → 403; report access is logged
- Run `EXPLAIN ANALYZE` on the date-range query; confirm it uses
  `(account_id, transaction_date DESC)` or equivalent index from M4's statement
  endpoint — reuse existing indexes rather than adding a redundant one if possible;
  record the plan in the PR description

### Step 5 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 6 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `vw_rpt02_account_summary`
- Confirm `docs/05_api-and-pages.md` matches the built endpoint
- Run `/imprint` if the report introduces new UI patterns beyond RPT-01's
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Opening and closing balance are computed from `balance_after`, not recomputed by
      summing every ledger row from account inception each time
- [ ] An account with zero transactions in the filtered range still reports a correct
      (unchanged) opening/closing balance
- [ ] CSV and JSON totals are identical for the same filters
- [ ] Branch scope enforced in SQL
- [ ] Report access audited via M1's shared helper
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
