# Member 4 — context

**Updated:** 2026-10-08 · **Corrective checkout:** feat/p05-m02-rpt01-view · HEAD 48f4185

## Current withdrawal correction (supersedes historical next-task note below)

P03-M04-T03 original PR #61 merged, but RPT-01 verification found defects. Vibodha
explicitly authorized M4 corrective work and its documentation (ADR-0021). New M4
0363 retains 0362, fixes audit writes/calls and actual limit keys, validates exact
amount/channel/current actor/scope, supports I-4 array signers, trusted attribution
and serialized payload-bound retries. An audited attempt rolls back inner financial
effects, writes one outer rejection audit and returns a known code; T05 must commit
that result before mapping the safe error outside withTransaction.

T03 is verified locally, REVIEW: 21 guarded SQL regressions; combined **663 tests /62
suites**, 0 failures/skips, no exclusions, clean **34-migration** rebuild/checksums,
typecheck/lint/production build PASS. Same-key retries, competing debits, ALL_HOLDERS,
scope/precision/calendar/timezone and unexpected audit rollback pass. No new API/UI,
seed, shared auth edit or general phase approval. M4 retains ownership. Next M4
feature is T04 reversal after this correction is published; T05 service/API/CSRF/
signer-evidence work remains pending. M1 audit/runtime integration handoff retained.

Task card, overview, tracker, shared contracts and phase/state docs updated. /review
and /remember complete; no /imprint for unchanged UI. Normal DB untouched and
disposable clusters cleaned up. User owns staging/commit/push/PR/merge; include
P03-M04-T03 plus P05-M02-T01 and migrations 0363/0520 in the user-created PR.
[Repair handoff](../handoffs/p03-m04-withdrawal-contract-repair.md).

---

## Historical Phase 1/deposit context

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
