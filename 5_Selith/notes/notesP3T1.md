# Notes for Phase 3 - Task 1 (P03-M05-T01)

## Phase A Execution: Transaction Seed Drafting
### What I Did
1. Created the `feat/p03-m05-seed-transactions` branch.
2. Wrote a Python generator script to mathematically model 100+ transactions over a 30-day period.
3. The script tracked balances internally to ensure no withdrawal would ever drop an account below its plan minimum or zero. 
4. Outputted the exact `SELECT sp_post_deposit(...)`, `SELECT sp_post_withdrawal(...)`, and `SELECT sp_reverse_transaction(...)` procedure calls into `database/seed/13_transactions.sql`. 
5. Wrapped `13_transactions.sql` entirely in block comments (`/* ... */`).
6. Wrote a `.agent/handoff` for M4 indicating the draft is ready.

### Why I Did It
This task requires stored procedures from M4 (`P03-M04-T02`, `T03`, `T04`) to correctly update ledgers and balances, but M4 is currently building them. 
Instead of being fully blocked, I drafted the required 100+ chronological transactions now. We wrap them in comments so they don't break the `db:rebuild` process on the main `develop` branch. 
Once M4 completes the procedures, Phase B will consist simply of pulling their code, uncommenting our SQL, testing it, and completing the task!

## Phase B Execution: Integration and Idempotency
### What I Did
1. Wrote a Python script (`scratch/one_script.py`) to transform the raw Python-generated `13_transactions.sql` into a robust `DO $$` PL/pgSQL block.
2. The transformation dynamically queries the exact `agent_id` assigned to the account's customer, satisfying the strict RLS checks in `sp_post_withdrawal`.
3. The script passes `ARRAY_AGG(ah.customer_id)` as the signers for the transaction, perfectly satisfying the `MANDATE_NOT_SATISFIED` checks inside `fn_check_withdrawal_mandate` for both single and joint accounts.
4. The script wraps execution in temporarily altered `system_parameter` values for `BUSINESS_HOUR_START`, `BUSINESS_HOUR_END`, `WITHDRAWAL_DAILY_LIMIT`, and `WITHDRAWAL_SINGLE_LIMIT`. This bypasses strict real-world constraints that would otherwise fail since our CI `db:rebuild` executes all 100+ transactions instantly at the exact same `clock_timestamp()`.
5. Reversal transactions were wrapped in an `IF NOT EXISTS` block against `transaction_reversal` to ensure the file is natively idempotent on a second run.
6. Executed `npm run db:rebuild --reset && npm run db:seed && npm run db:seed-check` and successfully verified 100% idempotency with exactly zero balance mismatches.
7. Checked off Acceptance Criteria and marked task `DONE`.

### Why I Did It
The original generated SQL was hardcoded and blindly threw UUIDs into the procedures without accounting for the sophisticated RLS, mandate, and business-hours configurations built by M4 in Phase 3. 
By wrapping the transactions in a `DO` block, we avoid brittle python string-parsing and let Postgres accurately resolve relational facts (like which agent actually serves which branch and customer) dynamically. This guarantees the seeds always succeed regardless of how previous seeds might have changed!
