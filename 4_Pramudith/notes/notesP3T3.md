# Notes for Phase 3 Task 3 (`sp_post_withdrawal`)

## What I Did
I built the main withdrawal routine for Phase 3! This was a massive task because it handles all the safe-guards when a customer pulls money out of their account.
I created the migration file `0362_p03_m04_sp_post_withdrawal.sql` which adds two new routines:
1. `sp_write_rejection_audit`: A helper to quickly record an audit log whenever a withdrawal fails.
2. `sp_post_withdrawal`: The main routine itself.

I also added 10 isolated test cases inside `tests/db/sp-post-withdrawal.test.mjs` to ensure the withdrawal limits, constraints, and rejections work properly under concurrency!

## Why I Did It
We can't just let anyone take money out. I had to lock the account (`FOR UPDATE`) to make sure nobody else could touch the balance at the same time (no race conditions!). Then, I checked a bunch of rules exactly in order inside the lock:
- Is the account active?
- Is it within business hours?
- Is the joint mandate satisfied? (Using M3's `I-4` function).
- Are the daily and single withdrawal limits respected?
- Is there enough balance?
- Does the withdrawal respect the minimum balance of the plan?

If any of these fail, we reject the withdrawal, create NO ledger row, but write an audit event so the bank knows someone tried and failed!
If all tests pass, the ledger is updated, the current balance drops, and an audit is successfully written!

This satisfies all Phase 3 requirements for this task, giving me the green light to finally move on.
