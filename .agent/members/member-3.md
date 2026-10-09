# Authorized integration repair contribution — 2026-10-09

Vibodha authorized M2 to fix the reported full-suite failures in other members'
code. Original ownership and task assignments remain. Current full865/latest-dev
overlay940 tests pass; focused186, rebuild/reseed/typecheck/lint pass. The
[repair handoff](../handoffs/p06-m02-integration-failure-repairs.md) describes
this member's contributions and review. Publication remains with the user.

---

## Historical owner context (retained)

# Member 3 — context

**Updated:** 2026-10-05, authorized Phase 1 closeout.
Slice: [member prompt](../../docs/member-prompts/member-3.md).

## Current state

P01-M03-T01–T03 are verified DONE: savings plan schema, data-driven eligibility,
plan APIs and administration page. P02-M03-T01 account schema (0240) is verified DONE.
The RESTRICT deletion test accepts PostgreSQL's specific 23001/23503 variants;
other constraint assertions remain specific.

## Next work and dependencies

Phase 2 entry is approved. P02-M03-T02 (`account_holder`, 0241) is DONE; P02-M03-T03 (`joint_mandate` + trigger) is next. Its dependency,
M2's customer table (P02-M02-T01, migration 0220), is now DONE. Mandate,
account-opening, APIs and UI follow. Transaction schema 0260 already exists. Joint
adult-holder enforcement remains Phase 2 work. ADR-0008/0009 are accepted.

## Publication

Original ownership retained. Cross-member closeout edits are uncommitted; the user
controls commits, merges and PR creation.
Evidence: [checkpoint](../checkpoints/phase-01-checkpoint.md).

- 2026-10-05: P02-M03-T01 complete on `feat/p02-m03-account-schema` — `0240_p02_m03_account.sql`
  (account table, G-18 balance check, ADR-0008 branch-immutability trigger), `mims_app`
  grant, `tests/db/account-constraints.test.mjs` 10/10 passing, I-3 handoff drafted in
  `.agent/handoffs/i3-account-read-contract.md` (final once P02-M03-T04 lands).
- G-06 and G-08 were approved on 2026-10-01. ADR-0008 fixes account branch ownership at
  opening; ADR-0009 requires 2–4 adult joint holders and a stored operating mandate.

## Notes to self

*(empty)*

- 2026-10-06: P02-M03-T02 complete — `0241_p02_m03_account_holder.sql` (holder_type PRIMARY/JOINT, one-PRIMARY partial unique index, RESTRICT FKs), `mims_app` grant, `tests/db/account-holder-constraints.test.mjs` 7/7. The 2–4 adult count rule is deliberately left to T03's trigger (ADR-0009).

- 2026-10-07: P02-M03-T03 built locally — `0242_p02_m03_joint_mandate.sql` (`joint_mandate`, `fn_validate_account_holders` bound as `trg_validate_joint_mandate`, `trg_joint_mandate_fit`, update trigger, account row lock), `mims_app` grant, `tests/db/joint-mandate-trigger.test.mjs` 32/32, T02 test 4 rewritten for plan-driven holder counts. Full isolated suite 397/397. `/review` run; locking, UPDATE-path, mandate-sync and mims_app findings resolved. Status REVIEW: the user's PR outstanding. Next: T04 `sp_open_savings_account` — see [handoff](../handoffs/p02-m03-t03-joint-mandate.md).

- 2026-10-07: P02-M03-T04 built locally — `0243_p02_m03_sp_open_savings_account.sql` (`account_number_seq`, `fn_next_account_number`, `sp_open_savings_account`), sequence grant, `tests/db/sp-open-savings-account.test.mjs` 29/29. Full isolated suite 426/426. `/review` run; business-hours, malformed-input, customer-lock and test-gap findings resolved, idempotency left to T05. Status REVIEW: the user's PR outstanding. Next: T05 accounts API — see [handoff](../handoffs/p02-m03-t04-sp-open-savings-account.md).

- 2026-10-07: P02-M03-T04 marked DONE (`0243`, 29 tests, `/review` findings resolved). P02-M03-T05 built locally — `0244_p02_m03_account_opening_request.sql` (idempotency), `0245_p02_m03_sp_add_account_holder.sql`, `services/account-service.ts` + `account-errors.ts`, `lib/validation/account.ts`, routes under `app/api/accounts/**`, `tests/api/accounts.test.mjs` 23/23 + DB tests 15. Full isolated suite 464/464, typecheck/lint/build clean. `/review` run: AGENT scope narrowed to assigned customers' accounts (list, detail and opening), zero-deposit channel lookup skipped, extra tests added. Status REVIEW: the user's PR outstanding. Next: T06 UI — see [handoff](../handoffs/p02-m03-t05-accounts-api.md).

- 2026-10-07: P02-M03-T06 built locally — live `/accounts`, `/accounts/new`, `/accounts/{id}`, real `/plans` (restyled `SavingsPlanClient`), pure modules `account-format.ts` / `account-opening-model.ts`, `tests/e2e/accounts-ui-model.test.mjs` 12/12; detail DTO gained `minHolders`/`maxHolders`; T04 test 19 made clock-independent (it failed outside business hours). Full isolated suite 486/486, typecheck/lint/build clean. `/imprint` done. `/review` run: fixed the plans-dialog focus trap, an age-field typo that could clear a limit (new pure `plan-edit-model.ts`), and the invisible missing-token error on the review step; 7 minor findings left open. Status REVIEW: manual browser pass, `/review` and the user's PR outstanding. Next: Phase 3 (needs checkpoint approval) — see [handoff](../handoffs/p02-m03-t06-account-screens.md).

- 2026-10-07: User confirmed P02-M03-T03 and P02-M03-T05 are merged into dev, so both are now DONE in the tracker (they had stayed REVIEW because the tracker was never updated after merge). T04 was already DONE. Only P02-M03-T06 remains in REVIEW.

- 2026-10-07: Workflow note from the user: a task is DONE as soon as it is coded and verified; there is no REVIEW stage. P02-M03-T06 marked DONE (its manual browser pass is still to be run). Phase 1 and Phase 2 M3 tasks are all DONE.

- 2026-10-08: T06 merged into dev. Browser pass (agent_c1): accounts list, plans, wizard to review step, server rejects unverified holder, all fine; 486/486 tests, typecheck and lint clean. Happy path blocked: no app path verifies customer documents (M2) and seeded `bm_*` users cannot sign in (no agent row). Both recorded in `.agent/open-questions.md`. Dev DB holds synthetic customer `TST900000001`. Next: P03-M03-T01/T02, once the Phase 2 exit checkpoint is approved.

- 2026-10-08: P03-M03-T01 done — `database/routines/fn_check_plan_minimum.sql` (I-4: STABLE, SECURITY INVOKER, never raises, fails closed under RLS), `tests/db/fn-check-plan-minimum.test.mjs` 11/11 (rolled-back transaction), full isolated suite 497/497; `/review` run, all 5 findings fixed (stale overview signature and brief, test residue, ambiguous-false handoff pattern, extra tests). Placement in `database/routines/` (not a migration) chosen by the user. Corrected docs/16, which described the 2nd argument as `proposed_debit`; it is the resulting balance. Handoff `.agent/handoffs/i-4-fn-check-plan-minimum.md` published. Next: P03-M03-T02 (mandate validation callable from withdrawal path).

- 2026-10-08: P03-M03-T02 done — `database/routines/fn_check_withdrawal_mandate.sql` (I-4 mandate half: `(account_id, signer_customer_ids uuid[]) → boolean`, STABLE, SECURITY INVOKER, fails closed), `tests/db/fn-check-withdrawal-mandate.test.mjs` 16/16 (+ verdict helper; `/review` fixed; migration `0246` skip-existing account numbers). Handoff `.agent/handoffs/i-4-fn-check-withdrawal-mandate.md`. Next: P03-M03-T03 (balance panel, FE; dependency P03-M04-T02 DONE).

- 2026-10-08: P03-M03-T03 done — account detail balance/authority panel (`availableToWithdraw`, `lastTransaction`, `mandate.state`), `account-format.ts` helpers, 580/580 isolated tests. Browser pass pending. All M3 Phase 3 tasks DONE; next: Phase 4 (P04-M03: FD eligibility, closure, FD panel).

- 2026-10-08: P04-M03-T01 done (early start at the user's direction; no Phase 3 exit or general Phase 4 approval) — `database/migrations/0440_p04_m03_fn_check_account_fd_eligible.sql` (I-6: card function `fn_check_account_fd_eligible(account_id) → boolean`, STABLE, status only; plus `fn_fd_funding_verdict(account_id, principal) → text`, VOLATILE, locks the row and gives the reason), `tests/db/fn-check-account-fd-eligible.test.mjs` 20/20. Full isolated suite 689 tests, 677 pass; the 1 fail + 11 cancelled are three pre-existing dev suites (business-rules, business-hours-limits, sp-post-withdrawal fixtures), confirmed by a run without my files. Handoff `.agent/handoffs/i-6-fn-check-account-fd-eligible.md`. Found that dev's `sp_open_fixed_deposit` inlines its checks and debits with a bare UPDATE (recorded in open-questions). Next: P04-M03-T02 (`sp_close_account`, BR-18) — its dependency T01 is now done.

- 2026-10-08: At the user's request, repaired problems found during P04-M03-T01: (1) removed the unresolved merge-conflict markers in `.agent/current-state.md` (kept both sections); (2) fixed stale fixtures in M1's `tests/api/business-rules.test.mjs` and `tests/db/business-hours-limits.test.mjs` (both pass now); (3) fixed the Joint-account fixture in M4's `tests/db/sp-post-withdrawal.test.mjs`, which exposed a real defect in merged `0362` (`PERFORM` on a PROCEDURE → SQLSTATE 42809 on every rejection path) — handed to M4 in `handoffs/p03-m04-t03-withdrawal-rejection-defect.md`, not fixed by M3. M5's bare-UPDATE FD debit is left for the owner (needs a ledger transaction type decision). Isolated suite: 699 tests, 690 pass, 9 fail (all that M4 test).

- 2026-10-08: `/review` of P04-M03-T01 found 5 issues, all addressed: (1) moved the functions from `database/routines/` to the card's migration `0440` (clean rebuild proves it); (2) added `.agent/handoffs/m3-cross-member-test-fixture-repairs.md` for the edits to M1's tests, M4's test and M2's `current-state.md`; (3) the `ACTIVE_FD_EXISTS` pre-check reads `fixed_deposit` under RLS — documented in the migration, docs/16 and the I-6 handoff, with tests 15 (assigned AGENT sees the FD) and 16 (ADMIN does not; the unique index still rejects a duplicate); I deliberately did not add a SECURITY DEFINER bypass; (4) corrected the "never raises" wording (waits for a competing lock, 25006 in a read-only transaction; test 17); (5) added a lock-wait test (18) and made test 11 release its savepoint lock. Suite file now 20/20. Handoff rewritten with the card contract verbatim.

- 2026-10-08: After pulling dev 93a82f8: resolved the stash-pop conflicts in `.agent/current-state.md`, `docs/09_task-tracker.md` (summary recounted from the rows: Phase 4 is 7 TODO / 7 DONE, overall 31 TODO / 2 REVIEW / 64 DONE) and `tests/db/sp-post-withdrawal.test.mjs` (took upstream, which was rewritten around 0363). The `sp_post_withdrawal` 42809 defect I reported was repaired upstream, so that handoff was deleted. Suite: 755 tests, 728 pass, 27 fail, the same 27 as a clean export of origin/dev (recorded in open-questions). I-6 suite 20/20 passes.

- 2026-10-08: P04-M03-T02 done (early start at the user's direction; no phase approval) — backend only. `0441_p04_m03_sp_close_account.sql`: `sp_close_account` (FOR UPDATE, ACTIVE-only, zero balance, no ACTIVE FD, explicit CLOSE audit) and `trg_account_close_guard` (SECURITY DEFINER guard so a direct UPDATE or RLS-hidden FD cannot bypass BR-18); `closeAccount()` in `account-service.ts`; `POST /api/accounts/{id}/close` live (was 501). `tests/db/sp-close-account.test.mjs` 17/17, `tests/api/accounts.test.mjs` +6. Suite 777 tests / 750 pass / the same 27 inherited failures; tsc, eslint, next build clean. Corrections to the card: audit columns are old_values/new_values; the trigger audit row records the actor (0200), my plan had wrongly said SYSTEM. Handoff `.agent/handoffs/p04-m03-t02-account-closure.md`. Next: P04-M03-T03 (FD panel), `/review` of T02 first.

- 2026-10-08: `/review` of P04-M03-T02 found 3 issues, all addressed: (1) the guard trigger now locks the account row `FOR UPDATE` before checking, so a direct UPDATE waits for an in-flight FD insert (a plain UPDATE's NO KEY UPDATE lock does not conflict with the FD foreign key's KEY SHARE); docs/handoff reworded to say exactly what is and is not covered (an FD inserted after the account is CLOSED by SQL that skips the procedure is M5's table; suggestion recorded); (2) concurrency evidence is now real: tests 15–17 race two connections with committed fixtures, and test 15 fails without the new lock (checked); (3) branch: see the commit plan — T02 belongs on its own branch. Suite 777 tests / 750 pass / the same 27 inherited failures.

- 2026-10-08: P04-M03-T03 done (early start at the user's direction; no phase approval; tests only, no browser pass) — `GET /api/accounts/{id}` now returns `fixedDeposits` (read from `fixed_deposit` under RLS); `/accounts/{id}` has a "Fixed deposits" card with the table, a closure-blocked note and an "Open a fixed deposit" link; `fixedDepositPanel` in `account-format.ts`. `tests/api/accounts.test.mjs` +3, `tests/e2e/accounts-ui-model.test.mjs` +6; suite 786 tests / 759 pass / the same 27 inherited failures; tsc, eslint, next build clean; `/imprint` done. All three tasks on the Phase 4 card (T01–T03) are DONE. Handoff `.agent/handoffs/p04-m03-t03-fd-panel.md`. Next: `/review` of T03; then P05-M03-T01 (RPT-02 view) is free but Phase 5 is not open; P06-M03-T01/T02 wait on Phase 4/5 work.

- 2026-10-08: `/review` of P04-M03-T03 found 3 minor issues, all addressed: (1) `AccountFixedDeposit` moved to `types/account-fixed-deposit.ts` and derived from M2's `CustomerFixedDeposit` so they cannot drift; (2) the FD read in `getAccountDetail` now runs in a savepoint: a failure returns the account with `fixedDeposits: null` (logged by SQLSTATE, retryable conflicts rethrown) and the page says the deposits could not be loaded instead of showing a false empty list or a missing closure note; (3) the panel is extracted to `app/accounts/[id]/account-fixed-deposits.tsx` and its rendered markup is tested (8 tests via a child-process renderer). A visual browser pass was still not done. Suite 796 tests / 769 pass / the same 27 inherited failures; tsc, eslint, next build clean.

- 2026-10-08: Pulled dev 81fd25c (stash/pop). Resolved the `ui-registry.md` conflict (kept both the account FD panel and the RPT-01 section) and recounted the tracker summary and the Phase 3/4/5 headings from the rows, since other members' statuses had changed (now 23 TODO / 1 REVIEW / 73 DONE). Merged-tree suite: 828 tests / 801 pass / the same 27 inherited failures; tsc and eslint clean.

- 2026-10-08: P05-M03-T01 done (early start at the user's direction; no phase approval) — `0540_p05_m03_rpt02_view.sql` (`vw_rpt02_account_summary`: per ledger event, opening/closing from the stored `balance_after`, reversals net into their original category, balance identity holds) and `0541_p05_m03_sp_open_account_balance_after.sql` (the opening deposit was written with `balance_after` NULL since 0243; the ledger is immutable so old rows are derived in the view). `tests/db/rpt02-view.test.mjs` 13/13 (checked: test 12 fails without 0541; stable over 3 fresh DBs). Suite 852 tests / 824 pass / 28 inherited failures (clean HEAD export: 29). Found: card SQL used nonexistent posted_at/status; same-transaction postings can tie on timestamp (seed); docs/04 says balance_after NOT NULL. Handoff `.agent/handoffs/p05-m03-t01-rpt02-view.md`. Next: P05-M03-T02 (report service, API, CSV, page), then `/review`.

- 2026-10-08: `/review` of P05-M03-T01 found 2 important issues and 1 minor; at the user's choice both were fixed. Measured on the pure seed first: 73/125 rows tie on `transaction_date`, 86 balance-chain breaks, 6 of 10 accounts' last row ≠ `current_balance`. Added `0542` (`transaction.ledger_seq`, G-24, ADR-0023: posting-order key, UNIQUE (account_id, ledger_seq), no posting routine changed) and `0543` (view v2: ordered by `ledger_seq`, no numeric(15,2) overflow cast, correlated legacy sum instead of a whole-ledger window). Seed now: 0 breaks, 0 mismatches; one-branch plan reads only that branch. Tests: `rpt02-view` 18/18, `transaction-ledger-seq` 7/7. Suite 865 tests / 837 pass / the same 28 inherited failures. New records: ADR-0023, G-24, handoff to M4 `p05-m03-ledger-seq-for-m4.md`. Also found: seed dates are all one day; all 10 seeded accounts start with a balance outside the ledger. Next: commit, then P05-M03-T02 (service, API, CSV, page).

- 2026-10-08: P05-M03-T02 done (early start at the user's direction; no phase approval; tests only, no browser pass) — `services/account-summary-report-service.ts` (one REPEATABLE READ transaction: actor re-check, scoped totals/page/page subtotal, in-transaction access audit), `GET /api/reports/account-summary` (JSON and ALL-rows CSV with identical totals), real `/reports/account-summary` on the shared shell with typed opening/closing columns; validation `lib/validation/account-summary-report.ts`; three additive optional props on M1's shared report components (handoff to M1). `tests/api/rpt02-report.test.mjs` 16/16 (as mims_app), `tests/e2e/account-summary-report-screen.test.mjs` 7/7 (rendered markup, RPT-01 defaults unchanged). EXPLAIN ANALYZE on 40k ledger rows: one account 0.31 ms, one branch 65 ms, bank-wide 176 ms. Suite 888 tests / 860 pass / the same 28 inherited failures; tsc, eslint, next build clean; `/imprint` entry added. RPT-02 (T01+T02) is done. Handoff `.agent/handoffs/p05-m03-t02-rpt02-report.md`. Next: `/review` of T02; remaining M3: P06-M03-T01 (concurrency) and P06-M03-T02 (constraints, waits on Phase 4).
