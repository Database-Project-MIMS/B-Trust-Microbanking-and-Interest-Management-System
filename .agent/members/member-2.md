# Member 2 — context

Full slice description and copy-paste session prompt:
`../../docs/member-prompts/member-2.md`

This file is the **running log** — updated by Member 2 via `/remember save` at the end
of a session, read at the start of the next one. Empty until Phase 1 work begins.

## Current task

<<<<<<< Updated upstream
*(none started — Phase 0)*

## Recent history

*(empty)*
=======
**P01-M02-T02 — Agent schema: DONE.** The developer accepted the verified migration,
tests and documentation, and its PR has been merged into `dev`. Next assigned task:
**P01-M02-T03 — Branch and Agent APIs**, currently waiting for corrected I-1 helpers.

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
- Developer explicitly approved marking P01-M02-T02 `DONE`; its PR was subsequently
  merged into `dev`.
- The developer approved ADR-0006: `AGENT` and `BRANCH_MANAGER` use the same `agent`
  branch-staff profile; `role_name` controls permissions and `agent.branch_id` supplies
  scope. The affected schema, API, security, architecture and task documents were updated.
- Published `p01-branch-staff-scope-decision.md` for M1. The existing I-1 implementation
  is not consumable until M1 removes its `app_user.branch_id` assumption, fails closed for
  missing profiles, and replaces copied authorization tests with production-level tests.
>>>>>>> Stashed changes

## Notes to self

*(empty)*

## Blocked on

<<<<<<< Updated upstream
*(nothing yet — check `../open-questions.md` and the integration points in
`../handoffs/README.md` once Phase 1 starts)*
=======
- P01-M02-T03 waits for M1 to correct and republish I-1 according to ADR-0006.
- Cross-member test and Windows setup issues remain documented in
  `../handoffs/p01-cross-member-test-blockers.md`; they no longer block the accepted T01.
>>>>>>> Stashed changes
