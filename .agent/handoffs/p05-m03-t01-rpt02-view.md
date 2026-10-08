# P05-M03-T01: RPT-02 account summary view

**From:** Member 3 · **To:** Member 4 (ledger, `balance_after`), Member 1 (report framework, RLS) · **Date:** 2026-10-08
**Task:** P05-M03-T01 · **Status:** built and tested. Early start at the user's direction; not a general Phase 5 entry approval. T02 (report service, API, CSV, page) is the next round.

## What exists now
- **`0540_p05_m03_rpt02_view.sql`: `vw_rpt02_account_summary`** (`security_invoker`, `security_barrier`, `SELECT` granted to `mims_app`). One row per account per ledger event; an account with no ledger rows appears once with NULL transaction columns. Columns: account (`account_id`, `account_number`, `branch_id`, `plan_id`, `plan_name`, `account_status`, `current_balance`, `opened_date`) and event (`transaction_id`, `transaction_type`, `activity_type`, `amount`, `effective_amount`, `balance_effect`, `transaction_date`, `balance_after`, `balance_after_effective`, `balance_before`).
- **`0541_p05_m03_sp_open_account_balance_after.sql`:** `sp_open_savings_account` (0243) wrote the initial-deposit ledger row **without `balance_after`**. `0361` only backfilled rows that existed when it ran and the ledger is immutable, so every opening deposit since has `balance_after = NULL`. From 0541 the opening deposit records it (= the deposit; the account is new). The procedure body is 0243's, unchanged except that one `INSERT`. Signature, `SECURITY INVOKER` and the error contract are the same.

## How to use the view in the T02 report query
- **Opening balance** for `[from, to]` = `balance_before` of the first row with `transaction_date >= from`; if there is none, the account's `current_balance`.
- **Closing balance** = `balance_after_effective` of the last row with `transaction_date < to + 1 day`; if there is none, the opening balance.
- **Totals:** `SUM(effective_amount) FILTER (WHERE activity_type = 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST_CREDIT')` and counts by `activity_type`. Reversals are counted in their original transaction's category with a negated amount (as RPT-05 does), so `closing − opening = deposits − withdrawals + interest` holds for every range. `tests/db/rpt02-view.test.mjs` asserts that identity for each range it tries.
- **Dates:** use Colombo calendar days, `[from::date at Asia/Colombo, (to + 1)::date at Asia/Colombo)`, exactly as the other report services do. The view itself never takes a range.
- **Scope:** the view adds none. Apply the branch scope in the report query's `WHERE` and rely on the caller's RLS context (`setRlsContext`), as the other reports do.
- The `ix_transaction_account_date (account_id, transaction_date DESC)` index serves the per-account lookups; the card asks for an `EXPLAIN ANALYZE` of the final range query in T02.

## Things to know
- **Legacy NULL `balance_after`.** Opening deposits made between 0243 and 0541 have `balance_after = NULL` and cannot be updated. The view derives their balance from the signed running total of the ledger up to that row (`balance_after_effective`); an opening deposit is an account's first row, so that equals the true balance. Every other row uses the stored value, never a recomputation (card acceptance criterion).
- **Ordering.** Rows of an account are ordered by `(transaction_date, transaction_id)`. That is chronological as long as each posting is its own DB transaction, which the application always does (AGENTS §11). Postings made inside **one** transaction can share a timestamp: `sp_post_deposit` uses the transaction's `now()`, `sp_post_withdrawal` uses `clock_timestamp()`. The seed loads about 120 postings in one `DO` block, so seeded accounts can have equal or out-of-order timestamps. Stored balances are unaffected, but "which row is first/last in the range" can pick the wrong one there. **Check the T02 report against the seeded accounts**; if it matters, the tie-break needs a real sequence column from M4.
- **`docs/04` says `transaction.balance_after` is `NOT NULL`; the real column is nullable** (0361 added it as `numeric(15,2)`). Recorded in `.agent/open-questions.md`; the schema docs are M4's.
- **The task card's SQL used `transaction.posted_at` and `transaction.status`; neither exists.** The timestamp is `transaction_date`; every ledger row is posted.

## Evidence
- `tests/db/rpt02-view.test.mjs` 13/13, in one rolled-back transaction with hand-built ledgers: columns, invoker/barrier options and the grant; per-event rows with signed effects and a reversal in its original category; whole range, middle range, single days (a withdrawal and its reversal) each satisfying the balance identity; ranges before the first and after the last row (opening = closing); an account with no ledger rows; legacy NULL derivation; stored `balance_after` winning over a ledger sum when the balance began outside the ledger; account/plan columns; `mims_app` under RLS (own branch sees the rows, another branch and no context see none); a real `sp_open_savings_account` + `sp_post_deposit` chain with a stored `balance_after` on the opening deposit; the procedure's signature and zero-deposit path unchanged.
- Test 12 was checked against a tree without `0541`: it fails there (`balance_after` is null) and passes with it. The suite passed on three fresh databases in a row.
- `tests/db/sp-open-savings-account.test.mjs` (29 tests) still passes with 0541.
- Full isolated suite: 852 tests, 824 pass, 28 fail, 0 cancelled. The 28 are failures that already occur on dev without this work (a clean export of the committed `HEAD` failed 29 tests, 27 of them the long-standing set); none involve RPT-02. `tsc --noEmit` and `eslint .` pass.

## Not done (T02)
Report service, `GET /api/reports/account-summary`, CSV, access auditing, the real page (the current `/reports/account-summary` is the mock `WorkflowScreen`), API/markup tests, and the `EXPLAIN ANALYZE`.
