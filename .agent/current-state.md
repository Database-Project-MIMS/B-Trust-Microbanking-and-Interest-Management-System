# Current State

<<<<<<< Updated upstream
**Last updated:** Phase 0, initialization session · **Updated by:** lead
=======
**Last updated:** 2026-09-18 · **Updated by:** Member 2
>>>>>>> Stashed changes

## Phase

**Phase 0 — Project Initialization.** Not yet approved to begin Phase 1.

## What exists right now

<<<<<<< Updated upstream
- Full documentation set (18 numbered docs, 7 phase docs, 5 member prompts)
- Shared migration `0000_p00_shared_foundation.sql` — domains, extensions, migration
  ledger table. **Not yet applied to any real database** (no PostgreSQL instance in this
  environment — see `docs/10_local-setup.md`).
- `lib/db`, `scripts/`, minimal `app/` shell — scaffolding only, no business logic
- `.claude/skills/` — five skills installed from upstream, verified
- No `git` repository yet in this delivery (see note below)

## What does NOT exist yet

Nothing beyond migration `0000`. No business table, no routine, no route handler beyond
`/api/health`, no seed data, no test beyond syntax-checking the scripts.
=======
- PostgreSQL 18.6 is installed locally and the migration framework is operational.
- Applied migrations include the shared foundation (`0000`), identity (`0100`), branch
  schema (`0120`), agent schema (`0121`) and FD plan schema (`0180`).
- P01-M02-T01 is complete: the `branch` table, unique branch-code constraint, status
  enforcement, timestamps, trigger, database tests and documentation are present.
- P01-M02-T02 is complete by developer approval: its agent subtype schema, constraints,
  integrity triggers, index, database tests and documentation are present and verified;
  its pull request has been merged into `dev`.
- ADR-0006 defines `agent` as the shared branch-staff profile for `AGENT` and
  `BRANCH_MANAGER`; permissions come from `role`, and current scope comes from
  `agent.branch_id`.
- The repository is under Git control; Member 2 confirmed a pull request for T01 exists.

## What does NOT exist yet

Member 2's branch/agent APIs and branch/agent administration pages have not been
implemented yet. P01-M02-T03 is waiting for M1 to correct and republish I-1 using the
branch-staff contract. Full detail remains in `../docs/09_task-tracker.md`.
>>>>>>> Stashed changes

## Task status snapshot

| Phase | Tasks | Status |
|---|---|---|
| P0 | 6 | DONE |
| P1 | 18 | READY |
| P2 | 16 | TODO (blocked on OQ-05) |
| P3 | 14 | TODO (blocked on OQ-08) |
| P4 | 14 | TODO (blocked on OQ-01, OQ-04) |
| P5 | 15 | TODO |
| P6 | 13 | TODO |

Full detail: `../docs/09_task-tracker.md`.

## Blocking items before Phase 1 can *finish* (do not block it from *starting*)

No unresolved product question blocks Phase 1. Member 2's current API task is nevertheless
blocked by the defective I-1 implementation: session resolution reads nonexistent
`app_user.branch_id`, and its authorization tests do not exercise production helpers.

## Known process note

This repository was assembled inside an isolated Claude session with no pre-existing git
history and no PostgreSQL server available for live verification. Migrations were
syntax-reviewed and the runner script was logic-checked, but **no migration has been
executed against a real database.** The first task of Phase 1 for every member should be
running `npm run db:rebuild` for real, in a real Postgres 16 instance, before trusting
anything downstream.

## Next session should start with

<<<<<<< Updated upstream
1. Confirm this state file still matches reality.
2. If Phase 1 is approved: each member opens their `members/member-N.md`, picks their
   first READY task, and follows the copy-paste prompt in
   `../docs/member-prompts/member-N.md`.
3. If not yet approved: resolve open questions, or iterate on Phase 0 docs.
=======
1. Member 1 implements ADR-0006, corrects the I-1 tests, and republishes the handoff.
2. Confirm P01-M01-T03 is actually complete, then continue P01-M02-T03.
3. Resolve the remaining cross-member test and Windows setup items recorded in the handoff.
>>>>>>> Stashed changes
