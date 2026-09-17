# 🟡 Phase 3 — Member 5 Task: Seed Set 4 (Transactions)
**Task ID:** `P03-M05-T01`  
**Branch:** `feat/p03-m05-seed-transactions`  
**Migration Block:** `0380–0399`  
**Depends on:** P03-M04-T02 (`sp_post_deposit`)  
**Story Points:** ~6 · **Layer:** Database

---

## Overview

Phase 3 adds financial transactions. Your job: create **100+ mixed transactions** spread across multiple dates, branches, agents, and plan types. This data is critical — every report in Phase 5 depends on it having realistic variety.

---

## What to Do

Create seed data for 100+ transactions that exercise the financial system. These transactions must be posted **through the stored procedures** (not raw `INSERT`) to ensure balances, `balance_after`, and audit trails are correct.

### Transaction Mix Requirements

| Transaction Type | Count | Notes |
|---|---|---|
| `DEPOSIT` | 50+ | Across all branches, multiple agents, various amounts |
| `WITHDRAWAL` | 30+ | Must respect plan minimums and sufficient balance |
| `INTEREST_CREDIT` | 10+ | Will be added in Phase 4 via interest runs |
| `REVERSAL` | 5+ | Reversed deposits and withdrawals |

### Data Variety

- **Dates:** Spread across at least 30 days (to support date-range filtering in reports)
- **Branches:** Transactions in every branch (for branch-scope testing)
- **Agents:** Multiple agents posting transactions (for RPT-01)
- **Plans:** Transactions on accounts of every plan type (for RPT-02)
- **Amounts:** Varied amounts from small (LKR 500) to large (LKR 50,000)

---

## How to Implement

### Step 1 — Design the Transaction Sequence

Plan the transactions chronologically. Each must maintain valid balances:

```
Day 1 (2025-07-01):
  - Deposit  LKR 50,000 → Account A (Adult)    by Agent 1 at Colombo
  - Deposit  LKR 25,000 → Account B (Senior)   by Agent 2 at Kandy
  - Deposit  LKR 10,000 → Account C (Children)  by Agent 3 at Galle

Day 2 (2025-07-02):
  - Deposit  LKR 30,000 → Account D (Joint)    by Agent 1 at Colombo
  - Withdrawal LKR 5,000 → Account A            by Agent 1 at Colombo
  ...
```

**Critical rules:**
- After every withdrawal, `current_balance ≥ plan.min_balance`
- After every withdrawal, `current_balance ≥ 0`
- Amounts are `NUMERIC(15,2)` — use exact LKR values

### Step 2 — Create the Seed File

Create `database/seed/13_transactions.sql`:

```sql
-- Seed Set 4: Financial transactions
-- Posted through sp_post_deposit / sp_post_withdrawal to maintain balance integrity
-- 100+ transactions across 30+ days, all branches, multiple agents

-- Use fixed UUIDs for transaction references and idempotency keys
-- Reference number pattern: TXN-SEED-NNNN

-- Day 1: 2025-07-01
SELECT sp_post_deposit(
    p_account_id := '00000000-0000-0000-0501-000000000003',  -- Adult account
    p_amount     := 50000.00,
    p_user_id    := '00000000-0000-0000-0301-000000000001',  -- Agent 1
    p_channel_id := '...',  -- BRANCH_COUNTER
    p_narration  := 'Initial deposit — seed data',
    p_idempotency_key := 'seed-txn-0001'
);

-- ... 99+ more
```

**Important:** If the stored procedures aren't available yet (M4 still building), prepare the seed as raw SQL with comments indicating it needs to be converted to procedure calls. Work with M4 via a handoff.

### Step 3 — Validate Balances

After seeding, verify:
```sql
-- Every account has non-negative balance
SELECT account_id, current_balance 
FROM account 
WHERE current_balance < 0;  -- Must return 0 rows

-- Balance matches ledger sum
SELECT a.account_id, a.current_balance, 
       SUM(CASE WHEN t.transaction_type IN ('DEPOSIT','INTEREST_CREDIT') 
           THEN t.amount ELSE -t.amount END) AS ledger_balance
FROM account a
LEFT JOIN transaction t ON t.account_id = a.account_id
GROUP BY a.account_id, a.current_balance
HAVING a.current_balance != SUM(...);  -- Must return 0 rows
```

### Step 4 — Update Docs
- Update `docs/06_seed-data-spec.md` with transaction seed details
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] 100+ transactions exist across 30+ days
- [ ] Transactions spread across all branches and multiple agents
- [ ] All five savings plan types have associated transactions
- [ ] All balances remain non-negative after seeding
- [ ] `current_balance` matches ledger SUM for every account
- [ ] `balance_after` column is correct on every transaction row
- [ ] Seeding is deterministic — identical results every run
- [ ] Sufficient balances remain for Phase 4 FD opening
