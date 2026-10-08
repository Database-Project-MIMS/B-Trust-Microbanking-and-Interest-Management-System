# ADR-0016: Transaction attribution and a scoped early start

**Date:** 2026-10-08 · **Status:** user-authorized M2 implementation; M4/team review retained
**Task:** P03-M02-T01 · **Gap:** G-07

## Authorization and scope

After being told that T01's transaction-schema dependency is merged, while the
Phase 2 exit checkpoint and G-07 decision remain outstanding, Vibodha instructed
"so lets do them" and then "do the task now". This authorizes the prescribed G-07
schema and an early start for **P03-M02-T01 only**, overriding the general phase
entry restriction for this task. It is not a Phase 2 exit approval, general Phase 3
entry approval, or resolution of OQ-12/OQ-14/G-04/G-14. The user retains Git publication.

## Blueprint (/architect)

- Attribution is a posting-time snapshot, separate from the responsible login.
- Add nullable UUID `transaction.agent_id` and `transaction.branch_id`, with named
  foreign keys and `ON DELETE RESTRICT`, using M2 migration 0320.
- Use `ix_transaction_agent_date (agent_id, transaction_date)` and
  `ix_transaction_branch_date (branch_id, transaction_date)`, matching the physical
  schema and index inventory. The task card's `posted_at` is stale.
- Preserve existing ledger rows with NULL attribution. Do not backfill from current
  agent membership, disable immutability, add a derived view, or add a posting trigger.
- Preserve nullable values for unattributed/legacy/system entries. The future posting
  routines must capture authorized attribution inside their transaction; foreign keys
  alone do not enforce actor authorization, branch scope, or completeness.
- The migration runner owns the checksum ledger entry. Do not use the task card's
  obsolete `schema_migration(version, name)` insert.
- Test UUID/nullability, foreign keys, deletion restrictions, reporting indexes,
  least-privilege insertion, immutable attribution, upgrade preservation, rollback,
  and historical stability after agent transfer. Rebuild and run existing regressions.

T02 (daily activity endpoint/page) is a separate task and is not part of this change.
No existing M4 migration or M3 posting routine is edited. M4's transaction-schema
handoff already explicitly reserves these additions for M2; the outgoing handoff
documents producer obligations and remaining review.
