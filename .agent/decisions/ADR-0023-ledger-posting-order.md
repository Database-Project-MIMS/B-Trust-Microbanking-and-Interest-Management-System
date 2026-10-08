# ADR-0023: A posting-order key on the ledger (`transaction.ledger_seq`)

**Date:** 2026-10-08 · **Status:** user-authorized M3 implementation; M4 (table owner) review retained
**Task:** P05-M03-T01 follow-up · **Gap:** G-24

## Authorization and scope

During `/review` of the RPT-02 view the user chose "fix T01 first" and, from the options below, "add a ledger
sequence column" and "harden the view". This authorizes migrations `0542` (column) and `0543` (view v2) in M3's
Phase 5 block, an early start of the same kind as P05-M03-T01. It is not a general Phase 5 entry approval. M4
owns the `transaction` table: the change is additive, no posting routine is edited, and M4 reviews it through the
handoff.

## Problem

RPT-02 needs "the first and last ledger row of an account in a date range" to read the opening and closing
balance from the stored `balance_after`. Ordering by `transaction_date` is not reliable:

- `sp_post_deposit` and `sp_open_savings_account` stamp `now()` (the transaction START time); `sp_post_withdrawal`
  stamps `clock_timestamp()`. Postings made in one transaction tie, and a deposit that waits for the account lock
  behind a later-starting transaction gets an earlier timestamp than the row posted before it. This can happen in
  production under concurrency, not only in the seed.
- Measured on the pure seed (125 rows, 10 accounts): 73 rows tied, the balance chain broke 86 times when ordered by
  `(transaction_date, transaction_id)`, and 6 of 10 accounts' "last row" disagreed with `current_balance`.

## Options considered

1. **A sequence column (chosen).** `transaction.ledger_seq bigint NOT NULL DEFAULT nextval('transaction_ledger_seq')`,
   `UNIQUE (account_id, ledger_seq)`. Every posting routine locks the account row before inserting, so within one
   account sequence order is posting order.
2. Fix only the seed. Leaves the real concurrent-deposit inversion and the same-transaction tie risk.
3. Rebuild the order from the balance chain in the view. Ambiguous whenever a balance repeats; complex.

## Decision

- Migration `0542`: the sequence, the column (existing rows are numbered by the table rewrite that a volatile
  default causes, in physical insertion order; the immutability trigger does not fire on a rewrite), the unique index,
  `USAGE` on the sequence for `mims_app`.
- Migration `0543`: `vw_rpt02_account_summary` v2 orders by `ledger_seq`; plain `numeric` balances (no overflow cast);
  the legacy running total is a correlated sum evaluated only for rows with a NULL `balance_after` (no window over the
  whole ledger).
- `ledger_seq` is an internal ordering key, never shown to users, and gaps are normal.
- `0540` stays as shipped (it may be applied or pushed); `0543` drops and re-creates the view. Nothing depended on it.

## Consequences

- No posting routine changes. Column lists in every `INSERT INTO transaction` already omit the new column.
- Writes pay one sequence draw and one extra unique index entry per ledger row.
- Concurrent transactions on DIFFERENT accounts may commit out of sequence order; that is irrelevant because the key
  only orders rows of one account.
- The seed still stamps every row with the seed run time (all on one day), so date-range reports over seed data show
  one day. That is a seed matter (M5), recorded separately; the opening/closing balances are now correct regardless.
- Verified on the pure seed: balance-chain breaks 86 → 0; accounts whose last row disagrees with `current_balance`
  6 → 0.
