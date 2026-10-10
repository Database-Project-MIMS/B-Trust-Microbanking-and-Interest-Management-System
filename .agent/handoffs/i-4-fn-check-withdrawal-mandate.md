# I-4 (mandate half): `fn_check_withdrawal_mandate` — joint-mandate check for the withdrawal path

**From:** Member 3 · **To:** Member 4 (`P03-M04-T03` `sp_post_withdrawal`), Member 1 (audit of rejections) · **Date:** 2026-10-08
**Task:** P03-M03-T02 · **Status:** published and tested. With `fn_check_plan_minimum` (T01) M4 now has both I-4 checks.

## Signature (exact)
```sql
fn_check_withdrawal_mandate(p_account_id uuid, p_signer_customer_ids uuid[]) RETURNS boolean
```
File: `database/routines/fn_check_withdrawal_mandate.sql` (applied by `db:rebuild` after migrations; no migration number). STABLE, SECURITY INVOKER (RLS applies), never raises.

## Meaning
`p_signer_customer_ids` = the customers authorising this withdrawal. Duplicates count once. `true` only if **every** signer is a current holder of the account and the stored mandate (BR-17) is met:

| Account | Satisfied when |
|---|---|
| Joint, `ANY_ONE` | ≥ 1 signer (all signers are holders) |
| Joint, `ALL_HOLDERS` | every current holder signs (≥ `required_signatories`) |
| Account with exactly one holder, no mandate | the holder is the signer (judged by actual holders, not the plan's `max_holders`, so editing a plan cannot lock existing accounts) |

`false` for: NULL/empty array, NULL element, any non-holder signer, NULL/unknown/RLS-hidden account, a multi-holder account with no mandate row, or a mandate outside `effective_from`/`effective_to` (Asia/Colombo date). Fail-closed. To record **why** in the rejection audit use `fn_withdrawal_mandate_verdict(account_id, signers)` → `OK | NO_SIGNERS | ACCOUNT_NOT_FOUND | SIGNER_NOT_HOLDER | MANDATE_MISSING | MANDATE_NOT_EFFECTIVE | MANDATE_NOT_SATISFIED`; `fn_check_withdrawal_mandate` is exactly `verdict = 'OK'`. Keep the codes in audit only; map to the single client error `MANDATE_NOT_SATISFIED`.

## Call order inside `sp_post_withdrawal`
1. `SELECT … FROM account WHERE account_id = $1 FOR UPDATE`; no row → `ACCOUNT_NOT_FOUND`.
2. Validate status (`ACCOUNT_NOT_ACTIVE`), hours, limits.
3. `fn_check_withdrawal_mandate(account_id, signers)`; `false` → `409 MANDATE_NOT_SATISFIED`, **no ledger row**, audit the rejection (FR-WD-05).
4. `fn_check_plan_minimum(account_id, current_balance - amount)`; `false` → `BELOW_MINIMUM_BALANCE`.
Call it after the lock, in a **READ COMMITTED** transaction, so holder/mandate changes by a concurrent `sp_add_account_holder` (which locks the same account row) are seen: each statement takes a fresh snapshot after the lock. Under REPEATABLE READ the reads would come from the transaction's first snapshot.

## Open item for M4 (API contract gap)
`docs/05` withdrawal body has only `onBehalfOfCustomerId?`. That can authorise `ANY_ONE` and individual accounts, but **`ALL_HOLDERS` accounts can never be satisfied** with one id. Suggest `signerCustomerIds: uuid[]` (server derives the single id for CUSTOMER callers from their own identity; never trust the body for a CUSTOMER). I did not edit M4's route or `docs/05`; please decide and update.

## Not checked here
Account status, limits, business hours, plan minimum, balance, and whether the caller *may act* for the signers (role/branch scope) — all remain in `sp_post_withdrawal` / the service.

## Evidence
`tests/db/fn-check-withdrawal-mandate.test.mjs` 16/16 in one rolled-back transaction: ANY_ONE, ALL_HOLDERS (subset, duplicates, stranger), holder added later, individual, malformed input, no mandate, effective-date window, mandate type switch, status independence, signature/grant, `mims_app` under RLS, deleted mandate, plan range edit, verdict codes.

## If the contract must change
Write a new handoff; do not change the signature or return meaning silently.
