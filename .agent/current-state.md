# Current State

**Last updated:** 2026-09-19 · **Updated by:** Member 3 (Nisith) after P01-M03-T01

## Phase

**Phase 1 — Foundation, Master Data & Security.** Work is in progress.

## What exists right now

- PostgreSQL 18.6 is installed locally (Member 2) / 16.15 (Member 3, via Homebrew) and
  the migration framework is operational on both.
- Applied migrations include the shared foundation (`0000`), identity (`0100`), branch
  schema (`0120`), agent schema (`0121`), savings plan schema (`0140`) and FD plan schema
  (`0180`).
- P01-M02-T01 and P01-M02-T02 are complete and merged into `dev`, including their
  database constraints, integrity triggers, indexes, tests and documentation.
- P01-M01-T01, P01-M01-T02 and P01-M01-T03 are recorded as complete. The reconciliation
  brings I-1's `agent.branch_id` session resolution and fail-closed profile guard from
  `main` into the integration work.
- P01-M05-T01 and P01-M05-T02 are complete; the reconciliation brings the FD product API
  work from `main` into the integration work.
- **P01-M03-T01 is complete** (not yet merged — on branch
  `feat/p01-m03-savings-plan-schema`): `savings_plan` table with the five G-13
  eligibility columns (`min_age_years`, `max_age_years`, `min_holders`, `max_holders`,
  `requires_all_adult`), three named `CHECK` constraints, and the five BR-03…BR-07
  seeded plans. `tests/db/savings-plan-constraints.test.mjs` — 8/8 passing. G-13 marked
  resolved in `docs/17_erd-gap-analysis.md`. `db:rebuild`, `db:verify` and the full
  `npm test` suite (64/64) all pass.
- ADR-0006 defines `agent` as the shared branch-staff profile for `AGENT` and
  `BRANCH_MANAGER`; permissions come from `role`, and current scope comes from
  `agent.branch_id`.

## What does NOT exist yet

Member 2's branch/agent APIs and branch/agent administration pages have not been
implemented. P01-M02-T03 remains their next task. Member 3's `fn_check_plan_eligibility`
(P01-M03-T02) and the plan API/admin page (P01-M03-T03) have not been started.

## Task status snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 18 | IN PROGRESS — 8 DONE, 10 READY |
| P2 | 16 | TODO (blocked on OQ-05) |
| P3 | 14 | TODO (blocked on OQ-08) |
| P4 | 14 | TODO (blocked on OQ-01, OQ-04) |
| P5 | 15 | TODO |
| P6 | 13 | TODO |

Full detail: `../docs/09_task-tracker.md`.

## Blocking items before Phase 1 can finish

No unresolved product question blocks Phase 1. The core I-1 dependency needed by
P01-M02-T03 is present in this reconciliation. Remaining I-1 quality follow-ups include
strict malformed-CSRF rejection, returning `branchId` in the login DTO, refreshing the
I-1 handoff, and adding a true request/SQL cross-branch test.

## Known process note

The reconciled full suite passes 56/56, database verification and TypeScript checks pass,
and FD API tests leave no fixture rows behind. The remaining native-Windows `db:create`
setup issue is recorded in `.agent/handoffs/p01-cross-member-test-blockers.md`.

## Next session should start with

1. Commit and push this reconciliation from `vibodha`, then open a pull request into
   `dev` for review.
2. After that pull request merges, update `feat/p01-m02-branch-agent-apis` from `dev`.
3. Continue P01-M02-T03 using the integrated I-1 helpers.
4. Member 3: open a PR for `feat/p01-m03-savings-plan-schema` into `dev`, then start
   P01-M03-T02 (`fn_check_plan_eligibility`) — data-driven join against the new
   eligibility columns, never a hardcoded `plan_name` branch.
