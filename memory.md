# Memory - PR #53 conflict resolution

**Updated:** 2026-10-08 · /remember save
**Branch:** feat/p03-m02-agent-daily-activity · HEAD d2901b7

User committed/pushed T02 and opened PR #53 against dev. Prepared local
origin/dev af07af8 merge with --no-commit --no-ff; resolved current-state/tracker
by preserving T02 REVIEW and incoming M3/M4 DONE statuses. Counts reconciled:
52 TODO /1 REVIEW /44 DONE (97). General phase gates remain pending.
Combined verification PASS: 554 tests /49 suites, zero failures/skips;
clean isolated 26-migration rebuild and checksum checks; TypeScript, lint and
production build PASS. The normal development database was preserved.
Log: test-results/p03-activity-pr53-conflict-verification.log (ignored).
Handoff: .agent/handoffs/p03-m02-t02-pr53-conflict-resolution.md.
User controls the pending merge commit, push and PR merge; no assistant publication.

---

## Previous delivery (historical)

# Memory — P03-M02-T02 agent daily activity

**Updated:** 2026-10-08 · /remember save
**Branch:** feat/p03-m02-agent-daily-activity · base HEAD db6ff4e

## Current continuation

User (M2/Vibodha) explicitly authorized T02 implementation after its general phase
restriction was explained. ADR-0017 extends the earlier T01 scoped start. No Phase 2
exit/general Phase 3 entry or OQ-12/OQ-14 approval. T01 is DONE, PR #49 merged into
dev c2bce7c. T02 is implemented/verified, local REVIEW for user publication and review.

Live GET /api/agents/{id}/activity and /agents/{id}/activity; manager/bankwide directory
links and AGENT My daily activity from Customers. Inclusive Colombo dates, Today,
exact SQL COUNT/SUM decimal-string amounts; no net balance or missing attribution
inference. Read-only REPEATABLE READ transaction revalidates stored active role/profile,
sets RLS context and enforces self/branch predicates in SQL. Manager requires current
target branch AND captured posting branch, preventing transferred-history leakage.
Bankwide users may retain a staff profile without losing bankwide access. No new DDL;
0320 is reused. Normal development DB preserved; M4/M3 producer adoption and M1 RLS
remain integration follow-up, with NULL attribution excluded.

Final verify:phase1 passes 529 tests / 48 suites, zero failures/skips, clean isolated
24-migration rebuild/checksums, TypeScript/lint/build. 28 new cases (API19/DB7/date2).
Browser manager/self access, populated/filter/empty/Today/error/retry and mobile
internal-scroll/no-page-overflow checks pass; no console errors. Temporary preview
and cluster cleaned up. Local ignored evidence: test-results/agent-daily-activity-verification.log,
t02-activity-desktop.png, t02-activity-mobile.png. /review findings fixed; /imprint saved.
Handoff: .agent/handoffs/p03-m02-agent-daily-activity.md.

Seeded bm_colombo/bm_kandy/bm_galle lack required active agent profiles (ADR-0006),
so their logins return to sign-in after session validation fails closed. Disposable
browser fixtures supplied one synthetic manager profile; seed/auth code unchanged.
M5/M1 handoff: .agent/handoffs/p03-m02-activity-seed-manager-profile.md. Phase 2 seed
versus exit target mismatch remains recorded. Other members' stale labels need owner
reconciliation; only M2 rows/overview changed. Overall 55 TODO /4 REVIEW /38 DONE.

User prohibits assistant commits, pushes, PR creation and completed merges. Nothing
staged/published here; leave changes for user. Do not start another phase/task from
this delivery without checking its tracker/dependencies and phase authorization.
The records below are historical; this current continuation supersedes old PR49
merge/conflict notes and T02 TODO labels. No secrets or real customer data saved.

---

## Historical sessions (preserved)

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
