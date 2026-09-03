# 01 — Project Description

## What it is

B-Trust is a small private microfinance bank operating across several districts in Sri
Lanka, supporting financial inclusion through basic savings products and fixed deposits,
particularly for rural communities. MIMS digitises its core operations so customers can
deposit, withdraw and monitor balances through a system operated by regional service
agents.

We are building the **backend database** of that system, plus a lightweight UI that lets a
QA tester exercise and validate every key operation.

## Scope

**In scope**

- Branches, agents, application users and roles
- Customer registration, documents, and effective-dated agent assignment
- Savings accounts under five plans, individually or jointly held
- Deposits, withdrawals, interest credits and controlled reversals
- Fixed deposits under three products, with a 30-day central interest cycle
- Five management reports with CSV export
- Audit trail, reconciliation, RBAC and Row Level Security
- Deterministic synthetic sample data and a clean-database rebuild

**Out of scope for Release 1.0** (SRS B.3)

Loans and credit scoring · ATM, card, QR or interbank settlement · real KYC, biometric or
notification providers · multi-currency, tax withholding, cheque clearing, general ledger
accounting · FD early-withdrawal penalties and automatic renewal · account-to-account
transfers (see `17_erd-gap-analysis.md` **G-05**).

## Actors

| Actor | What they do |
|---|---|
| **Banking Agent** | Registers customers, opens accounts, posts deposits and withdrawals for assigned customers |
| **Branch Manager** | Approves exceptions, manages branch agents, supervises joint mandates, **authorises reversals**, views branch reports |
| **Central Operations Officer** | Manages FD products, runs interest cycles, produces bank-wide reports |
| **Auditor / Management** | Read-only access to reports, ledger history and audit events |
| **System Administrator** | Users, roles, parameters, deployment |
| **Customer** | Views own accounts, balances and transactions (self-service scope subject to **OQ-05**) |
| **QA Tester** | Validates workflows, SQL rules, error handling and reports with synthetic data |
| **Scheduled Worker** | Executes the authenticated interest cycle |

## Products

| Savings plan | Eligibility | Rate | Minimum balance |
|---|---|---|---|
| Children | under 13 | 12% | none |
| Teen | 13–17 | 11% | LKR 500 |
| Adult | 18–59 | 10% | LKR 1,000 |
| Senior | 60+ | 13% | LKR 1,000 |
| Joint | 2–4 adult holders | 7% | LKR 5,000 |

| Fixed deposit | Term | Rate |
|---|---|---|
| FD-6M | 6 months | 13% |
| FD-1Y | 1 year | 14% |
| FD-3Y | 3 years | 15% |

FD interest is calculated on a 30-day cycle as
`principal × annual rate × 30 / 365` and credited to the linked savings account **as a
separate transaction**.

## Core workflows

1. **Customer onboarding** — validate identity → insert customer, documents and agent
   assignment, with an audit event, in one transaction.
2. **Account opening** — check plan eligibility from date of birth and holder count →
   create account, holders, mandate and optional initial deposit atomically.
3. **Deposit** — authenticate → lock the account → insert ledger → update balance → audit,
   all in one transaction, idempotent under retry.
4. **Withdrawal** — verify holder authority, business hours, limits and post-withdrawal
   minimum balance **after** locking the row → debit. Overdrafts are never possible.
5. **Reversal** — a manager creates a linked compensating entry. The original is never
   modified or deleted.
6. **Fixed deposit** — verify an active account with no active FD → debit the principal →
   create the FD with its maturity date and rate snapshot.
7. **Interest cycle** — the central system creates a run for the cycle date, selects due
   FDs, and credits each in its own transaction. Re-running produces nothing new.
8. **Reporting** — five scoped reports with subtotals, totals and matching CSV export.

## Required reports

| # | Report |
|---|---|
| RPT-01 | Agent-wise total number and value of transactions |
| RPT-02 | Account-wise transaction summary and current balance |
| RPT-03 | Active FDs and their next interest payout dates |
| RPT-04 | Monthly interest distribution summary by account type |
| RPT-05 | Customer activity report — total deposits, withdrawals and net balance |

## What makes this project succeed

It is graded as a **Database Systems** project. Success is a schema that is normalised and
documented, rules enforced by constraints and routines rather than by JavaScript,
transactions that are genuinely atomic under concurrency, indexes justified by real query
plans, and five reports whose totals reconcile with the ledger. The UI needs to be clean
and usable — it does not need to be elaborate.
