# Phase 6 Task 1 - Interest Re-run Idempotency & Report Reconciliation

Task ID: P06-M05-T01
Branch: feat/p06-m05-idempotency-tests

## Steps completed:
1. Created `tests/db/interest-idempotency.test.mjs` according to the exact specification laid out in AC-08 and AC-09.
2. **Idempotency (AC-08):**
   - Verified that running `sp_run_interest_cycle` creates the expected payout records, interest run state, and linked `INTEREST_CREDIT` transactions.
   - Verified that re-running for the same cycle date results in a unique constraint violation (`23505`).
   - Verified that directly duplicating an `interest_payout` row for the same FD and cycle results in a unique constraint violation.
   - Verified that partial failures during the cycle correctly log exceptions and do not rollback successfully completed FD interest payouts.
3. **Report totals reconciliation (AC-09):**
   - Verified RPT-03: `vw_rpt03_active_fds` total principal exactly matches `SELECT SUM(principal_amount) FROM fixed_deposit WHERE status = 'ACTIVE'`.
   - Verified RPT-04: `vw_rpt04_interest_distribution` total interest (excluding ROLLUPs) exactly matches `SELECT SUM(interest_amount) FROM interest_payout`.
   - Verified Ledger Integrity: Count of `interest_payout` rows precisely matches the count of `INTEREST_CREDIT` transaction rows.
4. The test ran successfully and demonstrated perfect isolation from other potentially flaky routines.

## Status: DONE
