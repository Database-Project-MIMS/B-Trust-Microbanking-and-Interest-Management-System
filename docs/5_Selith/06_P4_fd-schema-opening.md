# 🟠 Phase 4 — Member 5 Tasks (Part 1): FD Schema, Opening & Interest Function
**Task IDs:** `P04-M05-T01`, `P04-M05-T02`, `P04-M05-T03`  
**Migration Block:** `0480–0499`  
**Depends on:** **OQ-01** resolved (G-01), P04-M05-T01 → T02 → T03 internal chain  
**Story Points:** ~10 total · **Layer:** Database  
**⚡ This is the core of your domain — the hardest and most graded work**

---

## Overview

Phase 4 is your **heaviest phase** (18 points total, split across this doc and the next). In this part, you build the `fixed_deposit` table, the FD opening procedure, and the interest calculation function. These are the foundational DB objects that everything else rests on.

---

## Task 1: Fixed Deposit Schema (`P04-M05-T01`)
**Branch:** `feat/p04-m05-fd-schema`  
**Depends on:** **OQ-01** resolved

### What to Do

Create the `fixed_deposit` table with the partial unique active index (G-01), maturity date (G-23), and rate snapshot (G-11).

### Table: `fixed_deposit`

| Column | Type | Constraints |
|---|---|---|
| `fd_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `account_id` | `uuid` | **FK → account**, NOT NULL |
| `fd_plan_id` | `uuid` | **FK → fd_plan**, NOT NULL |
| `principal_amount` | `positive_money` | NOT NULL — the debited amount |
| `interest_rate_at_opening` | `interest_rate` | NOT NULL — **snapshot**, never read from `fd_plan` (G-11, BR-19, D-3) |
| `start_date` | `date` | NOT NULL |
| `maturity_date` | `date` | NOT NULL — computed from `start_date + tenure_months` (G-23, BR-F1) |
| `next_interest_date` | `date` | NOT NULL — advanced by 30 days on each payout |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','MATURED','CLOSED'))` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

### Indexes

```sql
-- G-01: One ACTIVE FD per account (partial unique index)
CREATE UNIQUE INDEX uq_one_active_fd_per_account
    ON fixed_deposit(account_id) WHERE status = 'ACTIVE';

-- FDs due for interest processing
CREATE INDEX ix_fd_due_interest
    ON fixed_deposit(status, next_interest_date)
    WHERE status = 'ACTIVE';
```

### Migration (`0480_p04_m05_fixed_deposit.sql`)

```sql
BEGIN;

CREATE TABLE fixed_deposit (
    fd_id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                uuid NOT NULL REFERENCES account(account_id) ON DELETE RESTRICT,
    fd_plan_id                uuid NOT NULL REFERENCES fd_plan(fd_plan_id) ON DELETE RESTRICT,
    principal_amount          numeric(15,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate_at_opening  numeric(6,4) NOT NULL CHECK (interest_rate_at_opening > 0 AND interest_rate_at_opening <= 1),
    start_date                date NOT NULL,
    maturity_date             date NOT NULL,
    next_interest_date        date NOT NULL,
    status                    varchar(20) NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE', 'MATURED', 'CLOSED')),
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz,
    CONSTRAINT chk_fd_maturity_after_start CHECK (maturity_date > start_date),
    CONSTRAINT chk_fd_next_interest_after_start CHECK (next_interest_date >= start_date)
);

-- One active FD per account (G-01, BR-12)
CREATE UNIQUE INDEX uq_one_active_fd_per_account
    ON fixed_deposit(account_id) WHERE status = 'ACTIVE';

-- FDs due for interest payout
CREATE INDEX ix_fd_due_interest
    ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';

INSERT INTO schema_migration(version, name)
VALUES (480, '0480_p04_m05_fixed_deposit');

COMMIT;
```

### Tests
| Test | What it verifies |
|---|---|
| Second ACTIVE FD on same account → `23505` | Partial unique index (G-01, BR-12) |
| `principal_amount = 0` → rejected | CHECK constraint |
| `maturity_date ≤ start_date` → rejected | Date validation |
| `interest_rate_at_opening = 0` → rejected | Rate must be positive |
| Deleting account with an FD → rejected | FK RESTRICT |
| `status = 'INVALID'` → rejected | CHECK constraint |

---

## Task 2: Open Fixed Deposit Procedure (`P04-M05-T02`)
**Branch:** `feat/p04-m05-open-fd`  
**Depends on:** P04-M05-T01, **I-6** (M3's account eligibility under lock)

### What to Do

Create `sp_open_fixed_deposit` — the atomic procedure that verifies eligibility, debits principal from the savings account, creates the FD row, and records the audit trail. All in one transaction.

### Procedure: `sp_open_fixed_deposit`

```sql
CREATE OR REPLACE FUNCTION sp_open_fixed_deposit(
    p_account_id   uuid,
    p_fd_plan_id   uuid,
    p_amount       numeric(15,2),
    p_user_id      uuid,
    p_channel_id   uuid
) RETURNS uuid AS $$
DECLARE
    v_account     account%ROWTYPE;
    v_plan        fd_plan%ROWTYPE;
    v_fd_id       uuid;
    v_start_date  date := CURRENT_DATE;
    v_maturity    date;
    v_next_int    date;
BEGIN
    -- 1. Lock and read the account (I-6: M3 provides this check)
    SELECT * INTO v_account
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;

    -- 2. Check account is ACTIVE (BR-11)
    IF v_account.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Account is not active: %', v_account.status;
    END IF;

    -- 3. Check sufficient balance (after withdrawal, balance ≥ 0)
    IF v_account.current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %',
            v_account.current_balance, p_amount;
    END IF;

    -- 4. Check no existing active FD (the partial unique index is the backstop)
    -- This check is for a clean error message; the index enforces it

    -- 5. Read the FD plan
    SELECT * INTO v_plan FROM fd_plan WHERE fd_plan_id = p_fd_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FD plan not found: %', p_fd_plan_id;
    END IF;

    -- 6. Calculate maturity and next interest dates
    v_maturity := v_start_date + (v_plan.tenure_months || ' months')::interval;
    v_next_int := v_start_date + interval '30 days';

    -- 7. Debit principal from the savings account
    --    (Post through M4's ledger routine via I-5 or direct update)
    UPDATE account
    SET current_balance = current_balance - p_amount,
        updated_at = now()
    WHERE account_id = p_account_id;

    -- 8. Create the FD with rate snapshot (BR-19, G-11)
    INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount,
        interest_rate_at_opening, start_date, maturity_date,
        next_interest_date, status
    ) VALUES (
        p_account_id, p_fd_plan_id, p_amount,
        v_plan.interest_rate,  -- snapshot at opening (D-3)
        v_start_date, v_maturity, v_next_int, 'ACTIVE'
    ) RETURNING fd_id INTO v_fd_id;

    RETURN v_fd_id;
END;
$$ LANGUAGE plpgsql;
```

**Critical design points:**
- `interest_rate_at_opening` is copied from `fd_plan.interest_rate` at opening — **never** re-read from the plan
- The account is locked with `FOR UPDATE` **before** checking balance
- The principal debit happens **inside** the same transaction as the FD creation
- If anything fails, the entire operation rolls back — no orphan FD, no silent debit

### Tests
| Test | What it verifies |
|---|---|
| Open FD on ACTIVE account with sufficient balance → FD created, balance debited | Happy path |
| Open FD on INACTIVE account → exception | BR-11 |
| Open FD with insufficient balance → exception, no debit | Atomicity |
| Open second ACTIVE FD on same account → `23505` | BR-12 |
| `maturity_date` = `start_date + tenure_months` | BR-F1 |
| `interest_rate_at_opening` = plan's current rate | BR-19, G-11 |
| `next_interest_date` = `start_date + 30 days` | Interest cycle setup |

---

## Task 3: Interest Calculation Function (`P04-M05-T03`)
**Branch:** `feat/p04-m05-interest-function`  
**Depends on:** P04-M05-T01

### What to Do

Create `fn_calculate_fd_interest` — the pure function that computes interest for a single 30-day cycle.

### Function

```sql
CREATE OR REPLACE FUNCTION fn_calculate_fd_interest(
    p_principal  numeric(15,2),
    p_rate       numeric(6,4),
    p_days       int DEFAULT 30
) RETURNS numeric(15,2) AS $$
BEGIN
    -- interest = round(principal × rate × days / 365, 2)
    -- Exact NUMERIC throughout — never floats (SRS §4.10)
    RETURN round(p_principal * p_rate * p_days / 365, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Design rules:**
- Uses `NUMERIC` exclusively — never `float` or `double precision`
- Rounding happens **once**, at the end (`round(..., 2)`)
- The function is `IMMUTABLE` — same inputs always produce the same output
- Rate comes from the FD's `interest_rate_at_opening`, not from `fd_plan`

### Worked Examples (These Are Your Tests)

| Principal | Rate | Days | Expected Interest |
|---|---|---|---|
| 100,000.00 | 0.1400 | 30 | **1,150.68** |
| 100,000.00 | 0.1300 | 30 | **1,068.49** |
| 100,000.00 | 0.1500 | 30 | **1,232.88** |
| 50,000.00 | 0.1400 | 30 | **575.34** |
| 250,000.00 | 0.1300 | 30 | **2,671.23** |

### Tests
| Test | What it verifies |
|---|---|
| 100,000 × 0.1400 × 30/365 = 1,150.68 | Exact NUMERIC arithmetic |
| 100,000 × 0.1300 × 30/365 = 1,068.49 | Second product rate |
| 100,000 × 0.1500 × 30/365 = 1,232.88 | Third product rate |
| Result has exactly 2 decimal places | Correct rounding |
| Function is deterministic (same inputs → same output) | IMMUTABLE property |

---

## Acceptance Criteria (All 3 Tasks)
- [ ] `fixed_deposit` table created with all required columns (G-01, G-11, G-23)
- [ ] Partial unique index blocks second active FD per account
- [ ] `sp_open_fixed_deposit` atomically debits principal and creates FD
- [ ] `interest_rate_at_opening` is a snapshot — never re-read from `fd_plan`
- [ ] `maturity_date` is computed from `start_date + tenure_months`
- [ ] `fn_calculate_fd_interest` returns exact 2-decimal NUMERIC values
- [ ] All worked examples match expected results exactly
- [ ] Insufficient balance → no FD row and no debit (atomic rollback)
