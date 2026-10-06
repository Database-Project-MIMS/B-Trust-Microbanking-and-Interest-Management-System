# Current State

**Updated:** 2026-10-06 · **Owner:** M2, PR #36 conflict resolution

## Current checkout

feat/p02-m02-customer-registration at c0f7659, local pending merge of origin/dev 76701e7.
Nine documentation conflicts reconciled, retaining customer/relation migrations and
registration/search/profile/validation services plus dev's Phase 1 closeout repairs.
No assistant commit, push or completed merge. Customer numbering/scope ADR renumbered
to 0014 to avoid dev's distinct ADR-0013; decision content is unchanged.

## Evidence

Original focused T04 evidence: 181 tests, clean 14-migration rebuild/reapply/verify,
typecheck/lint. Fresh combined-tree verification passed: 328 tests in 31 suites,
0 failures/skips; clean 14-migration rebuild, TypeScript, lint and production build.
[Resolution handoff](handoffs/p02-m02-t04-pr36-conflict-resolution.md).
The restored isolated full harness supports committing relation fixtures and disposable
SET ROLE app-role regressions; it never grants owner privileges to the app role.
The holder-contract test removes its own synthetic accounts before seed validation.
Normal development data is preserved; production grants/RLS are unchanged.

## Task snapshot in this PR

P0 6 DONE; P1 19 DONE; P2 6 DONE/1 BLOCKED/9 TODO; P3–P6 TODO.
M2 T01–T04 and M3 account/M4 transaction schemas are technically DONE.
T05 remains blocked on M1 scoped customer/child grants, RLS/audit coordination and
real API/screen binding. Customer screens remain prototypes; M3 account_holder absent,
so profile accounts is null. Owner-based tests do not certify runtime RLS.
Existing T03 role FOR SHARE issue remains recorded for narrowing before exposure.

## Approval and publication

Historical Phase 2 entry approval persists; restored closeout makes old missing-file
notes historical. No later phase approval or new UI. Incoming M1/M4 ownership retained;
test-harness integration and EOF-only cleanup documented before edits.
User commits/pushes/merges; local merge uses --no-commit. /imprint not applicable.
