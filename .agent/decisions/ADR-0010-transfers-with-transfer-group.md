# ADR-0010: Transfers are in scope, linked by `transfer_group_id`

**Date:** 2026-10-02 · **Status:** Accepted · **Resolves:** OQ-08 (ERD gap G-05)

## Decision

Account-to-account transfers are part of the system. A transfer writes **two** ledger rows
in one transaction: a debit on the source account and a credit on the destination account.

- Every `transaction` row keeps its **own unique** `reference_number` (BR-10 stands).
- A new nullable `transaction.transfer_group_id uuid` links the two legs of one transfer.
  It is `NULL` for deposits, withdrawals and interest credits.
- Transfers appear as a distinct transaction type, in addition to `DEPOSIT`, `WITHDRAWAL`,
  `INTEREST_CREDIT` and `REVERSAL`. The exact type naming (single `TRANSFER` type with
  direction, or separate out/in types) is fixed in the Phase 3 schema task.
- ERD Assumption 4 (two rows sharing one `reference_number`) is **dropped**.

## Why

The product owner confirmed customers make transfers. Keeping references unique satisfies
BR-10 and the unique-reference index in SRS §6.7, while `transfer_group_id` preserves the
intent of ERD Assumption 4 by tying the pair together.

## What it rules out

- Two ledger rows sharing a `reference_number`
- A transfer where one leg posts and the other does not
- A transfer posted outside a single locked transaction

## Consequences

- The transfer routine locks **both** accounts in a fixed order (for example by ascending
  account id) to avoid deadlocks, re-validates both inside the transaction, and writes both
  ledger rows and both `balance_after` values atomically.
- A transfer needs the same overdraft, minimum-balance, business-hours and limit checks as
  a withdrawal on the source side, and the status checks on the destination side.
- Money-moving transfer endpoints require an `Idempotency-Key` (AGENTS.md §9).
- Reversing a transfer must reverse both legs together.
- `docs/04`, `05`, `07` and the Phase 3 tasks (`P03-M04`) must be updated when this is built.
