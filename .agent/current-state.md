# Current State

**Updated:** 2026-10-08 · **Owner:** M2 (M3 section below is the latest)
**Checkout:** dev · PR #53 merged (6583463)
**Work:** P03-M02-T02 merged; P03-M03-T02 DONE locally, uncommitted (see M3 update)

## Delivered work

GET /api/agents/{id}/activity and live /agents/{id}/activity supply exact type counts
and amount strings for inclusive Asia/Colombo calendar dates. Agent-directory names
link to activity; AGENT has My daily activity in Customers. Date filters, Today,
loading/empty/safe error/retry and responsive internal table scrolling are complete.
No new migration: dependency 0320 is reused. T01 is DONE through merged PR #49
(dev c2bce7c), correcting M2's stale REVIEW label.

The service revalidates stored active caller identity in one read-only REPEATABLE READ
transaction, sets existing RLS context, and scopes in SQL. AGENT reads only itself;
BRANCH_MANAGER targets current own-branch ordinary agents and additionally filters
immutable transaction.branch_id. ADMIN/CENTRAL_OPS read bankwide. NULL agent rows
are excluded; managers also exclude NULL branch rows. No net balance, attribution
backfill, ledger/account mutation or producer change is inferred.

## Verification and review

Original T02 delivery verify:phase1 PASS: 529 tests / 48 suites, zero failures/skips; clean isolated
24-migration rebuild and checksum verification; TypeScript, lint and production build.
28 T02 cases (API 19, DB-backed service 7, pure calendar 2) cover real mims_app/session
reads, exact huge sums, local midnight microseconds, final-day bounds, alternate DB
timezone, transfers/NULL rows, stale/forged identity, invalid input and unchanged
ledger/balance/audit. Log: test-results/agent-daily-activity-verification.log (ignored).

Manual browser PASS: manager directory and agent self links, populated/historical/
empty/Today views, cross-branch safe denial and retry; narrow viewport has no document
overflow. No browser console errors. Screenshots are in ignored test-results/t02-activity-*.png.
The temporary browser tab, preview server and PostgreSQL cluster were closed/cleaned up.
The normal development database was not reset or migrated.

/review completed in three layers; findings fixed (bankwide users with retained
staff profiles, UUID spelling, Today across midnight). /imprint saved in ui-registry.md;
/remember saved in memory.md. All five overview tables reviewed; only M2's new
implementation/status changed. Other members retain ownership of their stale labels.
[Handoff and review](handoffs/p03-m02-agent-daily-activity.md).

## Authorization and integration limits

Vibodha explicitly authorized T02 after the general phase restriction was explained;
ADR-0017 extends the scoped early-start exception. No Phase 2 exit/general Phase 3
entry, OQ-12/OQ-14 or unrelated task approval is recorded. Historical Phase 2 entry
approval remains valid. Overall tracker: 51 TODO / 1 REVIEW / 45 DONE (97 tasks).

M4/M3 still need to populate trusted attribution inside posting transactions;
existing opening deposits remain unattributed. M1 owns future transaction RLS;
explicit service predicates enforce scope now. Apply 0320 through the ordinary
runner if the development database has not received the merged dependency.

Browser QA found seeded manager logins without required branch-staff profiles.
Authentication correctly fails closed. Only disposable QA fixtures were supplemented;
M5/M1 handoff: handoffs/p03-m02-activity-seed-manager-profile.md. No steward-owned
seed, authentication code or another member's status was altered. Existing Phase 2
seed-versus-exit targets also remain an owner reconciliation item in open-questions.md.

## M3 update (2026-10-08)

P02-M03-T03–T06 are DONE and merged into dev (PRs #42/#45/#46/#47): `0242` joint mandate,
`0243` `sp_open_savings_account`, `0244`/`0245` accounts APIs and `sp_add_account_holder`,
and the account screens plus real plans page. A partial browser pass found no defects; the
successful opening and `/accounts/{id}` pages were untested because no verified document
can exist yet. Handoffs: `handoffs/p02-m03-t03-joint-mandate.md`, `…t04-…`, `…t05-…`, `…t06-…`.

P03-M03-T01 DONE (early, at its user's direction; ADR-0016 remains M2-T01 only): `database/routines/fn_check_plan_minimum.sql`
publishes I-4, `fn_check_plan_minimum(account_id, resulting_balance)`; `tests/db/fn-check-plan-minimum.test.mjs`
11/11 in one rolled-back transaction; `/review` findings resolved. No migration (routine file, like
`fn_check_plan_eligibility`). M4's `sp_post_withdrawal` is unblocked on the minimum check; the mandate
check is P03-M03-T02. [Handoff](handoffs/i-4-fn-check-plan-minimum.md).

Open coordination raised by M3 (recheck after the PR #48 seeds):
1. **Document verification is not exposed (M2).** `customer_document.verified_*` can only be set outside the
   app, so `DOCUMENTS_NOT_VERIFIED` can never clear for app-registered customers. See `open-questions.md`.
2. **Seeded branch managers cannot sign in (M1/M5).** `bm_*` users had no `agent` row while `validateSession`
   requires an ACTIVE agent row for BRANCH_MANAGER. Confirm whether PR #48 changed this. See `open-questions.md`.

## PR #53 conflict resolution (2026-10-08)

Prepared origin/dev af07af8 with --no-commit --no-ff against feature HEAD d2901b7.
Preserved T02 implementation/review evidence and M3/M4 merged statuses, corrected
summary counts from task rows, and retained all general phase gates. M4 T01/T02
are DONE through dev (0360/0361, PR #52); the new deposit producer still omits
agent_id/branch_id, so the activity attribution follow-up remains necessary.
Combined verification PASS: 554 tests /49 suites, zero failures/skips;
clean isolated 26-migration rebuild and checksum checks; TypeScript, lint and
production build PASS. The normal development database was preserved.
Log: test-results/p03-activity-pr53-conflict-verification.log (ignored).

The user already committed/pushed T02 and opened PR #53. This assistant session
performs only local resolution and staging; no commit, push, PR creation or
completed merge. The pending merge commit and subsequent push remain with the user.

## M3 update — P03-M03-T02 (2026-10-08)

P03-M03-T02 DONE (early, at the user's direction; same scoped basis as T01): `database/routines/fn_check_withdrawal_mandate.sql`
publishes the mandate half of I-4, `fn_check_withdrawal_mandate(account_id, signer_customer_ids uuid[]) → boolean`
(STABLE, SECURITY INVOKER, never raises, fails closed). `tests/db/fn-check-withdrawal-mandate.test.mjs` 16/16 in one
rolled-back transaction; companion `fn_withdrawal_mandate_verdict` returns the rejection reason. `/review` findings fixed.
Migration `0246_p02_m03_account_number_skip_existing.sql` (M3 block) fixes `fn_next_account_number` colliding with seeded
account numbers (5 `sp-open-savings-account` tests failed on a seeded DB). Full isolated `test:db`: 348/349; the one failure is
`seed-validation` ("transaction: expected >= 100, got 93") — M5's seed-set-4 target, not part of this change. Typecheck, lint, build clean. M4's `sp_post_withdrawal` (P03-M04-T03) now has both checks it needs.
**Open for M4:** `docs/05` withdrawal body has only `onBehalfOfCustomerId`; `ALL_HOLDERS` accounts need a multi-signer
field. [Handoff](handoffs/i-4-fn-check-withdrawal-mandate.md).
