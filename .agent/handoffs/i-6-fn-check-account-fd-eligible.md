# I-6: `fn_check_account_fd_eligible` — account-side FD eligibility for `sp_open_fixed_deposit`

**From:** Member 3 · **To:** Member 5 (`P04-M05-T02` `sp_open_fixed_deposit`) · **Date:** 2026-10-08
**Task:** P04-M03-T01 · **Status:** published and tested. Built as an early start at the user's direction; this is not a Phase 3 exit or general Phase 4 entry approval.

## Where it lives
Migration `database/migrations/0440_p04_m03_fn_check_account_fd_eligible.sql` (M3's Phase 4 block 0440–0459, as the task card prescribes). Functions only: no table, grant or data change. It sorts before M5's `0480`; that is fine because the function bodies are late-bound PL/pgSQL.

## Signatures (exact)
```sql
fn_check_account_fd_eligible(p_account_id uuid) RETURNS boolean                      -- the task-card contract
fn_fd_funding_verdict(p_account_id uuid, p_principal numeric(15,2)) RETURNS text     -- optional richer helper
```
Both SECURITY INVOKER (RLS applies).

## Contract for M5 (from the task card, verbatim)
- M5's `sp_open_fixed_deposit` must `SELECT status, current_balance FROM account WHERE account_id = $1 FOR UPDATE` **first** — lock before deciding — then call `fn_check_account_fd_eligible(account_id)` and separately compare `current_balance >= principal_amount`.
- `false` → `409 ACCOUNT_NOT_ACTIVE`; insufficient balance → `409 INSUFFICIENT_FUNDS`. These are two distinct checks — do not collapse them into one function, since they map to two different error codes in `docs/05_api-and-pages.md`.
- The one-active-FD-per-account constraint itself (`fixed_deposit` partial unique index, G-01) is M5's own table's job, not M3's — M3 only owns the account-status/balance read contract.

## `fn_check_account_fd_eligible` (card contract)
- `true` only when the account exists, is visible to the caller and has `status = 'ACTIVE'` (BR-11). STABLE, takes no lock, never raises (also safe in a read-only transaction).
- It does **not** check the balance or an existing FD.
- Use order inside `sp_open_fixed_deposit`: (1) locked read of the account, no row → `ACCOUNT_NOT_FOUND`; (2) this function false → `409 ACCOUNT_NOT_ACTIVE`; (3) `current_balance < principal` → `409 INSUFFICIENT_FUNDS`; (4) debit and `INSERT INTO fixed_deposit` in the same transaction. A second active FD raises `23505` on `uq_one_active_fd_per_account` → `409 ACTIVE_FD_EXISTS`.

## `fn_fd_funding_verdict` (optional, one call)
Locks the account row itself (`FOR UPDATE`, so it is VOLATILE) and returns the first failure, in this order:

| Verdict | Meaning | Suggested mapping |
|---|---|---|
| `INVALID_PRINCIPAL` | NULL, zero or negative principal (decided before any lock) | `400/422` |
| `ACCOUNT_NOT_FOUND` | unknown account, or one the caller's RLS context cannot see | `404` |
| `ACCOUNT_NOT_ACTIVE` | `FROZEN` or `CLOSED` | `409 ACCOUNT_NOT_ACTIVE` |
| `ACTIVE_FD_EXISTS` | the account already has an `ACTIVE` FD; `MATURED`/`CLOSED` FDs do not block (ADR-0011) | `409 ACTIVE_FD_EXISTS` |
| `INSUFFICIENT_BALANCE` | `current_balance < principal` | `409 INSUFFICIENT_FUNDS` |
| `OK` | fundable | continue |

It writes nothing (no balance change, no ledger row, no audit row). The lock lasts until your transaction ends, so re-reading `current_balance` for the debit afterwards is safe.

## Limits you must know about
- **`ACTIVE_FD_EXISTS` is best-effort, not the guard.** It reads `fixed_deposit` as the *caller*, and `fixed_deposit` has row-level security (0420/0421): only AGENT (assigned customers), BRANCH_MANAGER, CENTRAL_OPS, AUDITOR and CUSTOMER contexts can read FD rows, and a restrictive actor guard applies on top. An ADMIN context sees no FD rows, so the verdict can say `OK` while an active FD exists (pinned by test 16). The unique index `uq_one_active_fd_per_account` is the authoritative guard and still rejects the insert (`23505`). The check deliberately does not bypass RLS, so there is no SECURITY DEFINER escape hatch.
- **Not "never raises".** `fn_fd_funding_verdict` never raises for bad input, but like any `SELECT … FOR UPDATE` it waits for a competing lock on the account (so it can hit `lock_timeout` or a deadlock) and cannot run in a read-only transaction (`25006`, test 17). The card function has none of these limits.
- **The plan minimum is not applied.** BR-09 governs withdrawals and the card asks only for ACTIVE + sufficient balance, so the whole balance may fund an FD. If the team decides otherwise, add `fn_check_plan_minimum(account_id, current_balance - principal)` in `sp_open_fixed_deposit` (an open question, recorded in `.agent/open-questions.md`).
- **Set the RLS context first** (`setRlsContext`). With no context the account is invisible: the card function returns `false` and the verdict returns `ACCOUNT_NOT_FOUND`. Do not map a bare `false` to `ACCOUNT_NOT_ACTIVE` without the locked read in step 1.
- **Run it in READ COMMITTED**, as for I-4.

## Observations on the current `sp_open_fixed_deposit` in dev (not changed by this task)
- `database/routines/sp_open_fixed_deposit.sql` inlines its own lock/status/balance checks (its comment says "to remain unblocked") and does not call I-6, so it was never blocked on this task.
- It debits `account.current_balance` with a direct `UPDATE` and writes no `transaction` row or audit entry, which breaks the ledger rule in AGENTS.md §5. The I-5 posting path (`P04-M04-T01`) is the intended route, and `transaction.transaction_type` has no FD-funding type yet (a decision for M4/M5).
- A search of the repository finds no `INSERT`/`UPDATE` grant or write policy on `fixed_deposit` for `mims_app` (0420 grants only column-level `SELECT`). Not run-tested: unless M5's opening path is granted write access, it cannot insert FDs when run as the application role.

## Evidence
`tests/db/fn-check-account-fd-eligible.test.mjs` 20/20, fixtures in one rolled-back transaction: card function true/false cases; balance boundary (exact principal passes, one cent over fails); invalid principal; unknown account; FROZEN/CLOSED; ACTIVE blocks, MATURED/CLOSED do not; reason ordering; plan minimum not applied; no side effects (balance, ledger, audit counts unchanged); a second connection cannot `FOR UPDATE NOWAIT` the locked row (55P03); signatures and volatility; `mims_app` under RLS (in scope, other branch, no context); EXECUTE grant; an assigned AGENT sees the FD (`ACTIVE_FD_EXISTS`); an ADMIN context cannot see it and the unique index still stops a duplicate (23505); read-only transaction (25006); lock wait (the verdict blocks while another connection holds the row, then answers).

Full isolated suite on the tree merged with dev 93a82f8: 755 tests / 728 pass / 27 fail / 0 cancelled. A clean export of origin/dev fails the same 27 tests (735 tests; plus 11 cancelled in M1's `business-rules` and `business-hours-limits`, whose stale fixtures M3 repaired, see [m3-cross-member-test-fixture-repairs.md](m3-cross-member-test-fixture-repairs.md)). None of the 27 involve this task; they are listed in `.agent/open-questions.md`.

## If the contract must change
Write a new handoff and a new migration (0440 is immutable once merged). Do not change the signatures or return meanings silently.
