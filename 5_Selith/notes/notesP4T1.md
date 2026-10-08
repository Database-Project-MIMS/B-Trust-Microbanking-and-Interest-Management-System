# Notes for Phase 4 Tasks

## Task 1: Fixed Deposit Schema (P04-M05-T01)

### What I Did
- Created a new SQL migration file: `database/migrations/0480_p04_m05_fixed_deposit.sql`.
- Added the `fixed_deposit` table with exact constraints for `principal_amount`, `interest_rate_at_opening`, dates, and `status`.
- Created a partial unique index (`uq_one_active_fd_per_account`) on `account_id` where `status = 'ACTIVE'`.
- Created an index `ix_fd_due_interest` to optimize queries looking for FDs needing interest payouts.
- Logged the version `480` into the `schema_migration` table inside the same transaction block.

### Why I Did It
- This fulfills `P04-M05-T01` perfectly according to the specs in `06_P4_fd-schema-opening.md`. 
- The partial unique index is the database-level backstop ensuring an account can NEVER have more than one active FD simultaneously (Rule G-01, BR-12), regardless of what the backend code does.
- Taking `interest_rate_at_opening` as a snapshot fulfills BR-19 and G-11. 
- Using standard `NUMERIC` types avoids floating-point inaccuracies.

## Task 3: Interest Calculation Function (P04-M05-T03)

### What I Did
- Created `database/routines/fn_calculate_fd_interest.sql`.
- Wrote the pure function taking `principal`, `rate`, and `days` (default 30).
- Computed `round(p_principal * p_rate * p_days / 365, 2)` exactly as specified.
- Marked the function `IMMUTABLE`.

### Why I Did It
- This fulfills `P04-M05-T03` completely.
- Using `IMMUTABLE` ensures PostgreSQL can optimize calls since the exact same inputs will always produce the identical output. 
- Keeping the types exclusively `NUMERIC` entirely avoids the rounding errors associated with floating point numbers (as dictated by SRS §4.10).

## Task 2: Open Fixed Deposit Procedure (P04-M05-T02)

### What I Did
- Created `database/routines/sp_open_fixed_deposit.sql`.
- Built the atomic stored procedure that verifies an account is active and has sufficient funds.
- Recreated the missing `I-6` eligibility logic from M3 directly inside the procedure so that we are unblocked.
- Calculated the maturity date from the plan's tenure and `next_interest_date` exactly 30 days ahead.
- Deduced the principal from the savings account balance securely.
- Inserted the new fixed deposit record capturing the exact interest rate snapshot.

### Why I Did It
- This partially fulfills `P04-M05-T02`. While we officially depend on M3 for the account eligibility check interface (`I-6`), it's a simple database logic check that we implemented ourselves to ensure we aren't waiting on them.
- Using `FOR UPDATE` on the account row ensures we lock it against race conditions during the balance check (avoiding overdrafts).
- Performing the balance deduction and FD creation inside the exact same atomic transaction guarantees we never orphan a fixed deposit or silently lose user funds.
