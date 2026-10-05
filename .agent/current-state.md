# Current State

**Updated:** 2026-10-05 · **Owner:** M2 (Vibodha), P02-M02-T01 session

## Current task result

P02-M02-T01 customer schema is technically complete locally on
`feat/p02-m02-customer-schema`. Migration 0220 adds independent customer UUID,
optional unique login, required unique number/NIC/email, restrictive branch/login
FKs, birth-date/status checks, timestamps and branch/name search indexes.
No customer registration API/UI, assignment/documents, RLS or permanent customer
seed rows are included.

## Evidence

`npm run verify:customer-schema`: 65 tests pass (27 customer + 38 organization),
0 fail, 0 skipped; all 12 migrations rebuild from empty, repeat application/verification,
typecheck and lint pass. Disposable PostgreSQL 18.6 cluster removed after use.
Normal development DB received 0220 additively and verifies; existing data was not reset.
Handoff: [customer schema](handoffs/p02-m02-t01-customer-schema.md).

## Approval and checkout condition

Vibodha approved Phase 2 entry in this conversation and requested this task. At session
start the clean checkout at 3fe8689 lacked the earlier uncommitted Phase 1 closeout
repairs/checkpoint. [Restored historical approval](checkpoints/phase-01-checkpoint.md)
records this condition and does not recertify the missing changes. The earlier 184-test
result is not claimed for the present tree. The legacy migration-runner test resets
mims_dev and edits an actual migration; it was excluded from this focused verification.

## Task snapshot

Tracker baseline plus this task: P0 6 DONE; P1 14 DONE/5 READY (existing rows,
not newly recertified); P2 2 DONE/2 READY/12 TODO. P3–P6 remain TODO.
P02-M03-T01 account was already recorded DONE. Other member task status changes
remain their owners' responsibility. Full status: [tracker](../docs/09_task-tracker.md).

## Next tasks

P02-M02-T02 customer_agent and P02-M02-T03 customer_document are READY.
Migration numbers 0221/0222 are available in M2's block. Registration must await both,
auditing and scoped runtime access. M1/M3 can consume the customer handoff for their
RLS/audit/holder work. The runtime app has no customer grants until M1 adds scope/RLS.

## Publication

No commit, merge or PR was created. Changes remain uncommitted under the user's
instruction. Team review/publication and reconciliation of the missing earlier Phase 1
closeout repairs remain user-controlled.
