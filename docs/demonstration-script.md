# MIMS Demonstration Script

## 1. System Setup (2 min)
- Show the database with seeded data
- Sign in as ADMIN
- Navigate the app shell (role-aware nav)

## 2. Customer & Account Management (3 min)
- Search for a customer
- View customer profile
- Open a new savings account (show eligibility check)
- Open a joint account with 2 holders

## 3. Financial Transactions (5 min)
- Post a deposit (show balance update)
- Post a withdrawal (show minimum balance check)
- Attempt an overdraft (show rejection)
- Reverse a transaction (manager only)
- View the transaction statement with balance_after

## 4. Fixed Deposits (5 min)
- Open an FD against an active account
- Show principal debited from savings balance
- Show rate snapshot (interest_rate_at_opening)
- Attempt second FD on same account (show rejection)

## 5. Interest Cycle (5 min)
- Trigger an interest run
- Show FDs processed, total interest, exceptions
- Show INTEREST_CREDIT in the statement
- Show next_interest_date advanced
- Re-run same cycle (show idempotency)

## 6. Reports (5 min)
- RPT-01: Agent-wise transactions (with branch scope)
- RPT-02: Account-wise summary
- RPT-03: Active FDs and next payout
- RPT-04: Monthly interest distribution (show ROLLUP subtotals)
- RPT-05: Customer activity
- Export CSV (show identical totals)

## 7. Security & Audit (3 min)
- Show audit trail
- Attempt cross-branch access (denied)
- Show RLS enforcement
