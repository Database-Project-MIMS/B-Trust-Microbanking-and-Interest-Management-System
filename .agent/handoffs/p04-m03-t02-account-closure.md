# P04-M03-T02: account closure (BR-18)

**From:** Member 3 · **To:** Member 1 (audit search, RLS), Member 5 (FD lifecycle), Member 4 (ledger/statement tests), anyone whose tests set `account.status = 'CLOSED'` · **Date:** 2026-10-08
**Task:** P04-M03-T02 · **Status:** published and tested. Early start at the user's direction; not a Phase 3 exit or general Phase 4 entry approval. Backend only: no UI.

## What exists now
- Migration `database/migrations/0441_p04_m03_sp_close_account.sql`:
  - `sp_close_account(p_account_id uuid, p_actor_user_id uuid, OUT p_closed_at timestamptz)`: `SECURITY INVOKER`, the caller owns the transaction. Locks the account `FOR UPDATE`, then re-validates: `ACCOUNT_NOT_FOUND` (also RLS-hidden) → `ACCOUNT_ALREADY_CLOSED` → `ACCOUNT_NOT_ACTIVE` (a FROZEN account is not closed) → `BALANCE_NOT_ZERO` → `ACTIVE_FD_EXISTS`; then sets `CLOSED` and writes one `audit_log` row with `action = 'CLOSE'` for the acting user.
  - `trg_account_close_guard` / `fn_account_close_guard()`: `BEFORE UPDATE OF status ON account`, only when the new status is `CLOSED` and the old one was not. Rejects the move unless `current_balance = 0` and no `fixed_deposit` has status `ACTIVE`. `SECURITY DEFINER` with a pinned `search_path` (same pattern as `fn_next_account_number`, `0246`), execute revoked from PUBLIC.
- `closeAccount(accountId, actor)` in `services/account-service.ts` and `POST /api/accounts/{id}/close` (BRANCH_MANAGER of the account's branch, CSRF required). `200 { data: { accountId, status: "CLOSED", closedAt } }`; `404` outside the branch; `409 ACCOUNT_ALREADY_CLOSED | ACCOUNT_NOT_ACTIVE | BALANCE_NOT_ZERO | ACTIVE_FD_EXISTS`. The route used to return a `501` stub.
- Error mapping in `services/account-errors.ts` (`ck_close_account_*`), fixed safe messages.

## Why a guard trigger as well as the procedure
`fixed_deposit` has row-level security for `mims_app` (0420/0421): ADMIN sees no FD rows, an AGENT sees only assigned customers' FDs, and a restrictive actor guard applies. A check run as the caller can therefore miss an FD. The procedure still checks as the caller (clean early error), and the trigger is the guarantee: it reads `fixed_deposit` as the table owner, so it cannot be fooled by RLS, and a direct `UPDATE … SET status = 'CLOSED'` runs the same rule. Test 11 proves both with a caller that cannot see the FD.

The trigger also locks the account row `FOR UPDATE` before it checks. A plain `UPDATE` only takes a `NO KEY UPDATE` lock, which does not conflict with the `KEY SHARE` lock an in-flight `fixed_deposit` insert holds through its foreign key, so without that lock a direct close could run beside an uncommitted FD. With it, the close waits for the insert, then sees the committed FD (test 15, two real connections; removing the lock makes that test fail).

**Not covered:** an FD inserted *after* the account is already `CLOSED` by SQL that neither locks the account nor checks its status. `fixed_deposit` is M5's table; `sp_open_fixed_deposit` locks the account and checks `ACTIVE`, so no application path does this. A `BEFORE INSERT` guard on `fixed_deposit` requiring an ACTIVE account would close it (suggestion for M5, in `.agent/open-questions.md`).

## Why `FOR UPDATE`
Inserting a `fixed_deposit` takes a `KEY SHARE` lock on its account through the foreign key. `FOR UPDATE` conflicts with that lock (`FOR NO KEY UPDATE`, used by `sp_add_account_holder`, does not), so "close" and "open FD" on the same account serialize. M5's `sp_open_fixed_deposit` already locks the account `FOR UPDATE` first, and `fn_fd_funding_verdict` (I-6) does too. Because the guard trigger takes the same lock, both the procedure path and a direct `UPDATE` serialize against an FD open.

## Behaviour to know
- **Only an ACTIVE account closes.** A FROZEN account must be unfrozen first; the card's SQL did not check status. A decision, recorded in `.agent/open-questions.md`.
- **Two audit rows per close.** The `CLOSE` row (explicit, `old_values`/`new_values` with status and balance) and the generic `UPDATE` row from `trg_audit_account` (0200), both for the same acting user. Audit search (M1) can filter on `action = 'CLOSE'`.
- **No Idempotency-Key.** Nothing moves money; a repeat call returns `409 ACCOUNT_ALREADY_CLOSED`.
- **The task card's SQL was corrected.** It wrote `before_value` / `after_value`; the table's columns are `old_values` / `new_values` (`0104`).
- **Fixtures that close an account now need a zero balance and no ACTIVE FD** (a direct `UPDATE … SET status = 'CLOSED'` runs the guard). Two of M3's own fixtures were adjusted (`tests/db/fn-check-account-fd-eligible.test.mjs`); `tests/api/accounts.test.mjs:482` and `tests/db/fn-check-plan-minimum.test.mjs` already close zero-balance accounts and pass.
- **Nothing reopens a closed account** and there is no unfreeze path yet.

## Evidence
- `tests/db/sp-close-account.test.mjs` 17/17. Tests 1–14 run in one rolled-back transaction: success with both audit rows; non-zero balance; ACTIVE FD; MATURED/CLOSED FDs do not block; balance reported before FD; already closed (one `CLOSE` audit only); FROZEN; unknown account and NULL/mismatched actor; guard trigger on direct `UPDATE` (balance, FD) and its `WHEN` clause (freeze with an FD still allowed, an already-closed account can be touched); guard sees an RLS-hidden FD, directly and through the procedure; `mims_app` in scope / other branch / no context; privileges and `SECURITY` flags; `FOR UPDATE` in the definition plus a second connection's FD insert blocking on a locked account (55P03). Tests 15–17 use COMMITTED fixtures (removed in `after()`) and two real connections: a direct `UPDATE` and `CALL sp_close_account` each wait for an uncommitted FD insert, then are rejected with `ACTIVE_FD_EXISTS` once it commits; with no FD in flight a committed zero-balance account closes. Test 15 was checked against a version of the trigger without the lock and fails there.
- `tests/api/accounts.test.mjs` replaced the 501 test with 6: manager success with the audit's `user_id`; AGENT/CENTRAL_OPS/CUSTOMER 403, missing CSRF 403, no session 401, other-branch manager 404; BALANCE_NOT_ZERO; ACTIVE_FD_EXISTS with MATURED/CLOSED not blocking; already closed and FROZEN; malformed id 400. Error bodies carry no SQL text or ids.
- Full isolated suite: 777 tests, 750 pass, 27 fail, 0 cancelled. The 27 are the failures already on dev 93a82f8 (see `.agent/open-questions.md`); none involve this task. `tsc --noEmit`, `eslint .` and `next build` pass.

## Not done
- No "Close account" button or confirmation on `/accounts/{id}` (backend only, by scope). T03 (read-only FD panel on the account page, which can also say closure is blocked by an active FD) is separate.
- No unfreeze path, so a FROZEN account cannot currently be closed through the app.
