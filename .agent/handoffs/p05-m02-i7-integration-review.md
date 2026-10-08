# P05-M02-T02 — I-7 integration review and implementation plan

**Date:** 2026-10-08 · **Consumer:** M2 · **Framework owner:** M1
**Branch:** feat/p05-m02-rpt01-api-ui · **Base:** dev 93a82f8
**Status:** approved by the user; implementation delivered locally, REVIEW (ADR-0022)

This document retains the pre-implementation investigation and plan. Its earlier
pending-approval/missing-file statements are historical. Final implementation,
verification, shared-file changes and unresolved integration failures are in
[the delivery handoff](p05-m02-rpt01-api-ui.md).

## Verified prerequisites

GitHub PR #67 is merged at 4095b38. RPT-01 migration 0520 and the authorized M4
withdrawal correction are integrated. The user requested implementation of T02,
authorizing this task's scoped start, without approving general Phase 5 entry.

PR #67's merge tree removed the I-7 files previously present in dev d466866 / PR #65,
along with other M1 files. They subsequently reappeared locally during this inspection.
These local changes, including the already-staged 0401 migration, were not made by
this task and must be preserved. Do not commit, push, reset or merge them automatically.

**Subsequent check:** PR #69 restored these files into dev, and PR #68 delivered
M4 interest-credit posting. After verifying no tracked changes or task-only commits
existed, the task branch was synchronized to existing dev commit 93a82f8, preserving
this untracked plan. The missing-file blocker is resolved. The framework interface
fixes below still await the outstanding cross-member approval; no M1 file was edited.

The user subsequently explicitly approved these repairs and completion of T02.
M1 retains ownership. The database scope boundary is an execute-only aggregate
routine, rather than a grant on the private 0520 view or a global transaction-policy
rewrite; see ADR-0022. No transaction is held open across network delivery.

## Required shared-framework changes

Approval was requested because AGENTS.md section 13 and .agent/ownership-map.md
reserve components/report to M1. No ownership transfer is proposed.

- lib/report/csv-export.ts currently receives an entire rows array and enqueues it
  in start(), so it does not provide bounded-memory, backpressure-aware export.
  Extend it to accept incrementally supplied rows, explicit columns, metadata and
  aligned totals. Escape quotes, CR/LF and spreadsheet formula prefixes; preserve
  exact decimal strings. Keep the existing call signature compatible where possible.
- components/report/report-export-button.tsx navigates to the page's query string,
  rather than the report API. Add an explicit endpoint and applied-filter contract.
- components/report/report-table.tsx uses any and raw property keys. Add typed
  column/accessor support, exact-value formatting and accessible headers.
- components/report/report-filters.tsx has unassociated labels and an inert Apply
  button. Use a real submit contract and existing input/button tokens.
- components/report/report-metadata.tsx uses the environment's timezone. Display
  Asia/Colombo and applied filters, including effective scope.
- lib/report/report-handler.ts auditReportAccess() writes through the global pool,
  uses a hardcoded IP and lacks a caller-transaction option. Add an optional required
  executor for atomic report preparation/auditing, retaining compatibility. Avoid
  importing server audit modules into shared client-facing type modules at runtime.

## Settled M2 implementation plan

1. Reconcile T01 to DONE based on PR #67, record T02 scoped authorization in an ADR,
   and mark T02 IN_PROGRESS once the required framework changes are authorized.
2. Validate strict query inputs: real ordered Colombo dates, UUID branch/agent,
   json/csv format, bounded page/pageSize and server-allow-listed sorting. Reject
   repeated/unknown parameters and out-of-scope branch requests.
3. Add a new M2 migration (next free 0521) for report runtime access and its database
   scope backstop; never edit merged 0520. Revalidate active stored actor/role/branch.
   Preserve the existing financial writers and operational visibility contracts.
4. Service-owned REPEATABLE READ preparation: set local context, filter captured
   posting branch and exact timestamps before the eligible-roster outer join, then
   calculate bigint counts and unbounded NUMERIC totals in SQL. Include inactive
   and transferred historical identities and range-specific zero rows.
5. Compute reversal-aware net using transaction_reversal's original ledger type;
   never infer reversal direction from a positive amount. Explicitly disclose
   unattributed rows and unresolved legacy reversal links rather than silently
   reporting an invented net. Count/money values remain strings.
6. JSON details are paginated, with clearly distinguished page subtotals and full
   filter grand totals. CSV exports the same complete filtered result and totals
   with bounded memory and one consistent snapshot. Finish DB preparation before
   network streaming; audit access before any report data is sent.
7. Thin authenticated route, private/no-store responses and safe mapped errors.
   Server-authorized report page, named scoped selectors, metadata, Apply/Retry,
   loading/empty/error states, exact values, pagination and CSV download. Reuse I-7
   and existing Emerald UI tokens; no shell/navigation rewrite.
8. DB/API negative tests for roles, scope, stale actors, transfers, time boundaries,
   huge totals, zeros, reversals, pagination/CSV parity and audit rollback/failure.
   Measure final query performance; run isolated rebuild/full tests/typecheck/lint/
   build and browser QA. Run /review, /imprint and /remember; update relevant docs.

Baseline typecheck passed after the shared files reappeared. This is investigation
evidence only: no T02 API/service/page or migration has been implemented or verified.
No assistant commit, push, PR creation or completed merge was performed.
