# Phase 5 — RPT-01 Agent-Wise Transaction Report

**Task IDs:** `P05-M02-T01`, `P05-M02-T02`
**T01 branch:** `feat/p05-m02-rpt01-view`
**Migration:** `0520_p05_m02_rpt01_view.sql`
**Status:** T01 local REVIEW (663 tests /62 suites combined verification); T02 TODO, pending I-7/CSV/access auditing
**Dependencies:** T01 needs merged P03-M02-T01. T02 needs T01 and M1's I-7.

Vibodha authorized a database-only early start on 2026-10-08 (ADR-0020).
General Phase 5 entry remains pending. Existing report UI is outside this T01 task;
no API, CSV exporter, audit helper or screen integration is delivered by T01.

## T01 — `vw_rpt01_agent_transactions`

The authoritative definition lives in migration 0520. Each row groups by agent,
captured posting branch, type and exact `transaction_date`, retaining timestamps
for arbitrary range filtering before final totals. The result includes current
profile metadata (`agent_id`, `employee_no`, `agent_name`, `agent_status`,
`agent_branch_id`, `agent_branch_name`) and posting facts (`branch_id`, `branch_name`,
`transaction_type`, `transaction_date`, bigint `transaction_count`, unbounded NUMERIC
`total_value`). Return money/count strings from the future API.

Every `agent` attribution profile is retained, including inactive and manager staff
profiles (ADR-0006). Current role changes do not erase history. NULL ledger agent
attribution is excluded; NULL posting branches remain bankwide facts and must not
be inferred from current membership. REVERSAL stays a separate positive amount
category; this task does not invent signed net movement.

The view's LEFT JOIN uses COUNT(transaction_id) and COALESCE(SUM(amount), 0.00),
so profiles with no attributed history have an undated zero row. Agents with
history outside a selected range need the consumer's roster outer join below.
An all-time aggregate cannot accept a later date filter; WHERE date filtering after
an outer join also removes zero rows. The old `posted_at` / `idx_transaction_agent_posted`
examples are superseded by `transaction_date` / `ix_transaction_agent_date` (0320).

The view is SECURITY INVOKER + SECURITY BARRIER and owner-only. M1/T02 must establish
current-caller authorization, underlying RLS, scoped SQL, grants and access auditing
before runtime SELECT is enabled. Existing transaction table access alone does not
make the new view a safe runtime report.

## Selected-range SQL contract for T02

This owner-executed shape is covered by `tests/db/rpt01-view.test.mjs`. `$1` is an
optional agent ID, `$2`/`$3` are inclusive validated Colombo dates and `$4` is the
**server-authorized** effective branch ID (NULL only for an authorized bankwide
request). Date and branch predicates select facts before the roster outer join.
A branch roster includes current members plus transferred identities with matching
posting-branch history in the selected range. For branch reports, display the
requested posting branch, not another branch's current roster metadata.

```sql
WITH filtered AS (
    SELECT agent_id, transaction_type, transaction_count, total_value
    FROM vw_rpt01_agent_transactions
    WHERE ($1::uuid IS NULL OR agent_id = $1)
      AND transaction_date >= ($2::date::timestamp AT TIME ZONE 'Asia/Colombo')
      AND transaction_date < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
      AND ($4::uuid IS NULL OR branch_id = $4)
)
SELECT a.agent_id, a.employee_no, a.full_name AS agent_name, f.transaction_type,
       COALESCE(SUM(f.transaction_count), 0)::text AS transaction_count,
       COALESCE(SUM(f.total_value), 0.00)::text AS total_value
FROM agent AS a
LEFT JOIN filtered AS f ON f.agent_id = a.agent_id
WHERE ($1::uuid IS NULL OR a.agent_id = $1)
  AND ($4::uuid IS NULL OR a.branch_id = $4
       OR EXISTS (SELECT 1 FROM filtered AS history WHERE history.agent_id = a.agent_id))
GROUP BY a.agent_id, a.employee_no, a.full_name, f.transaction_type
ORDER BY a.employee_no, a.agent_id, f.transaction_type;
```

Do not sum current-branch metadata as financial attribution or interpret NULL type
on a zero row as a new ledger type. T02 may pivot the four type categories and add
labelled subtotals/grand totals in SQL. Reversal-aware signed net requires M4's
reversal contract. The report must disclose unattributed legacy/system rows rather
than claiming these agent totals reconcile to *all* ledger rows.

EXPLAIN ANALYZE evidence for a selective agent/time view query is recorded in the
T01 handoff and ignored `test-results/rpt01-view-explain.json`. No new index or
planner forcing is used. T02/M5 must measure the final scoped/paginated/CSV query
on representative data; a selective probe is not full report performance acceptance.

## T02 — API, screen integration and CSV (pending)

`GET /api/reports/agent-transactions` follows `docs/05_api-and-pages.md` Reports:

- Roles: BRANCH_MANAGER own branch, CENTRAL_OPS, AUDITOR, ADMIN.
- Validated filters: dates, branchId, agentId, format=json|csv, page and pageSize;
  sort identifiers come from a server allow-list.
- Revalidate current stored identity and enforce the server's effective branch in
  SQL. Reject out-of-scope branch requests with 403; do not filter fetched rows.
- Success includes rows, subtotals, grandTotal, filters, generatedAt and requestedBy.
- JSON and streamed CSV share the same filtered query/snapshot and exact totals.
- Use M1's I-7 CSV and report-access audit helpers; do not duplicate the framework.
- Integrate the existing screen after checking the shared framework handoff.
- Add API tests for authorization, date filters, JSON/CSV parity and access audits.
- Measure the final query and reconcile attributed totals/unattributed exclusions.

## Acceptance by task

T01: timestamp/type/posting-branch view, exact totals, tested filtered-range zeros,
transfer/NULL/inactive-profile regressions, denied runtime grant, measured selective
index use, clean rebuild/full tests/typecheck/lint/build, updated docs and handoff.
T01 is REVIEW after local verification, pending user publication and teammate review.

T02: authorized API, page integration, metadata/subtotals/grand totals, reversal-aware
net, matching streamed CSV and audited access, API tests and final-query performance.
T02 remains TODO until T01 is merged and I-7/CSV/access auditing are published.
