# 🔴 Phase 5 — Tasks 01–02: RPT-01 Agent-Wise Transaction Report
**Task IDs:** `P05-M02-T01`, `P05-M02-T02` · **Branch:** `feat/p05-m02-rpt01-agent-transactions`
**Migration:** `0520_p05_m02_rpt01_view.sql` · **Status:** TODO
**Depends on:** `P03-M02-T01` (transaction attribution, this slice), **I-7** (report shell from M1)
**Story Points:** ~3 + ~4 = ~7 · **Layer:** Database + Backend + Frontend

---

## What This Task Is

This is **your** report from the original assignment table: **RPT-01 — Agent-wise
transaction totals**. It's a view + the report page built on M1's report shell (I-7).
Wait for M1 to publish the report-module interface before starting T02.

---

## T01 — `vw_rpt01_agent_transactions`

```sql
CREATE VIEW vw_rpt01_agent_transactions AS
SELECT
    a.agent_id,
    a.employee_no,
    a.full_name       AS agent_name,
    a.branch_id,
    b.branch_name,
    t.transaction_type,
    COUNT(*)          AS transaction_count,
    SUM(t.amount)     AS total_value
FROM agent a
JOIN branch b        ON b.branch_id = a.branch_id
LEFT JOIN transaction t ON t.agent_id = a.agent_id
GROUP BY a.agent_id, a.employee_no, a.full_name, a.branch_id, b.branch_name, t.transaction_type;
```

- `LEFT JOIN` so agents with zero transactions in the filtered range still appear with
  zero counts — RPT-01 is "agent-wise total number and value," which implies every
  agent, not just active ones.
- The report API layer (T02) applies the `from`/`to` date filter and branch scope on top
  of this view — keep the view itself filter-free so it stays reusable, and push the
  `posted_at BETWEEN $1 AND $2` predicate into the query that selects from it.
- Run `EXPLAIN ANALYZE` against the `idx_transaction_agent_posted` index from Phase 3 to
  confirm the date-range filter uses it (this view alone won't demonstrate the index —
  the filtered query in T02 will).

---

## T02 — RPT-01 API, Page & CSV

### `GET /api/reports/agent-transactions`
Follows the shared report contract from `docs/05_api-and-pages.md` §"Reports":

- **Roles** `BRANCH_MANAGER` (own branch), `CENTRAL_OPS`, `AUDITOR`, `ADMIN`
- **Query** `from`, `to`, `branchId`, `agentId`, `format=json|csv`, `page`, `pageSize`
- **Validation** dates valid and ordered; `branchId` inside the caller's scope; sort
  column via `allowListed()`
- **SQL** query `vw_rpt01_agent_transactions`, filtered by parameterized predicates
  **plus the branch-scope predicate in the `WHERE` clause**
- **Success** `{ data: { rows, subtotals, grandTotal, filters, generatedAt,
  requestedBy } }` (REP-COM-01, REP-COM-03)
- **CSV** identical query and identical totals to the JSON path (REP-COM-04); streamed,
  not buffered (REP-COM-05)
- **Audit** every report access is logged (REP-COM-06) — call M1's report-access audit
  helper from I-7, don't reimplement it
- **Errors** `403` for a branch outside scope
- **Page** `/reports/agent-transactions`

### Step 1 — Confirm I-7 Is Published
```bash
grep -n "P05-M01-T01" docs/09_task-tracker.md
```
M1's report shell (filters, scope, CSV export, generation metadata) must exist before
you build on it — do not reimplement CSV streaming or access auditing yourself.

### Step 2 — Backend
`services/report-service.ts` (or a dedicated `agent-transactions-report-service.ts` if
the report shell expects per-report modules — match whatever pattern I-7's handoff
describes): `getAgentTransactionsReport(filters, scope)`.

### Step 3 — Frontend
`app/reports/agent-transactions/page.tsx` built on M1's report shell components —
filter bar, results table with subtotals/grand total, CSV export button.

### Step 4 — Write Tests
- `tests/db/rpt01-view.test.mjs`: view returns zero-count rows for agents with no
  transactions in range; totals match a manually seeded set
- `tests/api/rpt01-report.test.mjs`: CSV and JSON totals match exactly (REP-COM-04);
  `BRANCH_MANAGER` outside scope → 403; report access is logged
- Run `EXPLAIN ANALYZE` before/after confirming the date-range query uses
  `idx_transaction_agent_posted` — record the plan in the PR description (Phase 5's
  M5-parallel task `P05-M05-T04` does this systematically; do the same for your one
  report)

### Step 5 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 6 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `vw_rpt01_agent_transactions`
- Confirm `docs/05_api-and-pages.md` matches the built endpoint
- Run `/imprint` if the report page introduces new UI patterns
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] View includes agents with zero transactions in a filtered range
- [ ] Report query uses the reporting index (confirmed via `EXPLAIN ANALYZE`)
- [ ] CSV and JSON totals are identical for the same filters
- [ ] Branch scope enforced in SQL
- [ ] Report access is audited via M1's shared helper, not a bespoke one
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
