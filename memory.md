# Memory — P03-M02-T01 transaction attribution

## Latest continuation — PR #49 conflict resolution, 2026-10-08

User committed T01 (HEAD 67b1817) and opened PR #49. A local --no-commit merge of
dev 2208986 is now prepared and must be completed by the user, then pushed. The
tracker preserves merged M5 seed DONE and M2 attribution REVIEW; overall 56 TODO,
4 REVIEW, 37 DONE. No conflicts remain in Git's index. Fresh combined verification
passes a clean 24-migration rebuild and all 501 tests/45 suites. Development DB
preserved. No assistant commit/push/PR creation/completed merge.
Evidence: .agent/handoffs/p03-m02-t01-pr49-conflict-resolution.md. Incoming seed
targets (15/10/2) differ from the still-unchecked Phase 2 exit targets (18/22/3);
owner reconciliation is recorded in open-questions.md. No phase exit is approved.
The older session/publication notes below are historical, superseded by this entry.

**Updated:** 2026-10-08 · /remember save (non-sensitive continuation state)
**Branch:** feat/p03-m02-agent-attribution-activity · HEAD d8d1be2 contains dev a4a6b9f

## Current session

T01 is implemented and verified locally, REVIEW pending the user's PR and M4 review.
Migration 0320 adds nullable agent/branch attribution with restrictive FKs and reporting
indexes. Existing history is untouched; future M4/M3 posting producers must populate
trusted snapshots. T02's daily activity API is a separate TODO task.

ADR-0016 records user authorization for G-07 and T01's early start only. General Phase 3
entry, Phase 2 exit and OQ-12/OQ-14 are not approved. Do not infer wider authorization.
Handoff/review: .agent/handoffs/p03-m02-transaction-attribution.md.

501 tests in 45 suites pass (15 new attribution tests), zero failures/skips; isolated
24-migration rebuild/checksum verification, TypeScript/lint/build pass. The new negative
test helper must defer operations until after its savepoint is established.
No development DB migration/reset or assistant commit/push/PR/merge. User publishes.

## Next session

Review the uncommitted diff and handoff; the user applies 0320 through the migration
runner and obtains M4 review. Work on T02 only when separately authorized and ready.

---

## Historical memory (retained; earlier status/publication notes are superseded)

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
