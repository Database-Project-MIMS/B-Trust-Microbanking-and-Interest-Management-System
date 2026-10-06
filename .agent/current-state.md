# Current State

**Updated:** 2026-10-06 · **Owner:** M2, PR #36 conflict resolution

## Current checkout

feat/p02-m02-customer-registration at 5ef06fd, local pending merge of PR #35's updated
branch 888b983, which includes dev 2e338a6. PR #35 is not yet merged into dev; the user
requests PR #35 then PR #36. Nine current documentation conflicts reconciled,
retaining customer/relation migrations and
registration/search/profile/validation services plus dev's Phase 1 closeout repairs.
No assistant commit, push or completed merge. Customer numbering/scope ADR renumbered
to 0014 to avoid dev's distinct ADR-0013; decision content is unchanged.

Phase 1 is verified; Phase 2 has started. M3's P02-M03-T01 (`account`, migration
`0240`, `tests/db/account-constraints.test.mjs` 10/10) is DONE alongside M2's customer
schema.

## Preserved implementation

Original focused T04 evidence: 181 tests, clean 14-migration rebuild/reapply/verify,
typecheck/lint. Earlier combined-tree verification passed: 328 tests in 31 suites,
0 failures/skips; clean 14-migration rebuild, TypeScript, lint and production build.
[Resolution handoff](handoffs/p02-m02-t04-pr36-conflict-resolution.md).
The restored isolated full harness supports committing relation fixtures and disposable
SET ROLE app-role regressions; it never grants owner privileges to the app role.
The holder-contract test removes its own synthetic accounts before seed validation.
Normal development data is preserved; production grants/RLS are unchanged.
Fresh validation of the PR #35 dependency refresh passed: 328 tests in 31 suites,
0 failures/skips, clean 14-migration rebuild, TypeScript/lint/production build. See
[the new handoff](handoffs/p02-m02-t04-pr36-after-pr35.md).
ADR index and disposable SET ROLE harness remain as already reconciled in 5ef06fd.

## Task snapshot in this PR

P0 6 DONE; P1 19 DONE; P2 7 DONE/1 READY/1 BLOCKED/7 TODO; P3–P6 TODO.
T01 customer schema, T02 assignment, T03 documents and T04 registration (M2),
M3 account and M3-T02 `account_holder` (0241), and M4 transaction schemas are DONE.
M3-T03 is READY.
M2-T05 remains blocked on M1 scoped customer/child grants, RLS/audit coordination
and real API/screen binding. Customer screens remain prototypes. Owner-based tests
do not certify runtime RLS.
Existing T03 role FOR SHARE issue remains recorded for narrowing before exposure.
Historical Phase 2 entry approval persists; no later phase approval is inferred.

## Approval and publication

Historical Phase 2 entry approval persists; restored closeout makes old missing-file
notes historical. No later phase approval or new UI. Incoming M1/M4 ownership retained;
test-harness integration and EOF-only cleanup documented before edits.
User commits/pushes; merge PR #35 into dev before PR #36. Local merge uses --no-commit.
/imprint not applicable. No service, migration, test or harness changes in this refresh.
