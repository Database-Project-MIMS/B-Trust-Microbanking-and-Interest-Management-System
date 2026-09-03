# Current State

**Last updated:** Phase 0, initialization session · **Updated by:** lead

## Phase

**Phase 0 — Project Initialization.** Not yet approved to begin Phase 1.

## What exists right now

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

None. Phase 1 has no dependency on any open question. See `open-questions.md`.

## Known process note

This repository was assembled inside an isolated Claude session with no pre-existing git
history and no PostgreSQL server available for live verification. Migrations were
syntax-reviewed and the runner script was logic-checked, but **no migration has been
executed against a real database.** The first task of Phase 1 for every member should be
running `npm run db:rebuild` for real, in a real Postgres 16 instance, before trusting
anything downstream.

## Next session should start with

1. Confirm this state file still matches reality.
2. If Phase 1 is approved: each member opens their `members/member-N.md`, picks their
   first READY task, and follows the copy-paste prompt in
   `../docs/member-prompts/member-N.md`.
3. If not yet approved: resolve open questions, or iterate on Phase 0 docs.
