# Memory — MIMS

> /remember save: current, non-sensitive continuation state.

**Updated:** 2026-10-05
**Task/branch:** P02-M02-T01 on feat/p02-m02-customer-schema.

## What was built

Migration 0220 creates customer with independent UUID and optional unique login
(ADR-0007), number/NIC/email uniqueness, branch/login RESTRICT FKs, past-date/status
checks, timestamp trigger, branch B-tree and full_name GIN trigram index.
Added 27 customer tests and safe disposable PostgreSQL verification command.
Updated schema/rule/index/task documentation and M1/M3 handoff; APIs/UI remain later tasks.

## Verification

65 selected tests pass (27 customer, 38 organization), 0 failed/skipped.
Clean rebuild of 12 migrations, repeat application/verification, typecheck and lint pass.
Migration 0220 is applied to local development DB without reset. Disposable cluster
was removed. See .agent/handoffs/p02-m02-t01-customer-schema.md for review/evidence.

## Decisions and constraints

User Phase 2 approval persists in this conversation. Current checkout initially lacked
the earlier uncommitted Phase 1 closeout changes/checkpoint; historical approval note
records that discrepancy. Do not claim the previous 184-test result for this checkout.
The old migration-runner test resets mims_dev and edits a real migration; excluded here.
No existing migration or other owner's implementation file was changed.
Customer app grants/RLS/audit binding remain M1 work; do not expose unscoped data.
User prohibits assistant commits, merges and PR creation. All current changes are uncommitted.

## Next session

P02-M02-T02 assignment and P02-M02-T03 document schema are READY; 0221/0222 free.
Registration requires both plus scoped access/audit. Implement only the requested task.
M3 holder and M1 RLS/audit work consume the stable customer table handoff.
Missing earlier closeout repairs still require user-controlled reconciliation before
claiming full integration readiness. Later phase decisions/entry approvals remain separate.
