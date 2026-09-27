# Current State

**Last updated:** 2026-09-27 · **Updated by:** Member 2 (Vibodha) after P01-M02-T03 audit integration

## Phase

**Phase 1 — Foundation, Master Data & Security.** Work is in progress.

## What exists right now

- PostgreSQL 18.6 is installed locally (Member 2) / 16.15 (Member 3, via Homebrew) and
  the migration framework is operational on both.
- Applied migrations include the shared foundation (`0000`), identity (`0100`), system
  parameters/audit (`0104`), branch schema (`0120`), agent schema (`0121`), organisation
  audit integration (`0122`), savings plan schema (`0140`) and FD plan schema (`0180`).
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
- **P01-M03-T02 is complete and merged into `dev`** (PR #15): `fn_check_plan_eligibility(plan_id,
  date_of_birth, holder_count)` in `database/routines/`, a `STABLE` PL/pgSQL function
  checking the primary applicant's age and holder count against `savings_plan`'s data
  columns. Deliberately checks the primary applicant only — the full "every Joint holder
  is an adult" rule is Phase 2's `trg_validate_joint_mandate` (`P02-M03-T03`), since this
  function's signature carries one `date_of_birth`, not one per holder (see
  `docs/specs/0002-plan-eligibility-function.md`). `docs/07_business-rules.md`'s BR-07
  row corrected to reflect this boundary. `tests/db/plan-eligibility-function.test.mjs`
  — 10/10 passing, including a boundary test proving age is computed as whole completed
  years, not naive year subtraction.
- **P01-M03-T03 is complete** (not yet merged — on branch
  `feat/p01-m03-plan-api-page`): full vertical slice for the plan admin API and page —
  `lib/validation/savings-plan.ts` (zod), `services/savings-plan-service.ts` +
  `savings-plan-errors.ts`, `app/api/plans/route.ts` (GET, any authenticated role),
  `app/api/plans/[id]/route.ts` (PATCH, ADMIN/CENTRAL_OPS, CSRF-checked),
  `app/plans/page.tsx` + `SavingsPlanClient.tsx` (first real data page styled with the
  new Material-3 tokens from the recent UI-integration PR, not the older token set
  `fd-products` uses). `tests/api/plans.test.mjs` — 9/9 passing: role gating enforced
  both client-side (hidden Edit button) and server-side (403 on direct PATCH), zod
  cross-field validation for same-request conflicts, DB `CHECK`-constraint re-validation
  for partial-update conflicts against the current row. Manually verified end-to-end via
  curl against a running dev server (real login, real role checks) — found and fixed a
  real gap along the way: `mims_app` had never been granted `SELECT`/`UPDATE` on
  `savings_plan` (`database/roles/01_app_grants.sql`, one line added following the
  existing per-member convention M2/M5 already used in that file). Also discovered
  (not fixed, out of scope, M1's `lib/auth`): `issueCsrfToken()` is never actually called
  from the login route anywhere in the codebase, so no page — including the
  already-merged `fd-products` — can currently complete a real CSRF-protected edit
  through an actual browser session. Worth the team's attention.
- ADR-0006 defines `agent` as the shared branch-staff profile for `AGENT` and
  `BRANCH_MANAGER`; permissions come from `role`, and current scope comes from
  `agent.branch_id`.
- **P01-M02-T03 is complete.** Its six branch/agent route handlers, service layer,
  validation and API tests are implemented. Least-privilege `mims_app` grants are
  present, and migration `0122` provides sanitized, same-transaction branch/agent audit
  coverage with rollback verification.

## What does NOT exist yet

Member 2's branch/agent administration pages have not been implemented. P01-M02-T04 is
the next Member 2 task. Member 3's Phase 1 slice (T01–T03) is fully done.

## Task status snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 19 | IN PROGRESS — 12 DONE, 7 READY |
| P2 | 16 | TODO (blocked on OQ-05) |
| P3 | 14 | TODO (blocked on OQ-08) |
| P4 | 14 | TODO (blocked on OQ-01, OQ-04) |
| P5 | 15 | TODO |
| P6 | 13 | TODO |

Full detail: `../docs/09_task-tracker.md`.

## Blocking items before Phase 1 can finish

No unresolved product question blocks Phase 1. Remaining I-1 quality follow-ups include
strict malformed-CSRF rejection, returning `branchId` in the login DTO, refreshing the
I-1 handoff, and adding a true request/SQL cross-branch test.

## Known process note

The full suite passes 120/120; database verification, TypeScript checks and the production
build pass. The clean rebuild command reaches the PostgreSQL administrator connection but
requires an interactive `postgres` password on this Windows host; rerun
`npm run db:rebuild` in the user's terminal for the final clean-from-empty proof. The
remaining native-Windows `db:create` setup issue is recorded in
`.agent/handoffs/p01-cross-member-test-blockers.md`.

## Next session should start with

1. Member 2: merge the T03 audit follow-up, then start P01-M02-T04.
2. Someone should raise the `issueCsrfToken()` gap
   found during this task's manual verification (see above) with Member 1, since it
   blocks a real end-to-end CSRF-protected edit on every admin page in the app, not
   just this one.
