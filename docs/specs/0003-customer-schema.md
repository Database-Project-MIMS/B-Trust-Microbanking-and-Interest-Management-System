# P02-M02-T01 — Customer schema blueprint

**Date:** 2026-10-05 · **Owner:** M2 · **Scope:** database only

## Approved design

The user explicitly requested this task after approving Phase 2 entry in this chat.
ADR-0007 and `2_Vibodha/04_P2-T01_customer-schema.md` settle the identity/column design:
customer identity is an independent UUID; login is a nullable unique app_user_id link.
Customer number, NIC/passport and email are required and unique. Branch is required;
branch/login references restrict deletion. Date of birth must precede CURRENT_DATE.
Status permits ACTIVE/INACTIVE. Mutable rows carry maintained timestamps.

No customer registration API, UI, assignment/document table, RLS or audit binding is
part of T01; those have separate tasks/owners. The generic vertical-slice checklist's
API/UI portions are not applicable to this specifically DB-only task. Publication
remains user-controlled under the explicit no-commit/no-merge/no-PR instruction.

## Implementation

1. Add immutable migration 0220 with named constraints, shared updated_at trigger,
   branch B-tree and name GIN trigram indexes; foundation 0000 already supplies pg_trgm.
2. Let the migration runner own its filename/checksum ledger entry. The task-card example's
   schema_migration(version,name) insert is incompatible with the actual ledger.
3. Verify constraints/optional login/FK deletion/index search/update timestamp and rollback
   using a real isolated PostgreSQL database; keep test fixtures synthetic and rolled back.
4. Rebuild with the existing command inside a disposable local PostgreSQL cluster only.
   The legacy migration-runner test is excluded because it resets mims_dev and edits an
   actual migration. Run safe organization regressions, typecheck and lint.
5. Update schema/index inventory/task state; publish a handoff for M1/M3 and M2's next task.

No app-role grants are added before M1 defines customer scope/RLS. M1 must add grants
and sanitized customer audit binding before registration becomes usable.

## Current checkout discrepancy

This checkout at 3fe8689 has the old Phase 1 documentation and lacks the earlier
uncommitted closeout repairs/checkpoint. Approval from this chat persists, but those
repairs are not claimed integrated or reverified here. Record this in open-questions
and the restored historical approval note; keep this change focused on customer schema.

## Result

Implemented 0220 and 27 customer tests. Isolated verification passes 65 tests, clean
12-migration rebuild, typecheck and lint. Normal development DB received 0220 without
reset and verifies. Review is recorded in the customer handoff. No API/UI, permanent
customer seed, other owner's implementation file, commit/merge/PR was added.
