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
