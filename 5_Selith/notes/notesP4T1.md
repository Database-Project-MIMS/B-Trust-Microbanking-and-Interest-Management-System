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
