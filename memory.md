# Memory — RPT-01 API, page and CSV

Last updated: 2026-10-08

## Current state

P05-M02-T02 is implemented locally on feat/p05-m02-rpt01-api-ui, base dev93a82f8.
The user explicitly approved T02 and M1 shared framework repairs (ADR-0022).
PR #67 merged T01/0520 and authorized M4 withdrawal correction; PR #69 restored I-7;
PR #68 delivered M4 interest posting. General phase entry remains pending.
The user subsequently authorized several local commits for this delivery using the
configured Git identity. Push, PR creation and merges remain user-controlled.

## Delivery and decisions

New0521 execute-only guarded SQL aggregate readers; private0520 unchanged. Stored
active report actor/context and manager profile/branch scope are enforced in SQL.
Exact count/money strings, captured posting branch, retained historical/zero agents,
linked-reversal signed net or unresolved disclosure, separate NULL-agent exclusions.
Service REPEATABLE READ preparation/audit commit together; JSON paginates, CSV
spools batches privately then streams after commit, cleaning on finish/cancel/error.
Live scoped route/page with named filters, applied metadata, totals, retry and export.
M1 ownership remains; approved typed I-7/audit/CSV changes documented in handoff.

## Verification

72 relevant tests /7 suites pass, clean40-migration isolated rebuild/checksums/grants/
seed checks, typecheck/lint/production build. Browser manager filter/zero/export/draft
versus applied filters/error/retry/mobile checks pass. Final function probe6.826ms
with20000 extra postings; underlying selective view index probe remains valid.

Full merged-tree suite767 tests:729 pass,27 fail,11 cancelled,0 skipped. Older M1
session/branch/audit fixtures and M4 untyped withdrawal overload calls fail. No
full-suite pass claimed; task stays REVIEW. Broader raw transaction RLS remains
M1/M4 integration work. Existing seeded manager profile gap required a disposable
browser fixture; normal developer database was preserved.

## Next session

Read .agent/handoffs/p05-m02-rpt01-api-ui.md and ADR-0022; inspect actual user
publication/review before reconciling REVIEW to DONE. Do not publish automatically.
Address documented full-suite integration failures through M1/M4 ownership.
Phase6 tasks wait for Phase5 integration/exit; do not infer general approval from T02.
Tracker reconciled97 tasks:31 TODO /1 REVIEW /65 DONE. /review, /imprint and overview
review recorded. All paths/evidence are local; no secrets are stored in memory.
