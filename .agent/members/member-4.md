# Member 4 — context

**Updated:** 2026-10-05, authorized Phase 1 closeout.
Slice: [member prompt](../../docs/member-prompts/member-4.md).

## Current state

P01-M04-T01–T04 are verified DONE: hardened data access (I-2), transaction channels
0160, migration/rebuild proof and authenticated health. P02-M04-T01 immutable
transaction schema 0260 is verified DONE.
P03-M04-T01 is verified DONE: migration 0360 added transaction_reference_seq,
fn_next_transaction_reference(), UNIQUE constraint on transaction.reference_number
(G-05/ADR-0010), and partial unique index ux_transaction_idempotency (G-04). All 471
isolated tests pass.

## Closeout repairs

Exact migration filenames/checksums are verified, with atomic DDL/ledger writes.
Tests use disposable databases and copied migration fixtures. Health uses real
sessions and a service; infrastructure details/page require ADMIN/CENTRAL_OPS.
Mapped SQLSTATE uses lowercase sqlstate. See ADR-0013 and the closeout handoff.

## Next work and dependencies

P03-M04-T02 (sp_post_deposit) is next: pessimistic locking (FOR UPDATE), ledger insert,
balance update, balance_after calculation, and audit logging.

## Publication

Original ownership retained. Closeout edits are uncommitted; the user controls
commits, merges and PR creation.
Evidence: [checkpoint](../checkpoints/phase-01-checkpoint.md).
