# P3-T04: Transaction Reversal

## What I did
1. Created the migration `0363_p03_m04_transaction_reversal.sql` for the `transaction_reversal` table and the `sp_reverse_transaction` stored procedure.
2. The procedure validates if the transaction exists, was already reversed, or is of a type that cannot be reversed.
3. The procedure calculates the required compensating balance impact, inserts a new `REVERSAL` transaction, updates the account balance, and inserts the `transaction_reversal` linking row.
4. Created `tests/db/sp-reverse-transaction.test.mjs` to fully cover the procedure (happy path, double-reversal prevention, immutable original rows, and proper constraints).
5. Fixed a bug in the previously implemented `sp_post_withdrawal` migration where it referenced an undefined column (`after_value` instead of `new_values`) inside the final `audit_log` insertion. 

## Why I did it
- According to `AGENTS.md` and `docs/07_business-rules.md`, completed financial transactions must NEVER be modified or deleted. We ensure this by creating a new `REVERSAL` transaction and linking it via `transaction_reversal`.
- The `UNIQUE(original_transaction_id)` constraint ensures that a transaction can only be reversed once without having to add a mutable `status` column to the `transaction` table.
- Using `withTransaction` in tests ensures the RLS policy on the `account` table allows the tests to verify the balance properly, preventing false negative test failures.
