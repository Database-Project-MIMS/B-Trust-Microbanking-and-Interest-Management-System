# Current State

**Last updated:** 2026-10-05 · **Updated by:** user-authorized Phase 1 closeout

## Phase and approval

Phase 1's 19 task implementations are verified. Vibodha explicitly requested resolving
the remaining checks, reconciling statuses and recording approval. Phase 2 entry is
approved for this verified local tree; see [checkpoint](checkpoints/phase-01-checkpoint.md).
This records Vibodha's approval, not lecturer/team approval or Git integration.

## Verified state

- All 11 numbered migrations rebuild from empty in a disposable PostgreSQL 18.6 cluster.
- 184 tests pass, 0 fail, 0 skipped; typecheck, lint and production build pass.
- Existing local development data was retained: pending 0160/0240/0260 migrations and
  grants were applied additively. Exact migration filename/checksum verification passes.
- I-1 authentication/RBAC/SQL scope/CSRF, I-2 data access and I-8 seed framework exist.
- Health validates sessions; only ADMIN/CENTRAL_OPS see infrastructure details.
- ADMIN parameter edits are validated, CSRF-protected, locked and atomically audited.
- Session creation/audit writes use the caller transaction. SQL enforces configured
  inactivity/absolute deadlines; active sessions refresh within the absolute cap.
- Migration/rebuild tests use disposable databases and fixture copies. Windows seed
  ordering handles CRLF. Applied migration files were not edited.

## Task snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 19 | DONE in verified local tree |
| P2 | 16 | 2 DONE, 1 READY, 13 TODO |
| P3 | 14 | TODO; Phase 2 exit and OQ-12/OQ-14 gates |
| P4 | 14 | TODO; Phase 3 exit and OQ-13/OQ-14 gates |
| P5 | 15 | TODO |
| P6 | 13 | TODO |

P02-M03-T01 account and P02-M04-T01 immutable transaction schemas are DONE.
Customer, holder, mandate, RLS and financial posting work remains pending.
Full tracker: [09_task-tracker.md](../docs/09_task-tracker.md).

## Next task

**P02-M02-T01 — customer schema is READY**, on existing
`feat/p02-m02-customer-schema`. Use migration 0220 in M2's reserved block and
ADR-0007: independent customer_id, optional unique app_user_id. No customer schema
implementation was added in this session. Customer assignment/document work follows;
M1 RLS/audit and M3 holder work depend on the customer table.

## Publication and ownership

All closeout edits remain uncommitted. Do not commit, merge or create a PR without
the user's instruction. Cross-member repairs are documented in
[handoff](handoffs/phase-01-closeout-2026-10-05.md); ownership is unchanged.
Other checkouts must receive these repairs before relying on the checkpoint.

## Repeat verification

`npm run verify:phase1` provisions/removes an isolated local PostgreSQL cluster.
`npm test`, `npm run test:db` and `npm run test:api` use the same isolation.
Set PG_BIN if local PostgreSQL binaries are outside the Windows discovery locations/PATH.
The complete local result is in ignored `test-results/phase1.log`.
