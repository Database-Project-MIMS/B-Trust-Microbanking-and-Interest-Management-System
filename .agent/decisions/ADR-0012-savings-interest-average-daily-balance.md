# ADR-0012: Savings accounts earn interest, on average daily balance

**Date:** 2026-10-02 · **Status:** Accepted · **Resolves:** OQ-04 (ERD gap G-12)

## Decision

Savings accounts earn interest, in addition to fixed deposits. The central 30-day interest
cycle processes **both**. Savings interest is calculated on the **average daily balance**:

```
interest = round( Σ(daily closing balance over the cycle) × plan_rate ÷ 365 , 2 )
```

`plan_rate` is the account's `savings_plan.interest_rate`, an annual fraction (10% =
`0.1000`). The daily closing balance for each day comes from the ledger's `balance_after`
on that day's last posted row, carried forward on days with no activity. This is the
actual/365 basis already used for FDs (`docs/07_business-rules.md`, BR-14).

Rates and minimums are the seeded plans: Children 12% (min 0), Teen 11% (500), Adult 10%
(1000), Senior 13% (1000), Joint 7% (5000).

## Schema change

`interest_payout` can reference a savings account as well as an FD:

- `fd_id` becomes nullable
- add `account_id uuid NOT NULL`
- add `source_type CHECK (source_type IN ('FIXED_DEPOSIT', 'SAVINGS'))`
- add `CHECK (source_type = 'SAVINGS' OR fd_id IS NOT NULL)`

`interest_payout.transaction_id` stays `UNIQUE`: exactly one `INTEREST_CREDIT` ledger row
per distribution (BR-14).

## Why

The brief gives an interest rate to every savings plan, and RPT-04 groups the monthly
distribution by account type. Average daily balance is the standard retail method, is not
gameable by a deposit just before the run, and is a good set-based SQL showcase over the
ledger. It depends on `transaction.balance_after` (gap G-14, `docs/04_database-schema.md`).

## What it rules out

- Interest on the balance at the moment the run executes
- Computing balances in JavaScript instead of SQL
- A savings credit posted outside the ledger routine

## Consequences

- Phase 4 is roughly double the size originally planned (OQ-04 option b).
- `sp_run_interest_cycle` handles both sources, one transaction per distribution
  (FR-INT-04).
- Tests must cover: deposit mid-cycle, withdrawal mid-cycle, no activity, account opened
  mid-cycle, and a zero-interest case.
- Open detail for Phase 4: whether an account opened or closed mid-cycle earns for part of
  the cycle (assumed yes, only for the days it was open).
- RPT-04 groups by savings plan and by FD product; update its definition in
  `docs/01` and `docs/05`.
