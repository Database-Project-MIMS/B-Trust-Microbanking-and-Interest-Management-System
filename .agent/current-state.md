# Current State

**Last updated:** 2026-09-19 · **Updated by:** Member 2 during P01-M02-T03

## Phase

**Phase 1 — Foundation, Master Data & Security.** Work is in progress.

## What exists right now

- PostgreSQL 18.6 is installed locally and the migration framework is operational.
- Applied migrations include the shared foundation (`0000`), identity (`0100`), branch
  schema (`0120`), agent schema (`0121`) and FD plan schema (`0180`).
- P01-M02-T01 and P01-M02-T02 are complete and merged into `dev`, including their
  database constraints, integrity triggers, indexes, tests and documentation.
- P01-M01-T01, P01-M01-T02 and P01-M01-T03 are recorded as complete. The reconciliation
  brings I-1's `agent.branch_id` session resolution and fail-closed profile guard from
  `main` into the integration work.
- P01-M05-T01 and P01-M05-T02 are complete; the reconciliation brings the FD product API
  work from `main` into the integration work.
- ADR-0006 defines `agent` as the shared branch-staff profile for `AGENT` and
  `BRANCH_MANAGER`; permissions come from `role`, and current scope comes from
  `agent.branch_id`.

## Work currently in progress

- P01-M02-T03 now has six branch/agent route handlers, parameterized services, Zod
  request validation, branch-scoped SQL predicates and 23 database-backed API tests.
- The tests pass with the owner connection. Runtime verification with `mims_app` is
  blocked until Member 1 adds branch/agent grants.
- Agent/branch audit integration waits for Member 1's P01-M01-T05 `audit_log` contract.
- P01-M02-T04 administration pages have not been implemented.

## Task status snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 18 | IN PROGRESS — 7 DONE, 10 READY, 1 IN_PROGRESS |
| P2 | 16 | TODO (blocked on OQ-05) |
| P3 | 14 | TODO (blocked on OQ-08) |
| P4 | 14 | TODO (blocked on OQ-01, OQ-04) |
| P5 | 15 | TODO |
| P6 | 13 | TODO |

Full detail: `../docs/09_task-tracker.md`.

## Blocking items before Phase 1 can finish

No unresolved product question blocks Phase 1. P01-M02-T03 has two cross-member completion
dependencies: the M1-owned `audit_log` implementation and runtime `mims_app` grants for
`branch`/`agent`. They are published in
`.agent/handoffs/p01-m02-t03-audit-and-grants.md`.

## Known process note

The reconciled full suite passes 56/56, database verification and TypeScript checks pass,
and FD API tests leave no fixture rows behind. The remaining native-Windows `db:create`
setup issue is recorded in `.agent/handoffs/p01-cross-member-test-blockers.md`.

## Next session should start with

1. Member 1 applies the audit/grant handoff.
2. Run the organisation API suite with the normal `mims_app` connection, then the full
   build, rebuild and test gates.
3. Run `/review`; move P01-M02-T03 to `DONE` only when every gate passes.
