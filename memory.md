# Memory — P02-M02-T05 customer API and screens

**Updated:** 2026-10-07 · /remember save (non-sensitive continuation state)
**Branch:** feat/p02-m02-customer-api-ui · base dev 25fc264

## Completed

Customer registration/search/profile routes and live screens; M2 migration 0223 child
SELECT/INSERT RLS; shared RLS context and one sanitized customer-trigger audit.
M3 holder relation is merged and used directly. M2 T01–T05 technically DONE locally.
365 tests in 35 suites, no failures/skips; clean isolated 19-migration rebuild,
TypeScript/lint/build; synthetic browser workflow and duplicate/mobile checks pass.
Handoff/review: .agent/handoffs/p02-m02-t05-customer-api-ui.md. ADR-0015 records integration.
UI patterns saved to ui-registry.md.

## Decisions and remaining work

Retain existing AGENT/BRANCH_MANAGER mutation roles and server-side identity masking.
No upload/verification route, login provisioning or reassignment in T05.
M1 retains security review of 0223 and its broader route task. Pre-existing internal
verifier role lock/scoped UPDATE gap must be resolved before exposure.
P2: 10 DONE / 1 READY / 5 TODO; account opening/mandate/APIs/UI/full seeds incomplete.
Phase 2 entry approved 2026-10-05; no Phase 2 exit or Phase 3 entry approval.

## Next session

Review the uncommitted diff and handoff. The user controls commit/push/PR/merge;
the assistant must not publish. Normal development database was not reset or migrated.
Apply new migrations through the existing migration runner when using this branch.
Historical PR #35/#36 conflict histories stay in dated handoffs; current dev includes
PR #35, registration PR #38, holder PR #37 and security PR #40.
