# `transaction.ledger_seq`: an additive column on M4's ledger table (for review)

**From:** Member 3 · **To:** Member 4 (owner of `transaction` and the posting routines), Member 5 (seed) · **Date:** 2026-10-08
**Migration:** `0542_p05_m03_transaction_ledger_seq.sql` · **Decision:** [ADR-0023](../decisions/ADR-0023-ledger-posting-order.md) · **Gap:** G-24 in `docs/17`
**Status:** implemented and tested by M3 at the user's direction; M4 review retained (AGENTS §13: a change to another member's table goes through a handoff).

## What changed on your table
- New sequence `transaction_ledger_seq` and column `transaction.ledger_seq bigint NOT NULL DEFAULT nextval('transaction_ledger_seq')`, with `UNIQUE (account_id, ledger_seq)` (`ux_transaction_account_ledger_seq`). `mims_app` has `USAGE` on the sequence.
- **No posting routine was edited.** Every `INSERT INTO transaction` already names its columns, so the default applies. Your routines, the reversal routine and the interest credit all still pass their suites.
- Existing rows are numbered by the table rewrite that a volatile default causes, in physical (insertion) order; the immutability trigger does not fire on a rewrite and was not disabled.

## Why
Timestamps do not give a reliable posting order: `sp_post_deposit` (and the opening deposit) stamp `now()` (the transaction START time), `sp_post_withdrawal` stamps `clock_timestamp()`, so postings in one transaction tie and a deposit that waited for the account lock behind a later-starting transaction is stamped **earlier** than the row before it. On the pure seed that gave 86 balance-chain breaks and 6 of 10 accounts whose last row disagreed with `current_balance`; ordered by `ledger_seq` both are 0. RPT-02 needs the exact first/last row of an account in a range.

## What you should know / check
- **Within one account, a larger `ledger_seq` was posted later**, because posting routines lock the account row before inserting. Across different accounts the order means nothing. It is internal: never display it.
- **Gaps are normal** (rollbacks). Do not use it as a count.
- **Follow-up for you (verified by grep, not changed by me):** these order by `transaction_date` and can pick the wrong row under ties: the statement query at `services/transaction-service.ts:151` (`ORDER BY transaction_date DESC`) and the running-balance window in `database/migrations/0561_p05_m04_reconciliation_views.sql:61` (`ORDER BY t.transaction_date, t.transaction_id`). Ordering by `ledger_seq` makes them exact. (`tests/db/transaction-running-balance.test.mjs` already fails on dev for its own reasons; I did not investigate it.) I did fix my own use in `services/account-service.ts` (account page "last transaction").
- **`docs/04`** now lists `balance_after` (nullable; opening deposits before `0541` are NULL) and `ledger_seq` on the `transaction` table.
- A schema rebuild from empty works (the column is added to an empty table); the dev-database upgrade rewrites the table once.

## Evidence
`tests/db/transaction-ledger-seq.test.mjs` 7/7 (column/default/unique index, strictly increasing under identical timestamps, a later posting stamped earlier still larger, `sp_post_deposit` as `mims_app`, grant and immutability, duplicate rejected, backfill technique). Full suite: the same failures as dev without this change; every posting-routine suite passes.
