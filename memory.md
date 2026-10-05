# Memory — MIMS

> Current state maintained by /remember save; no secrets or customer data.

**Last updated:** 2026-10-05
**Current phase:** Phase 1 verified; Phase 2 entry approved by Vibodha.

## What was completed

Resolved the Phase 1 exit blockers: authenticated/role-gated health service/page,
ADMIN parameter validation/CSRF/auditing, transaction-safe session creation,
configured sliding inactivity/absolute expiry, login origin checks, strict CSRF,
exact migration ledger verification, atomic migration DDL/ledger writes, portable
safe rebuild and Windows seed ordering. Tests no longer reset the development DB or
edit actual migrations. Tracker, phase/member summaries and checkpoint were reconciled.

## Decisions

ADR-0013 records isolated verification and restricted health details. User authorized
cross-member closeout; owners retain their files. Phase approval applies to the verified
working tree, not a published branch or lecturer approval. ADR-0007 remains the customer
identity contract: independent customer_id and optional unique app_user_id.

## Problems solved

- Mere-cookie health access and swallowed page authorization: real session + page role guard.
- Partial migration verification/destructive tests: exact ledger + disposable PG/fixtures.
- CRLF seed load order skipped files on Windows: trimmed lines before resolving paths.
- Session insertion outside caller transaction: shared executor; SQL expiry and cookie cap.
- Parameter route SQL/missing CSRF/weak inputs: service-owned locked transaction and validation.
- Mapped errors/PG18 RESTRICT assertion mismatch: preserved safe sqlstate and precise assertions.

## Current state

184 tests pass, 0 fail, 0 skipped; typecheck, lint, production build and clean rebuild pass.
All 11 local migrations verify. Existing dev data retained; pending migrations/grants
applied without reset. All 19 Phase 1 tasks verified; Phase 2 has 2 DONE, 1 READY, 13 TODO.
Full evidence: [.agent/checkpoints/phase-01-checkpoint.md](.agent/checkpoints/phase-01-checkpoint.md).

## Next session starts with

P02-M02-T01 customer schema is READY on existing `feat/p02-m02-customer-schema`.
Read the mandatory documents and architect the task; migration 0220 is free in M2's block.
Customer implementation has not started. Do not redo the completed Phase 1 verification
unless code changes or a new concern requires it.

## Constraints and open items

User prohibits assistant commits, merges and PR creation. Closeout is uncommitted;
user-controlled integration is still pending. No merged migration was edited.
Phase 3/4 retain OQ-12/OQ-13/OQ-14 and their own exit/entry approval gates; optional
customer credential provisioning needs OQ-11 before its UI. RLS/holder/mandate/financial
posting and full transactional seed sets remain future work.
