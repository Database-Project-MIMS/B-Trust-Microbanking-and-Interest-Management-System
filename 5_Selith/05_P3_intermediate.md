# Phase 3 Intermediate Plan: Seed Set 4 (Transactions)

**Context:** This file acts as an addendum to `05_P3_seed-set-4-transactions.md` for task `P03-M05-T01`. Because Member 4 (M4) is currently building the stored procedures (`sp_post_deposit`, `sp_post_withdrawal`, `sp_reverse_transaction`) which this task depends on, we must split our workflow into two distinct phases to remain productive without violating phase gates or breaking the build.

## Phase A: What we can do RIGHT NOW (Drafting)
1. **Branch Out:** Create the new branch `feat/p03-m05-seed-transactions`.
2. **Write the Generator Script:** Write a Python script in the `scratch` folder that algorithmically creates the 100+ transactions. 
3. **Simulate the Balances:** Because we know exactly what the starting balances are from Phase 2 (since we just seeded them), our script will track the balances internally. This guarantees we generate 30+ withdrawals that *never* drop an account below its minimum plan limit, and 50+ deposits, spanning across 30 days (satisfying the variety requirements).
4. **Draft the SQL File:** Output the perfectly formatted `SELECT sp_post_deposit(...)`, `SELECT sp_post_withdrawal(...)`, and `SELECT sp_reverse_transaction(...)` commands into `database/seed/13_transactions.sql`. **CRITICAL:** We will wrap the whole file in a massive SQL block comment `/* ... */` so it doesn't break the `npm run db:rebuild` script since M4's procedures are missing.
5. **Commit & Handoff:** Write notes, commit the draft to git, and write a quick `.agent/handoff` note so M4 knows our transactions are drafted and waiting for them.

## Phase B: What we must do AFTER M4 finishes
1. **Pull M4's Code:** Once M4 merges their stored procedures into the `develop` branch, we checkout our branch and pull `develop` into it.
2. **Uncomment:** We remove the `/* ... */` comments from `13_transactions.sql`.
3. **Verify:** We run `npm run db:rebuild && npm run db:seed && npm run db:seed-check`. This is where the magic happens — the database will actually execute our 100+ transactions through M4's brand-new procedures and verify that all balances and audit logs match perfectly, satisfying Step 3 in the main task file.
4. **Complete the Task:** Once tests pass, we update `docs/06_seed-data-spec.md` and `docs/09_task-tracker.md` to `DONE`, commit, and open our Pull Request!
