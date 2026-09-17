# Member 2 — context

Full slice description and copy-paste session prompt:
`../../docs/member-prompts/member-2.md`

This file is the **running log** — updated by Member 2 via `/remember save` at the end
of a session, read at the start of the next one. Empty until Phase 1 work begins.

## Current task

**P01-M02-T01 — Branch schema (IN_PROGRESS).** Migration `0120_p01_m02_branch.sql`
has been applied successfully. The task-specific database tests and the complete database
test suite pass. Do not edit the applied migration; use a new migration for corrections.

## Recent history

- Created and applied the `branch` table migration with a unique branch code, shared
  `record_status`, timestamps, and the shared `set_updated_at()` trigger.
- Added `tests/db/branch-constraints.test.mjs`: 4/4 task tests pass.
- `npm run test:db`: 17/17 pass; `npm run db:verify`: all checks pass;
  `npm run typecheck`: passes.

## Notes to self

- The referenced-branch delete test becomes possible when P01-M02-T02 creates the
  `agent.branch_id` foreign key with `ON DELETE RESTRICT`.
- Do not create/switch branches, stage, commit, push, or open a PR unless explicitly
  requested by the developer.

## Blocked on

- The full `npm test` command currently fails in other members' work: M1 auth tests cannot
  resolve the `@/lib` alias under the Node test runner, and M5 FD-product tests cannot
  resolve `server-only`. These failures are outside M2 ownership.
- A clean `npm run db:rebuild` still needs to be demonstrated on Windows. The supplied
  `db:create` npm script assumes Bash, which is not installed in this environment.
