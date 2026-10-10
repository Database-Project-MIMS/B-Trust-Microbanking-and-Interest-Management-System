# Current publication status — 2026-10-08

P05-M02-T02 is merged into dev through PR #74 and is DONE in the tracker.
The delivery/review evidence below is historical; the previously reported full-suite
integration gaps are resolved in the P06-M02-T01 integration repair handoff.
P06-M02-T01 is now the separately authorized
seed-validation task. No general phase approval is inferred from this merge.

# Phase 5 — RPT-01 Agent-Wise Transaction Report

**Task IDs:** P05-M02-T01, P05-M02-T02
**T01:** DONE, migration0520 merged in PR #67 at4095b38.
**T02 branch:** feat/p05-m02-rpt01-api-ui · base dev93a82f8
**T02 migration:** 0521_p05_m02_rpt01_runtime.sql
**T02 status:** local REVIEW; relevant verification passes, integration review/user publication pending.

Vibodha approved the scoped T02 start and necessary shared M1 repairs in ADR-0022.
I-7 was restored by PR #69. General Phase5 entry remains pending. M1 retains shared
framework ownership; see the integration handoff for explicit cross-member changes.

## Database contract

Merged0520 stays unchanged/private. Its invoker/barrier view retains exact posting
branch/type/timestamp facts and current profile metadata for all attribution identities.
New0521 adds fn_rpt01_scope, fn_rpt01_rows and fn_rpt01_exclusions. Stored active
actor/role/context and active manager profile/branch are checked in SQL. PUBLIC
EXECUTE is revoked; mims_app receives only fixed aggregate-reader execution.
Narrow definer readers pin search_path and qualify relations. Broader raw transaction
RLS remains a recorded M1/M4 gap; this task does not change writer visibility.

Date/branch/optional-agent predicates select facts before the roster outer join.
Inclusive Colombo dates use half-open timestamp bounds. Inactive/manager profiles,
transferred historical identities and range-specific zeros are preserved. Bankwide
NULL posting branches remain NULL; no attribution is inferred from current membership.

Counts and unbounded NUMERIC sums remain strings. Rows pivot deposits, withdrawals,
interest and unsigned reversals. Net = deposits + interest − withdrawals + linked
withdrawal reversals − linked deposit/interest reversals. Valid original links match
account/amount/type; absent/invalid links produce NULL detail net / UNRESOLVED totals.
NULL-agent exclusions cover selected dates/branch independently of the agent filter.

## API, screen and CSV

GET /api/reports/agent-transactions serves ADMIN, CENTRAL_OPS, AUDITOR and current
own-branch BRANCH_MANAGER. Strict filters: from/to, branchId/agentId UUIDs,
format=json|csv, page1–1000000, pageSize1–100, sort employeeNo|agentName|netTotal,
direction asc|desc. Repeated/unknown keys fail400; foreign manager scope fails403.
Active stored identity is revalidated inside the service transaction.

Preparation materializes rows and SQL page/grand totals in REPEATABLE READ, audits
REPORT_ACCESSED on the same executor, then commits. JSON details paginate; CSV
exports all matching rows from a private temporary spool written in batches100.
Network streaming follows commit, respects backpressure and cleans up on completion,
cancellation/error. Audit failure rolls back preparation and deletes the spool.
CSV metadata/notes/details/subtotals/grand totals have aligned explicit columns,
quoted CRLF and formula protection while signed decimal strings stay exact.

The live report page reuses I-7, named scoped selectors and Emerald UI tokens.
Metadata shows applied period/scope/agent/order, generation time and requesting user.
Details, page subtotal and full-filter grand total are distinct. Loading/zero/empty/
error/retry states, pagination and actual API CSV download are implemented. Export
uses applied filters despite draft selector changes; financial values use no JS arithmetic.

## Verification and acceptance

72 relevant tests /7 suites pass (13 new runtime DB +15 new API +4 report-model
cases and existing view/activity regressions), clean40-migration disposable rebuild,
checksums/grants/seed checks, typecheck, lint and production build. Browser manager
filter/zero/download/applied-filter/error/retry/mobile checks pass. The final SQL
function measured6.826ms with20000 extra postings; underlying selective view probe
uses ix_transaction_agent_date without planner forcing. Bankwide tuning stays with M5.

Full merged-tree suite:767 tests,729 pass,27 fail,11 cancelled,0 skipped. Legacy
M1 session/branch/audit fixtures and M4 ambiguous withdrawal callers are documented
in the handoff; no full-suite pass or general phase approval is claimed. Broader
transaction RLS remains an integration gap. T02 stays REVIEW, not DONE.

/review, /imprint and /remember recorded; all five overviews reviewed. No assistant
publication at implementation closeout. The user subsequently authorized several
local commits; push/PR/merge and teammate integration review remain pending.
See ../.agent/handoffs/p05-m02-rpt01-api-ui.md and ADR-0022.
