# Member 4 — context

**Updated:** 2026-10-05, authorized Phase 1 closeout.
Slice: [member prompt](../../docs/member-prompts/member-4.md).

## Current state

P01-M04-T01–T04 are verified DONE: hardened data access (I-2), transaction channels
0160, migration/rebuild proof and authenticated health. P02-M04-T01 immutable
transaction schema 0260 is verified DONE.
P03-M04-T01 is verified DONE: migration 0360 added transaction_reference_seq,
fn_next_transaction_reference(), UNIQUE constraint on transaction.reference_number
(G-05/ADR-0010), and partial unique index ux_transaction_idempotency (G-04).
P03-M04-T02 is verified DONE: migration 0361 added balance_after column (G-14),
procedure sp_post_deposit with pessimistic FOR UPDATE account lock, non-blocking
idempotency return, business-hours validation, atomic ledger insert, balance update
and audit logging. All 478 isolated tests pass.

## Closeout repairs

Exact migration filenames/checksums are verified, with atomic DDL/ledger writes.
Tests use disposable databases and copied migration fixtures. Health uses real
sessions and a service; infrastructure details/page require ADMIN/CENTRAL_OPS.
Mapped SQLSTATE uses lowercase sqlstate. See ADR-0013 and the closeout handoff.

## Next work and dependencies

P03-M04-T03 (sp_post_withdrawal) is next: lock, re-validate status/mandate/limits/minimum,
debit balance, ledger insert with negative-direction debit and audit logging (consumes I-4).

## Publication

Original ownership retained. Closeout edits are uncommitted; the user controls
commits, merges and PR creation.
Evidence: [checkpoint](../checkpoints/phase-01-checkpoint.md).
