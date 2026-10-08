# I-4: `fn_check_plan_minimum` — plan-minimum check for the withdrawal path

**From:** Member 3 · **To:** Member 4 (`P03-M04-T03` `sp_post_withdrawal`), Member 1 (audit of rejections) · **Date:** 2026-10-08
**Task:** P03-M03-T01 · **Status:** published and tested; M4's `sp_post_withdrawal` is unblocked on the minimum-balance rule. The joint-mandate check is P03-M03-T02 and is not part of this handoff.

## Signature (exact)
```sql
fn_check_plan_minimum(p_account_id uuid, p_resulting_balance numeric(15,2)) RETURNS boolean
```
File: `database/routines/fn_check_plan_minimum.sql` (applied by `db:rebuild` after migrations; no migration number). STABLE, SECURITY INVOKER (RLS applies), never raises.

## Call contract
- **The second argument is the balance AFTER the withdrawal**: `current_balance - amount`. It is not the debit amount. (`docs/16` previously said `proposed_debit`; it has been corrected.)
- Call it inside your transaction **after** `SELECT … FOR UPDATE` on the account row and **before** inserting the ledger row, using the balance you re-read after the lock. A balance read before the lock is stale.
- `true` → the minimum is preserved. `false` → reject with `409 BELOW_MINIMUM_BALANCE`, write **no ledger row**, and record the rejection as an audit event (FR-WD-05).
- Never hardcode a plan minimum in M4 code. The function reads `savings_plan.min_balance` through `account.plan_id`, so administrators changing a plan's minimum take effect immediately.
- `false` is ambiguous on purpose (it fails closed): it means a balance below the minimum **or** an unknown/NULL account, a NULL resulting balance, or an account the caller's RLS context cannot see. Set the RLS context (`setRlsContext`) before calling; with no context every call returns `false`. So never map a bare `false` to `BELOW_MINIMUM_BALANCE` on its own. Use this order inside `sp_post_withdrawal`:
  1. `SELECT … FROM account WHERE account_id = $1 FOR UPDATE`; no row → `ACCOUNT_NOT_FOUND` (this also catches a missing or out-of-scope RLS context).
  2. Validate status, mandate and limits.
  3. Only now call `fn_check_plan_minimum(account_id, current_balance - amount)`; `false` here can only mean the minimum would be breached → `BELOW_MINIMUM_BALANCE`.
- It does **not** check account status or the plan's own status (an account on a retired plan keeps that plan's minimum), daily/withdrawal limits, business hours, the joint mandate, or negative balances (`CHECK (current_balance >= 0)` stays the last line of defence). Those remain in `sp_post_withdrawal`.

## Minimums at the time of writing (seed data, BR-03…BR-07)
Children 0.00 · Teen 500.00 · Adult 1,000.00 · Senior 1,000.00 · Joint 5,000.00. Boundary: exactly the minimum → `true`; one cent below → `false`.

## Evidence
`tests/db/fn-check-plan-minimum.test.mjs` 11/11, run in one rolled-back transaction (no rows or audit entries left behind): boundaries for all five plans, negative input, unknown/NULL inputs, data-driven minimum change, verdict independent of stored balance, `mims_app` under RLS (in scope, out of scope, no context), signature/volatility, EXECUTE grant, INACTIVE plan and FROZEN/CLOSED account behaviour. Full isolated suite recorded in `current-state.md`.

## If the contract must change
Write a new handoff. Do not change the signature or return meaning silently.
