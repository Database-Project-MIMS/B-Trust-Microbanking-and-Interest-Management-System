# ADR-0022 — RPT-01 API, screen and CSV integration

**Date:** 2026-10-08 · **Task:** P05-M02-T02 · **Branch:** feat/p05-m02-rpt01-api-ui
**Status:** approved scoped implementation

The user requested the next task and explicitly approved repairs to M1's shared
report interfaces. PR #67/#69 integrate T01 and I-7; base dev is 93a82f8.
This authorizes T02 only, not general Phase 5 entry. M1 retains shared ownership.

The report retains 0520 privately. New 0521 exposes execute-only, fixed-query
aggregation routines that validate current stored actor/context and enforce captured
posting-branch scope before reading facts. This avoids granting the private all-time
view or broadening raw ledger visibility. Existing transaction RLS is absent; global
transaction policies and operational writers remain M1/M4's separate integration
work. The report's database authorization boundary is the restricted aggregate
routine, with pinned search_path, no dynamic SQL and no PUBLIC execute. Direct runtime
calls must pass the same scope checks as service calls. No table shape changes.

Money and counts remain SQL NUMERIC/bigint decimal strings. Reversal direction comes
from transaction_reversal's original type. Unlinked/malformed historical reversals
make net explicitly unresolved; unattributed ledger rows are disclosed separately.
The roster preserves inactive profiles and transferred posting-branch history.

JSON is paginated. CSV uses the same filtered SQL and REPEATABLE READ snapshot,
fetches bounded batches into a private temporary spool, commits access auditing,
then streams with backpressure and cleanup. No database transaction spans network
delivery. Totals include page subtotal and filter grand total, even for empty pages.
Use shared typed reporting contracts, CSV encoding and UI primitives with existing
Emerald tokens. No shell/navigation or financial posting rewrite is authorized.
