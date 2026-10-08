# P05-M02-T02 — RPT-01 runtime, page and CSV

**Date:** 2026-10-08 · **Branch:** feat/p05-m02-rpt01-api-ui · **Base:** dev 93a82f8
**Status:** local REVIEW; user publication and integration review pending.

## Authorization and prerequisites

PR #67 merged T01/0520 and the approved M4 withdrawal correction at 4095b38.
PR #69 restored M1 I-7; PR #68 supplied M4 interest posting. The user explicitly
approved T02 and necessary M1 framework repairs (ADR-0022). M1 retains ownership
of components/report and the shared helpers. No general phase approval is inferred.
At implementation closeout the assistant had created no commit, push, PR or merge.
The user subsequently explicitly authorized several local commits for this delivery.
Commit groups: database/tests, backend/CSV/tests, UI/tests, documentation/status.
They use the repository's configured identity; push/PR/merge remain user-controlled.

## Delivered contract

- New migration0521 only: current stored actor/context scope guard and two narrow
  aggregate readers, pinned search_path, qualified relations, no PUBLIC EXECUTE.
  mims_app executes fixed scoped aggregates; private0520 remains unchanged.
- Inclusive Colombo dates and immutable posting branch filter facts before roster
  joins. Inactive/manager/transferred profiles and selected-range zero rows survive.
  Money and counts stay exact SQL strings. Reversal direction uses matching
  original account/type/amount; bad links make net unresolved. NULL-agent exclusion
  totals are explicit and independent of the agent filter.
- Thin authenticated GET route, strict/repeated/unknown filter rejection and static
  sort allow-list. Manager foreign branch rejects403 in service and direct SQL.
  Active stored user/role/profile/branch revalidation rejects stale identities.
- Service materializes rows and SQL page/grand totals in REPEATABLE READ and audits
  REPORT_ACCESSED in the same transaction. JSON paginates. CSV spools batches100
  to a generated private temporary file, commits before network delivery, pulls
  incrementally and cleans descriptors/spool on completion/cancel/error. Audit
  failure rolls back and cleans the spool before returning a safe500.
- Authorized page uses named selectors, applied metadata, exact LKR presentation,
  page subtotals/full-filter totals, pagination, zero/empty/loading/error/retry.
  CSV exports applied filters, never unapplied draft selector changes.

## Approved shared changes for M1 review / PR description

lib/report/report-handler now accepts an optional executor for atomic access
audits and avoids a fake IP or eager server imports into client type modules.
csv-export accepts async rows, explicit columns, notes and cleanup; output has
fixed-width records, formula protection, quoted CRLF and keyed totals. Its original
array-based call remains supported. ReportShell, Filters, Metadata, Table, Totals
and ExportButton now use typed columns, associated controls, an Apply contract,
Colombo display and an explicit API endpoint. report-format preserves exact cents.
Report code/named agent metadata are optional so other report owners can reuse I-7.
No ownership transfer or shared shell/navigation rewrite occurred.

## Verification and limitations

Relevant isolated run: **72 tests /7 suites pass**, 0 failures/cancellations/skips:
13 new runtime SQL, 15 new API, 4 new report-model cases plus prior view/activity
regressions. Clean **40-migration** empty rebuild/checksum/grants/seed verification,
typecheck, lint and production build pass. Subsequent UI metadata and cleanup-path
checks are included in final verification. Normal developer database is preserved.

Coverage includes direct SQL role/context/scope denial; retained historical staff;
date/timezone boundaries; linked reversals and unresolved legacy links; huge totals
beyond JS precise integers; empty pages/CSV; JSON/CSV keyed parity; full exports
despite pagination; audit failure; cancellation before and during file consumption;
context cleanup; unchanged financial state; and postings after CSV preparation.

Final function EXPLAIN ANALYZE completed in **6.826 ms** with 20,000 additional
out-of-range postings in the complete-suite run. Wrapper Function Scan does not
prove every internal bankwide plan uses an index. T01 selective underlying view
probe uses ix_transaction_agent_date without forcing the planner; M5 retains
bankwide representative tuning. No new index was necessary for these probes.

Browser checks on a synthetic disposable cluster: manager branch selector locked;
live values/metadata, date changes and selected-agent zero totals; actual downloaded
CSV preserved the applied three-row report despite a draft agent change; session
expiry produced safe error + Retry and restored session recovered. At375px the
document had no horizontal overflow (366px), and the1249px table scrolled inside
a277px container. No report console errors; existing GSAP missing-target warnings
and expected401 during the deliberate session-expiry check are recorded separately.
Screenshots/logs/EXPLAIN are ignored local artifacts in test-results.

**Complete suite remains failing:** 767 tests /78 suites;729 pass,27 fail,11
cancelled,0 skipped. Full run has no exclusions. The72-test supplementary run is
explicitly scoped and must not be called a full-suite pass. Exact unchanged files:

| Owner | Failing legacy files | Observed issue |
|---|---|---|
| M1 | tests/api/audit.test.mjs, cycle-config.test.mjs, interest-runs.test.mjs, reversal-auth.test.mjs | Session fixtures insert token hash into UUID session_id (22P02) |
| M1 | tests/api/business-rules.test.mjs; tests/db/business-hours-limits.test.mjs | Branch fixture omits required district (23502), cancelling child cases |
| M1 | tests/api/financial-audit.test.mjs; tests/db/financial-audit.test.mjs | Old audit DTO expectations / absent owner account fixture |
| M4 | tests/db/sp-reverse-transaction.test.mjs, transaction-running-balance.test.mjs | Old untyped withdrawal calls resolve ambiguously (42725) |

Logs: rpt01-full-final-verification.log and rpt01-scoped-final-verification.log.
Final applied-metadata/cleanup checks: rpt01-delivery-verification.log (72 pass,
typecheck/lint pass; first build hit Windows temporary-directory tracing), then
rpt01-delivery-build.log (build pass after retaining the generated absolute cleanup
path and validating its exact temporary root/name without resolving an unknown
path in the bundler), and rpt01-final-cleanup-api.log (34/34 final API cases).
Final compiled browser check confirms the named applied agent/order metadata;
proof screenshot: test-results/rpt01-report-final.png. Temporary previews/clusters
were shut down after verification.
Existing transaction raw-table RLS is absent despite NFR-SEC-07. The narrow reader
guard secures this report capability; it does not resolve the broader M1/M4 policy
requirement. This gap and legacy test failures are in open-questions and schema gaps.

## /review — three layers

1. Plan alignment: implemented scoped API/page, exact totals, snapshot CSV/auditing,
   reversal disclosure, negative tests and docs. General Phase5 entry stays pending.
2. System integrity: handwritten parameterized SQL, pg imports only lib/db,
   service-owned transaction, immutable merged migrations, exact money strings,
   approved shared ownership exception. Fixed generic report-code/metadata omission.
3. Production readiness: report checks/build/browser pass; cleanup/audit failure
   verified. Full integration acceptance remains blocked by the legacy issues above
   and broad raw-table RLS review. Do not mark DONE or claim ready-to-merge acceptance.

/imprint updated ui-registry; /remember saved current context; all five overview
tables reviewed. Tracker reconciles merged T01/M4 repair and incoming M4 Phase4
DONE rows:97 tasks =31 TODO /1 REVIEW /65 DONE. User owns push/PR/merge;
the later explicit authorization permits local commits for this delivery.
