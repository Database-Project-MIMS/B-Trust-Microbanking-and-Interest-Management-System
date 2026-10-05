# Current State

**Updated:** 2026-10-05 · **Owner:** M2 (Vibodha), P02-M02-T04

## Current result

Customer registration/search/profile services are technically complete locally on
feat/p02-m02-customer-registration. Strict validation and current actor checks precede
scoped parameterized SQL. Registration writes customer, unverified document metadata,
one active assignment and minimal audit atomically. Reads apply branch/assignment/self
scope and staff identity masking. No new migration, customer HTTP route or UI binding.
[Contract and /review](handoffs/p02-m02-t04-customer-registration.md).

## Evidence

npm run verify:customer-registration passes 181 selected tests (43 new service, 4 new
DB rollback, 134 regressions), zero failures/skips. All 14 migrations rebuild from empty,
reapply and verify; typecheck/lint pass. Disposable PostgreSQL 18.6 cluster removed.
Actual app-role test uses temporary disposable customer grants; it does not certify
production grants/RLS. Synthetic account_holder fixture verifies a future contract only.
Normal development database passed read-only migration verification; no reset or new DDL.

## Task snapshot and next work

P0 6 DONE; P1 retained baseline 14 DONE/5 READY; P2 5 DONE/1 BLOCKED/10 TODO.
T01–T03 were committed by the user before this task. T04 is technically DONE locally.
T05 runtime API/screen integration is BLOCKED pending M1 scoped customer/child grants,
RLS and audit coordination; service/controller development can consume this handoff.
Customer screens are prototypes in components/mims/workflow-screen.tsx. M3 account_holder
is absent, so profile accounts is null. No other member's implementation was changed.

M1 should coordinate audit triggers with T04's explicit minimal creation event and
transaction-local actor scope. Pre-existing T03 verifyDocument locks role FOR SHARE,
requiring a write grant absent from the runtime role: narrow that lock before exposure,
not permissions. T04 avoids that lock and passes an actual app-role service check.
Registration now guarantees assignment existence at commit; reassignment is future work.
Full phase exit/runtime demonstration remain incomplete.

## Approval and publication

User Phase 2 approval remains recorded in the historical checkpoint. Earlier uncommitted
Phase 1 closeout repairs are absent; this focused run does not recertify them or the phase.
The destructive legacy migration-runner test was excluded. All five overview tables were
reviewed; M2 row 06 marks only T04 complete. No UI change, so /imprint is not applicable.
Current T04 changes remain uncommitted. No assistant commit, push, merge or PR occurred;
team review/publication remain user-controlled under the explicit user instruction.
