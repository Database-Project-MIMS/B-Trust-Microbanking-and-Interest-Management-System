# Phase 04 — Fixed Deposits & Interest

**Status:** TODO · **Tasks:** 14 · **Effort:** 44 points · **Est.** ~1 week

## Entry criteria

- [ ] Phase 3 exit criteria met
- [x] **OQ-01 resolved** by ADR-0011: one active FD, partial unique index
- [x] **OQ-04 resolved** by ADR-0012: savings interest uses average daily balance
- [ ] OQ-13 mid-cycle interest and OQ-14 lecturer scope acceptance resolved
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

## Scoped M2 read-side start — 2026-10-08

Vibodha authorized P04-M02-T01 early after the incomplete M5-T02 dependency and
general gate were explained (ADR-0018). 0480 supplies the merged FD schema; disposable
fixtures validate customer linkage without money-moving opening calls. Implementation
is verified locally, REVIEW on feat/p04-m02-customer-fd-linkage: 612 tests /57 suites,
clean 29-migration rebuild/checksums, typecheck/lint/build and browser checks pass.
T01 is now DONE through merged PR #60 (dev e9291dc). This does not approve Phase 3
exit, general Phase 4 entry, OQ-13/OQ-14, or M5/M3 completion. Baseline SQL/RLS scope
is required for the T01 listing itself.

Vibodha subsequently said “do it now” for P04-M02-T02 after the pending gate was
explained. ADR-0019 authorizes its focused M2 FD read-scope completion: current-actor
restrictive SELECT guard plus direct SQL/live-session regression tests. No general
phase approval, FD financial writer or another member's read-path completion is
inferred. Existing M2 UI/API shape is unchanged; M1/M5 policy review remains.

T02 verified locally, REVIEW: 630 tests /60 suites, clean isolated 31-migration
rebuild/checksums, typecheck/lint/build pass. User publication and policy review
remain; the phase's entry/exit criteria above are not checked by this read task.
