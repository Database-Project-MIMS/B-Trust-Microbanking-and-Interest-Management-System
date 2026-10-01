# Member 2 — context

Full slice description and copy-paste session prompt:
`../../docs/member-prompts/member-2.md`

This file is the running log, updated by Member 2 via `/remember save` at the end of a
session and read at the start of the next one.

## Current task

**P01-M02-T04 — Branch and Agent Admin UI: complete.** The `/branches` and `/agents`
pages now provide role-aware active/all lists, create forms, confirmed deactivation and
CSRF-protected API mutations. Member 2's Phase 1 slice is complete.

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
- Added the approved least-privilege `mims_app` grants for `branch` and `agent`. The
  organisation API suite passes 23/23 using the normal application connection.
- Added `0122_p01_m02_organization_audit.sql`: branch/agent audit triggers share the
  caller transaction, use the correct entity ID and remove password/token/identity keys.
- Added a database audit test and extended API assertions to prove audit creation,
  sensitive-field removal and rollback atomicity.
- Completed the branch and agent administration pages and added an end-to-end workflow
  test covering create, list, deactivate and retained inactive records.

## Notes to self

- The referenced-branch delete rule deferred from T01 is enforced and tested by the
  `agent.branch_id` foreign key.
- T03 agent-management endpoints manage ordinary `AGENT` users only; branch managers use
  the same profile for scope but are excluded with a joined role filter.
- Do not create branches, commit, push, or open a PR unless explicitly requested by the
  developer.

## Blocked on

- OQ-05, G-06 and G-08 are resolved by ADR-0007 through ADR-0009. Phase 2 now waits
  only for the Phase 1 exit checkpoint.
- Cross-member test blockers are otherwise resolved; the remaining native-Windows
  `db:create` setup issue is documented in
  `../handoffs/p01-cross-member-test-blockers.md`.
