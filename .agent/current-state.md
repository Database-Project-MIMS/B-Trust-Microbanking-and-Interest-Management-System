# Current State

## M1 Phase 6 deployment-security draft (2026-10-08)

P06-M01-T04 is `IN_PROGRESS` on `feat/p06-m01-deployment` in an isolated
worktree. The sample environment is sanitized; a production-only HSTS header,
browser-permission header, runtime environment validator and security test
suite are added. Focused tests 6/6, disposable 41-migration rebuild,
typecheck/lint/build pass. The combined suite is 733 pass / 28 fail outside
these six tests. No live HTTPS target was supplied; no deployment, commit or PR
was performed. See [handoff](handoffs/p06-m01-deployment-security.md).

The user's request is a scoped early start, not general Phase 6 entry.
Phase 5-dependent M1 T01/T02 remain TODO.

**Updated:** 2026-10-08 · **Owner:** M2
**Checkout:** feat/p05-m02-rpt01-view · HEAD 41e2e76 · pending integration of dev d466866
**Work:** PR #67 task-tracker conflict resolved locally; user commit/push/merge pending.

Preserved incoming Member 1 Phase 3/4/5 and Member 4 reversal/API DONE statuses,
M2's merged FD tasks, and REVIEW for RPT-01 / corrective withdrawal in PR #67.
Recounted all 97 task IDs: **34 TODO /2 REVIEW /61 DONE**. I-7/CSV/report auditing
is published by PR #65; M2 T02 still awaits T01 integration and start authorization.
General phase gates remain pending. Files are left unstaged; no assistant commit,
push or completed merge. The 663-test result below predates this dev integration;
this conflict fix checks documentation consistency, not the combined code suite.
[Conflict resolution handoff](handoffs/p05-m02-pr67-conflict-resolution.md).

---

## Historical RPT-01 and withdrawal verification before integration

**Updated:** 2026-10-08 · **Owner:** M2
**Checkout:** feat/p05-m02-rpt01-view · base dev/HEAD 48f4185
**Work:** P05-M02-T01 and user-authorized P03-M04-T03 correction verified locally, REVIEW; T02/I-7 pending

0520 implements the owner-only invoker/barrier RPT-01 view, with exact totals by
agent/posting branch/type/timestamp and a tested range-specific roster outer join.
The user subsequently authorized M4 correction and its documents (ADR-0021). New
0363 preserves merged 0362, repairs audits/real limits, validates actor/scope, captures
trusted attribution, supports I-4 array signers and safe serialized replay. Its audited
attempt rolls back inner financial work and returns a rejection code with one outer
audit; the future service commits the audit-only result before mapping an error.

Final full verification PASS: **663 tests /62 suites**, zero failures/skips, no
exclusions, clean isolated **34-migration** rebuild/checksums, typecheck/lint/production
build. RPT-01 12 and withdrawal 21 SQL cases cover negative/precision/scope/timezone/
concurrent/rollback contracts. Index probe uses ix_transaction_agent_date without
planner forcing. Prior failed/supplementary runs are superseded by the corrected full
run; fixture/diagnostic handoff retained. /review three layers and /remember complete.
No UI changed, so /imprint is not applicable. All five overview tables reviewed;
M2 and explicitly authorized M4 docs updated. Tracker: **46 TODO /2 REVIEW /49 DONE (97)**.
No normal development database change; disposable clusters cleaned up. PR #62 merged
P04-M02-T02; its REVIEW notes below are historical. General phase approvals remain
pending. M2 T02 waits for I-7/CSV/access auditing; future M4 T04/T05 remain separate.
Changes unstaged/uncommitted on HEAD 48f4185. User owns commit/push/PR/merge.
[RPT-01 handoff](handoffs/p05-m02-rpt01-view.md) ·
[M4 correction](handoffs/p03-m04-withdrawal-contract-repair.md).

---

## Historical customer FD scope delivery (subsequently merged PR #62)

**Updated:** 2026-10-08 · **Owner:** M2 (current FD scope work supersedes historical checkout notes)
**Checkout:** feat/p04-m02-fd-branch-scope · base dev e9291dc
**Work:** P04-M02-T02 verified locally, REVIEW under ADR-0019; T01 DONE through PR #60

## Customer FD scope implementation evidence

Migration 0421 adds a stable SECURITY INVOKER stored-actor check and additive
RESTRICTIVE SELECT-only FD policy. Direct base/view reads require current active
stored user/role; staff profile/branch must be active and match branch context.
Existing 0420 assignment/customer/account/self predicates remain ANDed. An owner-only
installer binds immediately on an existing schema, or after 0420 in the existing
post-migration views step. No merged migration, runtime write access, financial
writer, table columns, DTO, route or UI is changed.

Full verification PASS: **630 tests /60 suites**, zero failures/skips, clean isolated
**31-migration** rebuild/checksums, typecheck/lint/production build. 14 new cases
(DB10/API4) cover direct SQL context and live-session scope transitions plus context
cleanup. An initial file-level branch-test failure was not reproduced: unchanged
file passed 4/4 alone and the repeat combined run passed; recorded in the handoff.
No new UI, so T01 browser/imprint evidence retained; /review and /remember complete.

The user's “do it now” authorizes only this T02 read-side start (ADR-0019). General
phase gates/OQ-13/OQ-14 remain pending. M1/M5 review the additive policy; future
M5/M3 FD read paths retain owner responsibility. All five overviews reviewed, only
M2 updated. Tracker: **48 TODO /1 REVIEW /48 DONE (97)**. Normal development database
not migrated/reset; disposable verification clusters cleaned up. Changes unstaged/
uncommitted on HEAD e9291dc; user retains commit/push/PR/merge control.
[Handoff and review](handoffs/p04-m02-fd-branch-scope.md).

---

## Historical customer FD listing delivery (T01 subsequently merged PR #60)

Caller-security `vw_customer_fd_summary`, authenticated
`GET /api/customers/{id}/fixed-deposits` and the customer profile's Fixed Deposits
panel are implemented. M2 migration 0420 binds after merged M5 0480 in the existing
views stage; existing schemas bind during migration. SQL enforces assignment,
customer/account branch and login-linked self scope; selective FD SELECT grants/RLS
add no write access. Exact amount/rate strings, all statuses and opening snapshots.

Verification PASS: **612 tests /57 suites**, zero failures/skips, clean isolated
**29-migration** rebuild/checksums, typecheck/lint/production build. Browser populated,
empty, safe error/retry and 375px internal table scrolling pass; no console errors.
Existing shell animation/slow-query warnings recorded in the handoff. /review,
/imprint and /remember complete. All five overview tables reviewed; only M2's
status/work changed. Tracker: **49 TODO /1 REVIEW /47 DONE (97)**.

ADR-0018 records the user's read-side early start, not a general phase approval.
M5 opening is partial; T02 and OQ-13/OQ-14 remain pending. M1/M5 review the additive
FD read policy through the [handoff](handoffs/p04-m02-customer-fd-listing.md).
Normal development database preserved; disposable preview/cluster cleaned up.
Changes unstaged/uncommitted on HEAD c5fed03; user controls commit/push/PR/merge.

---

## Historical Phase 3 delivery and integration notes

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
overflow. No browser console errors. Screenshots are in ignored test-results/t02-activity-\*.png.
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
approval remains valid. Overall tracker: 50 TODO / 1 REVIEW / 46 DONE (97 tasks).

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

## M3 update — P03-M03-T03 (2026-10-08)

P03-M03-T03 DONE (early, at the user's direction; same scoped basis as T01/T02): `GET /api/accounts/{id}` adds
`availableToWithdraw` (SQL, `numeric(15,2)`), `lastTransaction` and `mandate.state` (Asia/Colombo date); `/accounts/{id}`
shows the available amount, last transaction, who can authorise withdrawals and a non-ACTIVE notice, plus an Authority
column. No migration. Full isolated suite 580/580 (incl. seed-validation, so its earlier dev-DB failure was dev-data only),
typecheck, lint, build clean. **Browser pass not yet run.** M3's Phase 3 tasks are all DONE.
[Handoff](handoffs/p03-m03-t03-balance-panel.md).

## Historical M2 work — customer FD listing (2026-10-08; subsequently merged PR #60)

Vibodha requested implementation after the partial M5 opening dependency and
general Phase 4 gate were explained. ADR-0018 authorizes T01's read-side only.
View/API/profile panel implemented; baseline assignment/branch/self SQL scope,
caller-RLS view and SELECT-only FD policy/column grants; no financial writes.
0420 owner-only installer binds after 0480 in the existing rebuild view step.
Full isolated verification (612 tests /57 suites, 29 migrations) and browser QA pass.
Local REVIEW awaits user publication and teammate review. The normal database
is not reset or migrated. M1/M5 security coordination is in the outgoing handoff.
All five overview tables reviewed; only M2 status/work is updated. Other member
rows, partial opening routine, auth, shared grants, seeds and merged migrations
are unchanged. User retains commit/push/PR/merge control; no assistant publication.

## M1 update (2026-10-08)

P02-M01-T03 (Branch-scope enforcement on routes) has been verified and marked as DONE.
Scope is correctly applied within the SQL queries by M2 (customers) and M3 (accounts), and tests confirm that URL tampering and spoofing attempts correctly yield 403 or 404, matching the acceptance criteria. No new code was needed, just verification.

## M3 update (2026-10-08, later)

P03-M03-T02/T03 are DONE (merged / on dev). P04-M03-T01 DONE as an early start at the user's direction
(no Phase 3 exit, general Phase 4 entry, OQ-13 or OQ-14 approval): I-6 published as
`database/migrations/0440_p04_m03_fn_check_account_fd_eligible.sql` (`fn_check_account_fd_eligible`, `fn_fd_funding_verdict`),
`tests/db/fn-check-account-fd-eligible.test.mjs` 20/20. Full isolated suite on the tree merged with dev 93a82f8: 755 tests /
728 pass / 27 fail / 0 cancelled. A clean export of origin/dev fails the same 27 tests (735 tests, 11 more cancelled in M1's
`business-rules` and `business-hours-limits`, which M3's fixture repairs fix), so none come from M3's change; they are listed in
`open-questions.md`. The withdrawal defect M3 reported against merged `0362` was repaired upstream by 0363 (ADR-0021), and
`sp-post-withdrawal.test.mjs` passes. Use the tracker header above for current task counts.
[Handoff](handoffs/i-6-fn-check-account-fd-eligible.md). The unresolved merge-conflict markers from the "phase 7" merge were removed (both sections kept).
