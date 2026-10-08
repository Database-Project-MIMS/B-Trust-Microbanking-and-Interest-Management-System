# Current State

**Updated:** 2026-10-08 · **Owner:** M2
**Checkout:** feat/p03-m02-agent-attribution-activity · HEAD 67b1817
**Work:** PR #49 tracker resolution; uncommitted local merge from dev 2208986

The user committed/pushed T01 and opened PR #49. Incoming seed PR #48 is retained;
the tracker combines M5-T01 DONE with M2-T01 REVIEW (56 TODO / 4 REVIEW / 37 DONE).
No general phase approval is inferred. The user finishes the merge commit and push.
[Conflict-resolution evidence](handoffs/p03-m02-t01-pr49-conflict-resolution.md).
Fresh combined checks pass: clean isolated 24-migration rebuild/checksums and all
501 tests in 45 suites, zero failures/skips. No unmerged entries or conflict markers
remain. The incoming seed/phase target contradiction is in open-questions.md.

## Current implementation

Migration 0320 adds nullable transaction agent/branch snapshots, restrictive foreign
keys and two transaction_date reporting indexes. Existing immutable rows stay unchanged;
legacy producer column lists remain compatible. No new endpoint/UI or posting routine.
15 new attribution tests cover FK failures, deletion restrictions, NULL/legacy inserts,
owner/runtime immutability, transfer-stable totals, rollback, and a populated-ledger upgrade.

Full isolated verification passes: 501 tests in 45 suites, zero failures/skips;
24 migrations rebuild and checksum-verify; TypeScript, lint and production build pass.
The normal development database was not reset or migrated. /review finds no unresolved
T01 issues; /imprint is inapplicable. Handoff: handoffs/p03-m02-transaction-attribution.md.

## Authorization and phase state

Vibodha authorized the prescribed G-07 schema and an early start for T01 after the
phase restriction was explained, then explicitly requested implementation. ADR-0016
records the scoped exception. Phase 2 exit and general Phase 3 entry are not approved;
OQ-12/OQ-14 and G-04/G-14 remain pending. P03-M02-T02 stays TODO and is not delivered here.
T01 is REVIEW pending the user's PR and M4/team review, rather than formally DONE.

PRs #41 (M2 customer APIs), #42/#45/#46 (M3 mandate/opening/APIs), and #47 (M3 screens)
are merged. Existing M3 tracker REVIEW labels and its pending browser checklist need
owner reconciliation; no other member's status is changed by this task. M1-T03 and
M5's complete Phase 2 seeds are now recorded DONE by merged PR #48; phase target
reconciliation remains pending. Old T05/M3 local-only publication
notes in dated handoffs are historical.

## Handoff and next work

M4's existing schema handoff reserves these additions for M2. The outgoing handoff
requires M4 future posting routines and M3 opening deposits to capture trusted values
inside their posting transaction. Current M3 opening deposits remain unattributed.
M1 retains transaction RLS/scope; nullable FKs are not authorization/completeness rules.
Apply 0320 through the normal migration runner when using the development database.

The user commits, pushes, creates PRs and merges. Nothing is staged or published by
this session. All five overview tables were reviewed; only M2's new work is recorded.

## M3 update (2026-10-08)

P02-M03-T03–T06 are DONE and merged into dev (PRs #42/#45/#46/#47): `0242` joint mandate,
`0243` `sp_open_savings_account`, `0244`/`0245` accounts APIs and `sp_add_account_holder`,
and the account screens plus real plans page. A partial browser pass found no defects; the
successful opening and `/accounts/{id}` pages were untested because no verified document
can exist yet. Handoffs: `handoffs/p02-m03-t03-joint-mandate.md`, `…t04-…`, `…t05-…`, `…t06-…`.

P03-M03-T01 DONE (early, same scoped exception as M2-T01): `database/routines/fn_check_plan_minimum.sql`
publishes I-4, `fn_check_plan_minimum(account_id, resulting_balance)`; `tests/db/fn-check-plan-minimum.test.mjs`
11/11 in one rolled-back transaction; `/review` findings resolved. No migration (routine file, like
`fn_check_plan_eligibility`). M4's `sp_post_withdrawal` is unblocked on the minimum check; the mandate
check is P03-M03-T02. [Handoff](handoffs/i-4-fn-check-plan-minimum.md).

Open coordination raised by M3 (recheck after the PR #48 seeds):
1. **Document verification is not exposed (M2).** `customer_document.verified_*` can only be set outside the
   app, so `DOCUMENTS_NOT_VERIFIED` can never clear for app-registered customers. See `open-questions.md`.
2. **Seeded branch managers cannot sign in (M1/M5).** `bm_*` users had no `agent` row while `validateSession`
   requires an ACTIVE agent row for BRANCH_MANAGER. Confirm whether PR #48 changed this. See `open-questions.md`.
