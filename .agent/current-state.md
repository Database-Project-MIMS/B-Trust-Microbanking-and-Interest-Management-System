# Current State

**Last updated:** 2026-09-24 · **Updated by:** Member 3 (Nisith) after P01-M03-T02

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
- **P01-M03-T01 is complete and merged into `dev`** (PR #12): `savings_plan` table with
  the five G-13 eligibility columns (`min_age_years`, `max_age_years`, `min_holders`,
  `max_holders`, `requires_all_adult`), three named `CHECK` constraints, and the five
  BR-03…BR-07 seeded plans. `tests/db/savings-plan-constraints.test.mjs` — 8/8 passing.
  G-13 marked resolved in `docs/17_erd-gap-analysis.md`.
- **P01-M03-T02 is complete** (not yet merged — on branch
  `feat/p01-m03-plan-eligibility-function`): `fn_check_plan_eligibility(plan_id,
  date_of_birth, holder_count)` in `database/routines/`, a `STABLE` PL/pgSQL function
  checking the primary applicant's age and holder count against `savings_plan`'s data
  columns. Deliberately checks the primary applicant only — the full "every Joint holder
  is an adult" rule is Phase 2's `trg_validate_joint_mandate` (`P02-M03-T03`), since this
  function's signature carries one `date_of_birth`, not one per holder (see
  `docs/specs/0002-plan-eligibility-function.md`). `docs/07_business-rules.md`'s BR-07
  row corrected to reflect this boundary. `tests/db/plan-eligibility-function.test.mjs`
  — 10/10 passing, including a boundary test proving age is computed as whole completed
  years, not naive year subtraction. `db:rebuild`, `db:verify` and the full `npm test`
  suite (101/101) all pass.
- ADR-0006 defines `agent` as the shared branch-staff profile for `AGENT` and
  `BRANCH_MANAGER`; permissions come from `role`, and current scope comes from
  `agent.branch_id`.
- P01-M02-T03's six branch/agent route handlers, service layer, validation and 23 API
  tests are implemented. Least-privilege `mims_app` grants for `branch` and `agent` are
  present and the API suite passes through the normal application connection.

## What does NOT exist yet

Member 2's branch/agent administration pages have not been implemented. P01-M02-T03 is
waiting only for the shared audit contract from P01-M01-T05; P01-M02-T04 remains the UI
follow-up. Member 3's plan API/admin page (P01-M03-T03) has not been started.

## Task status snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 18 | IN PROGRESS — 9 DONE, 9 READY |
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
I-1 handoff, and adding a true request/SQL cross-branch test. P01-M02-T03 additionally
waits for P01-M01-T05's shared audit table and trigger contract.

## Known process note

The reconciled full suite passes 56/56, database verification and TypeScript checks pass,
and FD API tests leave no fixture rows behind. The remaining native-Windows `db:create`
setup issue is recorded in `.agent/handoffs/p01-cross-member-test-blockers.md`.

## Next session should start with

1. Member 1: complete P01-M01-T05 and publish the shared audit contract.
2. Integrate and test branch/agent audit coverage, then move P01-M02-T03 to `DONE`.
3. Member 3: open a PR for `feat/p01-m03-plan-eligibility-function` into `dev`, then
   start P01-M03-T03 (plan API and admin page) — depends on T02 (done) and I-1 (RBAC
   helpers, already merged).
