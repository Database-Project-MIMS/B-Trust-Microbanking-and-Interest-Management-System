# P05-M03-T01: RPT-02 account summary view

**From:** Member 3 · **To:** Member 4 (ledger, `balance_after`), Member 1 (report framework, RLS) · **Date:** 2026-10-08
**Task:** P05-M03-T01 · **Status:** built and tested. Early start at the user's direction; not a general Phase 5 entry approval. T02 (report service, API, CSV, page) is the next round.

## What exists now
- **`0540_p05_m03_rpt02_view.sql`:** first version of `vw_rpt02_account_summary`. Shipped earlier, so it is **left as is**; `0543` replaces it.
- **`0541_p05_m03_sp_open_account_balance_after.sql`:** `sp_open_savings_account` (0243) wrote the initial-deposit ledger row **without `balance_after`**. `0361` only backfilled rows that existed when it ran and the ledger is immutable, so every opening deposit since had `balance_after = NULL`. From 0541 it records it (= the deposit; the account is new). The procedure is 0243's, unchanged except that one `INSERT`.
- **`0542_p05_m03_transaction_ledger_seq.sql` (G-24, ADR-0023):** `transaction.ledger_seq bigint NOT NULL DEFAULT nextval('transaction_ledger_seq')`, `UNIQUE (account_id, ledger_seq)`, `USAGE` on the sequence for `mims_app`. It is the posting order of a row within its account. No posting routine changed. See [the handoff to M4](p05-m03-ledger-seq-for-m4.md).
- **`0543_p05_m03_rpt02_view_v2.sql`:** drops and re-creates the view: ordered by `ledger_seq`, plain `numeric` balances (no overflow cast), and the legacy running total is a correlated sum evaluated only for rows with a NULL `balance_after` (no window function). `security_invoker` + `security_barrier`, `SELECT` granted to `mims_app`.

Columns of the view: account (`account_id`, `account_number`, `branch_id`, `plan_id`, `plan_name`, `account_status`, `current_balance`, `opened_date`) and event (`transaction_id`, `ledger_seq`, `transaction_type`, `activity_type`, `amount`, `effective_amount`, `balance_effect`, `transaction_date`, `balance_after`, `balance_after_effective`, `balance_before`). One row per account per ledger event; an account with no ledger rows appears once with NULL transaction columns.

## How to use the view in the T02 report query
- **Opening balance** for `[from, to]` = `balance_before` of the row with the **smallest `ledger_seq`** among rows with `transaction_date >= from`; if there is none, the account's `current_balance`.
- **Closing balance** = `balance_after_effective` of the row with the **largest `ledger_seq`** among rows with `transaction_date < to + 1 day`; if there is none, the opening balance.
- **Never order by `transaction_date`** to pick first/last: it ties and inverts. Order by `ledger_seq`.
- **Totals:** `SUM(effective_amount) FILTER (WHERE activity_type = 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST_CREDIT')` and counts by `activity_type`. Reversals are counted in their original transaction's category with a negated amount (as RPT-05), so `closing − opening = deposits − withdrawals + interest` for every range; the tests assert that identity.
- **Dates:** Colombo calendar days, `[from::date at Asia/Colombo, (to + 1)::date at Asia/Colombo)`, as the other report services do. The view never takes a range.
- **Scope:** the view adds none. Apply the branch scope in the report query's `WHERE` and rely on the caller's RLS context (`setRlsContext`).
- **Plans (measured, 40,000 synthetic ledger rows over two branches):** a single-account lookup is an index scan (0.13 ms, the legacy running total is skipped by a one-time filter); a one-branch aggregate reads only that branch's rows (about 9,600 of 40,125). The card asks for an `EXPLAIN ANALYZE` of the final range query in T02.

## Things to know
- **Legacy NULL `balance_after`.** Opening deposits made between 0243 and 0541 stay NULL (immutable). The view derives them from the signed ledger total up to that row in `ledger_seq` order; an opening deposit is an account's first row, so that equals the true balance. Every other row uses the stored value, never a recomputation.
- **The seed has balances that began outside the ledger.** All 10 seeded accounts' first ledger row has `balance_before` ≠ 0, because the seed inserts accounts with a balance directly. That is why the report must use the stored `balance_after` (as it does) and why summing the ledger would be wrong for them.
- **Seed dates.** Every seeded transaction has the seed run time as `transaction_date` (one day). Opening/closing balances are now right, but a date-range report over seed data shows one day. Seed owner: M5 (recorded in `open-questions.md`).
- **`docs/04` said `transaction.balance_after` is `NOT NULL`; it is nullable.** `docs/04`'s transaction table now lists `balance_after` (nullable) and `ledger_seq`.
- **The task card's SQL used `transaction.posted_at` and `transaction.status`; neither exists.**

## Evidence
- `tests/db/rpt02-view.test.mjs` 18/18, in one rolled-back transaction with hand-built ledgers: columns and options; per-event rows with signed effects and a reversal in its original category; whole range, middle range, single days each satisfying the balance identity; ranges before the first and after the last row; an account with no ledger rows; legacy NULL derivation (also when the NULL row was posted first but stamped later); stored `balance_after` winning when a balance began outside the ledger; account/plan columns; `mims_app` under RLS; a real `sp_open_savings_account` + `sp_post_deposit` chain; the procedure's signature unchanged; **tied timestamps keep posting order; a later-posted but earlier-stamped row is still last; two out-of-range legacy rows do not make the view fail; the view has no window function and no `numeric(15,2)` cast.**
- `tests/db/transaction-ledger-seq.test.mjs` 7/7: column type/default/unique index; strictly increasing values even with identical timestamps; a later posting stamped earlier still gets the larger value; `sp_post_deposit` run as `mims_app` fills it; `USAGE` grant and immutability; a duplicate `(account_id, ledger_seq)` is rejected; the 0542 backfill technique numbers existing rows in insertion order.
- On the **pure seed** (125 rows, 10 accounts): ordered by timestamp there were 86 balance-chain breaks and 6 of 10 accounts' last row disagreed with `current_balance`; ordered by `ledger_seq` both are 0.
- Test 12 fails without `0541` (checked earlier); `sp-open-savings-account` (29 tests) and every posting-routine suite still pass.
- `tests/api/accounts.test.mjs` +1: the account page's "last transaction" now follows `ledger_seq` (it ordered by timestamp, same flaw), checked with tied and inverted timestamps.
- Full isolated suite: 865 tests, 837 pass, 28 fail, 0 cancelled. The 28 are failures that also occur on dev without this work (a clean export of the committed `HEAD` failed 29); none involve RPT-02 or `ledger_seq`. `tsc --noEmit` and `eslint .` pass.

## Not done (T02)
Report service, `GET /api/reports/account-summary`, CSV, access auditing, the real page (the current `/reports/account-summary` is the mock `WorkflowScreen`), API/markup tests, and the `EXPLAIN ANALYZE`.
