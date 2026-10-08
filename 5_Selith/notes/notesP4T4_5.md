# Phase 4 - Part 2 (Tasks 4 and 5)

## Step 1: Creating the Interest Cycle Tracking Schema
### What I Did
I created a new branch `feat/p04-m05-interest-cycle` and wrote the database migration script (`0482_p04_m05_interest_run.sql`). This script creates two tables:
1. `interest_run`: To track the overall monthly batch process (when it started, finished, how many FDs succeeded/failed).
2. `interest_payout`: To track exactly how much money was paid to each specific FD during that run. 

I also added a unique constraint to ensure that we never accidentally pay the same Fixed Deposit twice for the same month. (I removed the manual `schema_migration` insert since our node script handles that automatically now).

### Why I Did It
The interest cycle is a massive operation. If the server crashes halfway through paying 10,000 FDs, we need to know exactly which ones were paid and which ones weren't. These tables are the "receipts" that give us a perfect audit trail and guarantee idempotency (safety against duplicate runs).


## Step 2: Creating the Interest Cycle Procedure
### What I Did
I created the massive `sp_run_interest_cycle` stored procedure. I also created a dummy `sp_post_interest_credit` ledger function to perfectly bypass the fact that Member 4 hasn't finished their task yet. Then, I wrote an automated test suite (`tests/db/sp-run-interest-cycle.test.mjs`) to prove that everything works perfectly, right down to the penny.

### Why I Did It
The interest cycle iterates over every active FD in the database. By wrapping each individual FD's payout in a `BEGIN...EXCEPTION` block, I ensured that if one single FD fails (e.g. account closed), it doesn't rollback the entire month's batch! The automated tests perfectly verified this independence and exactly simulated the 30-day date advancements.

## Step 3: Integration with Official Ledger Routine
### What I Did
Once Member 4 completed their `sp_post_interest_credit` procedure (I-5), I deleted my temporary dummy function. I then integrated the actual signature into `sp_run_interest_cycle` using a proper `CALL` statement with `OUT` parameters. During testing, I discovered a bug in M4's routine: it used `now()` for generating reference numbers, which stays constant for the entire transaction, causing unique constraint violations across the batch. I created a fix migration (`0483_p04_m05_interest_credit_fix.sql`) switching `now()` to `clock_timestamp()` and appending a substring of the FD ID to guarantee absolute uniqueness.

### Why I Did It
This completely finalizes Task 4! The tests now pass seamlessly using the actual ledger integration, and the bug fix ensures idempotency and batch processing safety. Task 4 is marked `DONE`.
