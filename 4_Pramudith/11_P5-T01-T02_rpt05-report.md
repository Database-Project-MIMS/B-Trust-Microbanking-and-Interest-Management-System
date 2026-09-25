# 🔴 Phase 5 — Tasks 01–02: RPT-05 Customer Activity Report
**Task IDs:** `P05-M04-T01`, `P05-M04-T02` · **Branch:** `feat/p05-m04-rpt05-customer-activity`
**Migration:** `0560_p05_m04_rpt05_view.sql` · **Status:** TODO
**Depends on:** `P03-M04-T02` (`sp_post_deposit`, for real ledger data), **I-7** (report
shell from M1)
**Story Points:** ~3 + ~3 = ~6 · **Layer:** Database + Backend

> ⚡ **UI COMPLETE** — The RPT-05 report screen is pre-built in `app/dashboard/**`. Your
> job is to implement the **view, API and CSV export** only. Do not rebuild any UI component.

---

## What This Task Is

**Your** report from the original assignment table: **RPT-05 — Customer activity
report**, showing deposits, withdrawals, interest and net movement per customer. Same
pattern as M2's RPT-01, M3's RPT-02, M5's RPT-03/04 — a view plus a page built on M1's
report shell (I-7).

---

## T01 — `vw_rpt05_customer_activity`

Customer activity spans multiple accounts (a customer can be a holder on several), so
this view joins through `account_holder`:

```sql
CREATE VIEW vw_rpt05_customer_activity AS
SELECT
    c.customer_id,
    c.full_name,
    c.branch_id,
    a.account_id,
    a.account_number,
    t.transaction_id,
    t.transaction_type,
    t.amount,
    t.posted_at
FROM customer c
JOIN account_holder ah ON ah.customer_id = c.customer_id
JOIN account a ON a.account_id = ah.account_id
LEFT JOIN transaction t ON t.account_id = a.account_id AND t.status = 'POSTED';
```

Adjust the join once `transaction.posted_at` vs `transaction_date` naming is confirmed
against the final Phase 2/3 schema — check `docs/04_database-schema.md` before merging.

The report query in T02 aggregates this to one row per customer per range:
`SUM(amount) FILTER (WHERE transaction_type = 'DEPOSIT')`,
`SUM(amount) FILTER (WHERE transaction_type = 'WITHDRAWAL')`,
`SUM(amount) FILTER (WHERE transaction_type = 'INTEREST_CREDIT')`, and a computed **net**
(deposits + interest − withdrawals). Keep this aggregation in the report query, not the
view, so the view stays reusable for other date ranges.

A joint account's activity is attributed to **every** holder (a `WITHDRAWAL` on a joint
account appears once per holder via the `account_holder` join) — confirm this is the
intended semantic for "customer activity" versus attributing it only to the requester;
if ambiguous, raise it rather than guessing, since it changes the report's totals
materially for joint accounts.

---

## T02 — RPT-05 API, Page & CSV

### `GET /api/reports/customer-activity`
Follows the shared report contract from `docs/05_api-and-pages.md` §"Reports":

- **Roles** `BRANCH_MANAGER` (own branch), `CENTRAL_OPS`, `AUDITOR`, `ADMIN`
- **Query** `from`, `to`, `branchId`, `accountId`, `planId`, `status`, `format=json|csv`,
  `page`, `pageSize`
- **Validation** dates valid and ordered; `branchId` inside the caller's scope; sort
  column via `allowListed()`
- **SQL** query `vw_rpt05_customer_activity`, aggregated per customer, filtered by
  parameterized predicates **plus branch scope in the `WHERE` clause**
- **Success** `{ data: { rows, subtotals, grandTotal, filters, generatedAt,
  requestedBy } }`
- **CSV** identical query and identical totals to JSON (REP-COM-04); streamed
- **Audit** every access logged via M1's shared helper (REP-COM-06)
- **Page** `/reports/customer-activity`

### Step 1 — Confirm I-7 Is Published
```bash
grep -n "P05-M01-T01" docs/09_task-tracker.md
```

### Step 2 — Backend
`services/report-service.ts` (or a dedicated module, matching I-7's pattern):
`getCustomerActivityReport(filters, scope)`.

### Step 3 — Frontend
`app/reports/customer-activity/page.tsx` built on M1's report shell — filter bar,
results table (deposits/withdrawals/interest/net columns), CSV export.

### Step 4 — Write Tests
- `tests/db/rpt05-view.test.mjs`: totals match a manually seeded mixed transaction
  history per customer, including a customer who is a joint holder on multiple accounts
- `tests/api/rpt05-report.test.mjs`: CSV and JSON totals match exactly; `BRANCH_MANAGER`
  outside scope → 403; report access is logged
- Run `EXPLAIN ANALYZE`; confirm the date-range query uses
  `(account_id, transaction_date DESC)` or the customer/holder join path efficiently;
  record the plan in the PR description

### Step 5 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 6 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `vw_rpt05_customer_activity`
- Confirm `docs/05_api-and-pages.md` matches the built endpoint
- Run `/imprint` if new UI patterns are introduced
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Deposits, withdrawals, interest and net are all correctly aggregated per customer
- [ ] Joint-account attribution semantics are confirmed, not guessed
- [ ] CSV and JSON totals are identical for the same filters
- [ ] Branch scope enforced in SQL
- [ ] Report access audited via M1's shared helper
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
