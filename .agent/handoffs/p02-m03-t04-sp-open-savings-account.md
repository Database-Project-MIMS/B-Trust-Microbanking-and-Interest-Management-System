# P02-M03-T04: sp_open_savings_account

**From:** Member 3 · **To:** Member 3 (T05 API, T06 UI), Member 5 (P02-M05-T01 seeds), Member 4 (Phase 3), Member 2 (document verification) · **Date:** 2026-10-07
**Status:** built and tested locally; `/review` and the user's PR pending (the user publishes).

## Call contract (migration `0243_p02_m03_sp_open_savings_account.sql`)
```sql
CALL sp_open_savings_account(
  $1::uuid  /* plan_id */,        $2::uuid /* branch_id */,   $3::uuid /* opened_by_agent_id */,
  $4::jsonb /* holders */,        $5::jsonb /* mandate or NULL */,
  $6::numeric /* initial deposit or NULL/0 */, $7::uuid /* channel_id (required with a deposit) */,
  $8::uuid  /* actor user id */,  NULL, NULL, NULL);   -- three OUT params
-- returns one row: p_account_id, p_account_number, p_current_balance (NUMERIC -> string in node-pg)
```
- `holders`: `[{ "customer_id": "...", "holder_type": "PRIMARY" | "JOINT" }]`, exactly one PRIMARY.
- `mandate`: `{ "mandate_type": "ANY_ONE" | "ALL_HOLDERS", "required_signatories": n }` (signatories optional: 1 / holder count). Required on multi-holder plans, forbidden on single-holder plans.
- Call it inside `withTransaction()` after `setRlsContext()`. The routine never commits. `p_actor_user_id` must equal the session user when `app.current_user_id` is set (else `ACTOR_MISMATCH`, a service bug, map to 500).
- Money crosses as a string; amounts need at most two decimals.

## Errors (all `P0001`; map by `err.constraint`, message starts with the code)
`PLAN_NOT_FOUND`, `AGENT_NOT_ELIGIBLE`, `ACTOR_MISMATCH`, `INVALID_HOLDER_COUNT`, `INVALID_HOLDERS_PAYLOAD`, `OUTSIDE_BUSINESS_HOURS` (deposit only, via M1's `fn_is_business_hour`), `HOLDER_NOT_FOUND`, `MISSING_PRIMARY_HOLDER`, `PLAN_ELIGIBILITY_FAILED`, `DOCUMENTS_NOT_VERIFIED`, `MANDATE_REQUIRED`, `MANDATE_NOT_ALLOWED`, `INVALID_MANDATE_TYPE`, `INVALID_DEPOSIT_AMOUNT`, `CHANNEL_REQUIRED`, `CHANNEL_NOT_FOUND`, `BELOW_MINIMUM_BALANCE`; plus 0242 trigger errors (`UNDERAGE_HOLDER`, `INVALID_MANDATE_SIGNATORIES`) and `23505` for a duplicate holder. Constraint names are listed in `tests/db/sp-open-savings-account.test.mjs`.

## What it checks and writes
Checks: payload shape (malformed JSON gets a named error, never a raw database error), active plan (locked `FOR SHARE`), active agent of the stated branch (ADR-0008), holder count, holders active and visible under RLS (locked `FOR SHARE` so a concurrent deactivation cannot slip through), primary applicant eligibility (`fn_check_plan_eligibility`), every holder has a **verified** document, mandate shape, deposit ≥ plan minimum.
Writes: account (balance 0) → all holders in one INSERT → mandate → optional ledger row (`DEPOSIT`, reference `OPEN-<account_number>`) + balance update. Account and holder audit come from M1's triggers; the routine writes explicit audit rows for the mandate and the deposit (no trigger covers them).

## For Member 3 (T05): things the API must do
- **Idempotency (AGENTS §9):** opening with a deposit is money-moving. The route needs an `Idempotency-Key` and the service must store/replay the key; a double submit would otherwise open two accounts and credit twice. The routine gives no key support, so T05 owns it (store the key with the result, or add a column in a new 02xx migration).
- **Error mapping:** map by `err.constraint`; never return `err.message` (it contains ids). Treat any unmapped error as a 500.
- **Business hours:** only the initial deposit is time-restricted.

## For Member 5 (seeds, P02-M05-T01)
Seed customers need a **verified** document (`verified_by` and `verified_date` set) before they can hold an account. Seed through this procedure (or mirror it) so numbers come from `account_number_seq`.

## For Member 2 (follow-up)
No endpoint/UI verifies documents yet (`customer-document-service` exists, no route). Until one is exposed, the wizard (T06) can only open accounts for customers whose documents were verified through seed/service.

## For Member 4 (Phase 3)
The deposit is written directly because `sp_post_deposit` does not exist yet. When it does, switch the deposit step to it so one code path writes deposits. `transaction` has no `balance_after` yet (G-14), so no running balance is stored on the opening deposit.

## For Member 1
`joint_mandate` still has no audit trigger/RLS (0242 follow-up); this routine audits it explicitly, remove that insert if a trigger is bound.

## Notes / open
- If M4 binds an audit trigger to `transaction` later, drop the explicit deposit audit insert here to avoid duplicates.
- `reference_number` is not UNIQUE in the schema yet (G-05); `OPEN-<account number>` is unique per account, so it is safe.
- Holder branch vs account branch is not enforced (a holder registered at another branch can be added if visible). Raise with the group if a rule is wanted.
- `fn_check_plan_eligibility` lives in `database/routines/` (applied by `db:rebuild`, not `db:migrate`). A dev database built with `db:migrate` only must already have it, or run `db:rebuild`.
- Dev database was not migrated; run `npm run db:migrate` (plus `db:grants` for the sequence grant).
