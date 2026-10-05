# Member 2 — context

**Updated:** 2026-10-05, authorized Phase 1 closeout.
Slice: [member prompt](../../docs/member-prompts/member-2.md).

## Current task

**P02-M02-T01 — customer schema: READY.**
Existing branch: `feat/p02-m02-customer-schema`; next migration: 0220.
Phase 1 exit and Phase 2 entry were approved by Vibodha after passing verification.
No customer implementation exists yet.

## Completed work

P01-M02-T01–T04 are verified DONE: branch/agent constraints and integrity triggers,
SQL-scoped APIs, atomic sanitized organization audit (0122), CSRF-protected UI and
create/list/deactivate workflows. Full closeout: 184 passing tests, clean rebuild,
typecheck, lint and production build; exact 11-migration verification passes.

## Notes

ADR-0006 uses agent profiles for AGENT/BRANCH_MANAGER scope. ADR-0007 gives customers
an independent surrogate key and optional unique app_user_id. ADR-0008/0009 fix
account branch ownership and joint mandates. Customer schema unblocks M1/M3.
Follow tracker dependencies for assignment, documents and atomic registration.

## Blockers and publication

No Phase 1 blocker remains for customer schema. OQ-11 is for optional login provisioning,
not customer table creation. Closeout changes are uncommitted; do not commit, merge
or create a PR unless the user requests it.
Evidence: [checkpoint](../checkpoints/phase-01-checkpoint.md).
