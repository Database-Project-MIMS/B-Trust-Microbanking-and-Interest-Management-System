# Current State

**Updated:** 2026-10-05 · **Owner:** M2 (Vibodha), P02-M02-T02/T03

## Current result

Customer-agent assignment and customer-document tasks are technically complete locally
on feat/p02-m02-customer-agent-document. Migration 0221 adds effective-dated history,
RESTRICT FKs/date check and partial uniqueness for current assignments. Migration 0222
adds document metadata, RESTRICT FKs and paired verification. Both mutable tables have
lifecycle timestamps/shared update triggers. verifyDocument is server-only with active
staff/branch/assignment checks, row locks and atomic paired verification/minimal audit.

## Evidence

verify:customer-agent-document passes 134 selected tests: 23 assignment, 23 document,
23 service/concurrency, 27 customer and 38 organization regressions. Zero failures/skips;
all 14 migrations rebuild from empty/reapply/verify, typecheck and lint pass. Disposable
PostgreSQL 18.6 cluster removed. Committing tests enforce the disposable DB name.
Normal development DB received 0221/0222 additively and verifies; no data reset.
Handoff: [relations/verification](handoffs/p02-m02-t02-t03-customer-agent-document.md).

## Task snapshot and next work

P0 6 DONE; P1 baseline 14 DONE/5 READY; P2 4 DONE/1 READY/11 TODO.
T01 customer schema was committed by the user before this branch. T02/T03 are technically
DONE locally; T04 registration service is READY with its table and I-1/I-2 dependencies.
T05 API/screen integration remains TODO. Other member statuses are unchanged.

Partial uniqueness guarantees at most one assignment; registration/reassignment must
supply existence. Customer services have no runtime grants until M1's scoped grants/RLS
land. Generic customer/child audit bindings are also M1 work. Service tests run as owner
in the disposable DB; they do not certify runtime RLS. Runtime API exposure must wait
for that integration. No customer registration endpoint or new UI was built here.

## Approval and publication

User Phase 2 approval remains recorded in the [historical checkpoint](checkpoints/phase-01-checkpoint.md).
Earlier uncommitted Phase 1 closeout repairs remain absent from this checkout. Today's
task-specific evidence does not recertify those missing repairs or the whole phase.
The destructive legacy migration-runner test was excluded from focused verification.

All current task changes remain uncommitted. No commit, push, merge or PR was performed,
per user instruction. Team review/publication remains user-controlled.
