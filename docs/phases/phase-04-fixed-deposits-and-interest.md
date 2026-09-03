# Phase 04 — Fixed Deposits & Interest

**Status:** TODO · **Tasks:** 14 · **Effort:** 44 points · **Est.** ~1 week

## Entry criteria

- [ ] Phase 3 exit criteria met
- [ ] **OQ-01 resolved** (G-01 — one active FD vs one FD ever). Determines whether
      `fixed_deposit` uses a partial unique index or the ERD's plain `UNIQUE`.
- [ ] **OQ-04 resolved** (G-12 — do savings accounts accrue interest?). Determines the size
      of `sp_run_interest_cycle` and the meaning of RPT-04.
- [ ] G-11 (rate snapshot) and G-23 (`maturity_date`) approved

## Tasks by member

| Member | Focus |
|---|---|
| **M1** | Worker authentication for interest runs; run authorization and audit; cycle configuration |
| **M2** | Customer↔FD linkage view; customer FD listing; branch-scoped FD access |
| **M3** | Account-side FD eligibility read under lock (**I-6**); closure rule (zero balance, no active FD); FD panel on the account page |
| **M4** | `INTEREST_CREDIT` posting through the ledger routine (**I-5**); interest credits in the statement with correct running balance |
| **M5** | `fixed_deposit`, `interest_run`, `interest_payout`; `fn_calculate_fd_interest`; `sp_open_fixed_deposit`; `sp_run_interest_cycle`; FD pages and the interest run console |

## The interest formula

```
interest = round(principal × interest_rate_at_opening × 30 / 365, 2)
```

Exact `NUMERIC` throughout. The rate comes from the **FD's snapshot column**, never from
`fd_plan` — otherwise editing a product rate would retroactively change every past payout
(BR-19, G-11).

Example: LKR 100,000 at 14% → `100000 × 0.1400 × 30 / 365` = **LKR 1,150.68**.

## Two design points that carry the phase

**One transaction per FD, not per run.** FR-INT-04 requires that a failed distribution roll
back without affecting FDs already processed. So `sp_run_interest_cycle` opens the run, then
processes each due FD in its own transaction, recording failures in `exception_count`.
Wrapping the whole run in one transaction would violate the requirement.

**Idempotency by constraint.** `UNIQUE(cycle_date)` on `interest_run` and
`UNIQUE(fd_id, cycle_date)` on `interest_payout` are what make NFR-SAFE-03 true. A re-run
fails on the constraint rather than relying on a procedural check that a crash could skip.

## Exit criteria

- [ ] An FD opens against an active account, debiting the principal atomically
- [ ] A second **active** FD on the same account is rejected by the database
- [ ] `maturity_date` and `interest_rate_at_opening` are fixed at opening
- [ ] Insufficient balance → no FD row and no debit
- [ ] `fn_calculate_fd_interest` returns exact 2-decimal `NUMERIC`; verified against worked examples
- [ ] An interest run credits each due FD as a **separate `INTEREST_CREDIT` transaction**
- [ ] `next_interest_date` advances by 30 days per payout
- [ ] **Re-running the same cycle produces no duplicate payout and no duplicate ledger row** (AC-08)
- [ ] One failing FD does not roll back completed distributions; `exception_count` records it
- [ ] The run records `fd_count`, `total_interest` and `exception_count`, and they reconcile
- [ ] Account closure requires zero balance and no active FD

## Risks

| Risk | Mitigation |
|---|---|
| OQ-04 chosen late, doubling scope | Escalate to the lecturer during Phase 2 |
| Interest computed in JavaScript | The function is PL/pgSQL with `NUMERIC`; tests assert exact values |
| Rounding drift across many payouts | Round once, at the end, in the database (SRS §7.1) |
| M5 overloaded in this phase (18 pts) | M3 and M4 own the account-side and ledger-side halves |
