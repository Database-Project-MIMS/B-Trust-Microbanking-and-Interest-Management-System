# Phase 03 — Financial Transactions

**Status:** TODO · **Tasks:** 14 · **Effort:** 44 points · **Est.** ~1 week

The most important phase for the grade. Everything here is about **ACID under
concurrency**.

## Entry criteria

- [ ] Phase 2 exit criteria met
- [ ] **OQ-08 resolved** (G-05 — reference-number uniqueness and whether transfers exist)
- [ ] G-04 (idempotency key), G-07 (agent/branch attribution), G-14 (`balance_after`) approved

## Tasks by member

| Member | Focus |
|---|---|
| **M1** | Business hours and limits from `system_parameter`; manager-only reversal authorization; audit on every financial operation |
| **M2** | `agent_id` / `branch_id` attribution + reporting indexes; agent daily activity page |
| **M3** | `fn_check_plan_minimum` (**I-4**); mandate validation callable from the withdrawal path; balance panel |
| **M4** | Reference and idempotency indexes; `sp_post_deposit`, `sp_post_withdrawal`, `sp_reverse_transaction`, `transaction_reversal`; transaction APIs; deposit, withdrawal, receipt, statement and reversal pages |
| **M5** | Seed set 4 — 140 mixed transactions |

## The four things that must be right

1. **Lock before deciding.** `SELECT … FOR UPDATE` on the account row, then re-read status
   and balance **inside** the transaction. Validation done before the lock is stale.
2. **Atomicity.** Ledger row, balance update and audit event commit or roll back together.
   No partial state is ever observable (FR-DEP-05).
3. **Idempotency as a constraint.** A partial unique index on `idempotency_key` — not an
   in-memory cache — so it survives a restart.
4. **Immutability.** A trigger rejects `UPDATE`/`DELETE` on `transaction`, and `mims_app`
   has no `DELETE` grant. Corrections are compensating entries.

## Exit criteria

- [ ] Deposit posts atomically and returns a unique reference and new balance
- [ ] Withdrawal enforces status, holder authority, mandate, hours, limits and plan minimum — **after** the lock
- [ ] **Overdraft is impossible**, including under concurrency
- [ ] Two simultaneous withdrawals against an insufficient balance: exactly one succeeds (**AC-06**)
- [ ] A repeated idempotency key returns the original result; balance moves once
- [ ] A rejected withdrawal writes an audit event and **no ledger row**
- [ ] Reversal creates a linked compensating entry; the original is untouched; a second reversal is rejected
- [ ] Only a branch manager can reverse
- [ ] `UPDATE`/`DELETE` on a posted transaction raises
- [ ] Statement shows a correct running balance including reversals
- [ ] Seed contains 140+ transactions in a realistic mix across branches, agents and plans

## Risks

| Risk | Mitigation |
|---|---|
| Validation before the lock — the classic race | Code review specifically checks lock-then-re-read; the concurrency test would fail otherwise |
| Deadlock on multi-account operations | Always acquire account locks in ascending `account_id` order |
| `balance_after` drifting from the ledger | Written inside the same transaction; Phase 5 reconciliation view asserts equality |
| Money handled as a JavaScript number | Money crosses the API as a string; all arithmetic in SQL; lint rule and review |
