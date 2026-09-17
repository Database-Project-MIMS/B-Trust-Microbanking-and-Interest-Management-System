# Member 2 — context

Full slice description and copy-paste session prompt:
`../../docs/member-prompts/member-2.md`

This file is the **running log** — updated by Member 2 via `/remember save` at the end
of a session, read at the start of the next one. Empty until Phase 1 work begins.

## Current task

**P01-M02-T02 — Agent schema: DONE.** The developer accepted the verified migration,
tests and documentation and approved completion before merging its PR. Next assigned
task: **P01-M02-T03 — Branch and Agent APIs**.

## Recent history

- Created and applied the `branch` table migration with a unique branch code, shared
  `record_status`, timestamps, and the shared `set_updated_at()` trigger.
- Added `tests/db/branch-constraints.test.mjs`: 4/4 task tests pass.
- `npm run test:db`: 17/17 pass; `npm run db:verify`: all checks pass;
  `npm run typecheck`: passes.
- Developer confirmed the pull request was created and approved marking P01-M02-T01
  `DONE`.
- Created and applied the agent subtype schema with unique employee/identity/email
  constraints, active-branch integrity triggers, deletion restrictions and lookup index.
- Added `tests/db/agent-constraints.test.mjs`: 9/9 task tests pass.
- `npm run test:db`: 26/26 pass; `npm run db:verify` and `npm run typecheck` pass.
- Developer explicitly approved marking P01-M02-T02 `DONE`; its PR merge remains pending.

## Notes to self

- The referenced-branch delete rule deferred from T01 is now enforced and tested by the
  `agent.branch_id` foreign key.
- Do not create/switch branches, stage, commit, push, or open a PR unless explicitly
  requested by the developer.

## Blocked on

- The T02 pull request still needs to be merged into the integration branch.
- Cross-member test and Windows setup issues remain documented in
  `../handoffs/p01-cross-member-test-blockers.md`; they no longer block the accepted T01.
