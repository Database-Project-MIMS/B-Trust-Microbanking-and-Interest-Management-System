# Member 2 — context

Full slice description and copy-paste session prompt:
`../../docs/member-prompts/member-2.md`

This file is the running log, updated by Member 2 via `/remember save` at the end of a
session and read at the start of the next one.

## Current task

**P01-M02-T03 — Branch and Agent APIs: READY.** P01-M02-T01 and P01-M02-T02 are complete
and merged into `dev`. The reconciliation on `vibodha` brings the core I-1 branch-scope
implementation and verified integration fixes together for a pull request into `dev`.

## Recent history

- Created and applied the `branch` table migration with a unique branch code, shared
  `record_status`, timestamps, and the shared `set_updated_at()` trigger.
- Added `tests/db/branch-constraints.test.mjs`: 4/4 task tests pass.
- Created and applied the agent subtype schema with unique employee/identity/email
  constraints, active-branch integrity triggers, deletion restrictions and lookup index.
- Added `tests/db/agent-constraints.test.mjs`: 9/9 task tests pass.
- The developer approved ADR-0006: `AGENT` and `BRANCH_MANAGER` use the same `agent`
  branch-staff profile; `role_name` controls permissions and `agent.branch_id` supplies
  scope.
- Reconciled the latest `main` and `dev` content, corrected authentication/session grants,
  and isolated FD API fixtures. The full suite passes 56/56.

## Notes to self

- The referenced-branch delete rule deferred from T01 is enforced and tested by the
  `agent.branch_id` foreign key.
- T03 agent-management endpoints manage ordinary `AGENT` users only; branch managers use
  the same profile for scope but are excluded with a joined role filter.
- Do not create branches, commit, push, or open a PR unless explicitly requested by the
  developer.

## Blocked on

- The `vibodha` reconciliation must be committed, pushed and merged into `dev` before the
  T03 feature branch is updated.
- Cross-member test blockers are resolved; the remaining native-Windows `db:create`
  setup issue is documented in `../handoffs/p01-cross-member-test-blockers.md`.
