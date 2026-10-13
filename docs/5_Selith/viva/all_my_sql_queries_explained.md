# 📜 All My SQL Code Explained: Line-by-Line Viva Cheatsheet

**Member:** Rubasingha S.T. (Index: 240575P) · **Member 5**  
**Role:** Fixed Deposits, Central Interest Engine, Reports 3 & 4, Performance Indexing, Seed Framework  
**Project:** B-Trust Microbanking & Interest Management System (MIMS) — CS3043 Database Systems  

---

## 📌 Table of Contents
1. [SQL Categories You Wrote](#1-sql-categories-you-wrote)
2. [Migration 0180: Fixed Deposit Products Catalog (`fd_plan`)](#2-migration-0180-fd_plan-table)
3. [Migration 0480: Fixed Deposit Contracts (`fixed_deposit`) & Partial Indexes](#3-migration-0480-fixed_deposit-table--partial-index)
4. [Migration 0482: Interest Cycle Control & Granular Payout Tables](#4-migration-0482-interest_run--interest_payout)
5. [Migration 0483: The Concurrency Bug Fix (`sp_post_interest_credit`)](#5-migration-0483-concurrency-bug-fix-procedure)
6. [Migration 0580: Performance Indexes for Reporting (`EXPLAIN ANALYZE`)](#6-migration-0580-performance-indexes)
7. [Routine 1: Pure Interest Calculation (`fn_calculate_fd_interest`)](#7-routine-1-pure-interest-calculation-function)
8. [Routine 2: Atomic FD Opening (`sp_open_fixed_deposit`)](#8-routine-2-atomic-fd-opening-procedure)
9. [Routine 3: The 30-Day Central Interest Cycle Engine (`sp_run_interest_cycle`)](#9-routine-3-the-central-interest-cycle-engine)
10. [View 1: Active Fixed Deposits Report (`vw_rpt03_active_fds`)](#10-view-1-active-fixed-deposits-report-view)
11. [View 2: Monthly Interest Distribution with ROLLUP (`vw_rpt04_interest_distribution`)](#11-view-2-monthly-interest-distribution-with-rollup)
12. [Seed Architecture & PL/pgSQL Simulation Block (`13_transactions.sql`)](#12-seed-architecture--plpgsql-simulation-block)
13. [Glossary of Advanced PostgreSQL Keywords You Used](#13-glossary-of-advanced-postgresql-keywords-you-used)

---

## 1. SQL Categories You Wrote

Before reading the code, note the distinction between the types of SQL objects you authored:
1. **DDL (Data Definition Language):** Bare SQL creating physical structures — `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CHECK` constraints, and foreign keys.
2. **PL/pgSQL Stored Functions:** Procedural code defined with `CREATE FUNCTION ... RETURNS ... LANGUAGE plpgsql`. Used for mathematical calculations (`fn_calculate_fd_interest`) and business routines returning IDs (`sp_open_fixed_deposit`, `sp_run_interest_cycle`).
3. **PL/pgSQL Stored Procedures:** Procedural code defined with `CREATE PROCEDURE ... LANGUAGE plpgsql` taking `INOUT` parameters and invoked with `CALL`. Used for ledger integrations (`sp_post_interest_credit`).
4. **OLAP & Aggregation Views:** Named saved queries (`CREATE VIEW`) featuring joins, `string_agg()`, and `GROUP BY ROLLUP` multi-tier subtotals.
5. **Anonymous PL/pgSQL Blocks:** `DO $$ ... BEGIN ... END $$;` scripts used in seed files to dynamically resolve foreign keys and execute batch transactions under Row-Level Security.

---

## 2. Migration 0180: `fd_plan` Table

* **File:** `database/migrations/0180_p01_m05_fd_plan.sql`  
* **Type:** DDL Migration (Bare SQL)  
* **Purpose:** Creates the product catalogue for the 3 statutory fixed deposit plans (BR-13) with effective-dating support.

```sql
BEGIN;

CREATE TABLE fd_plan (
    fd_plan_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name      varchar(100) NOT NULL UNIQUE,
    tenure_months  int NOT NULL CHECK (tenure_months > 0),
    interest_rate  numeric(6,4) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 1),
    description    varchar(255),
    status         varchar(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'INACTIVE')),
    effective_from date DEFAULT CURRENT_DATE,
    effective_to   date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz,
    CONSTRAINT chk_fd_plan_effective_dates 
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Seed the three statutory products per BR-13
INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, description)
VALUES
    ('6 Month FD',  6,  0.1300, 'Fixed deposit — 6-month tenure at 13% per annum'),
    ('1 Year FD',   12, 0.1400, 'Fixed deposit — 12-month tenure at 14% per annum'),
    ('3 Year FD',   36, 0.1500, 'Fixed deposit — 36-month tenure at 15% per annum');

COMMIT;
```

### 🔍 What the SQL Commands Mean:
* `BEGIN; ... COMMIT;`: Wraps the table creation and initial seed insert into an **atomic migration transaction**. If anything errors out, nothing commits.
* `numeric(6,4)`: Stores numbers with up to 6 digits total, 4 after the decimal point. This forces rates to be stored as exact fractions: $13\% = 0.1300$, $14\% = 0.1400$.
* `CHECK (tenure_months > 0)`: A declarative constraint preventing impossible products with 0 or negative months.
* `CHECK (effective_to IS NULL OR effective_to >= effective_from)`: **Effective Dating Constraint (G-11)**. If an expiration date is provided, it must be after the start date. A `NULL` value indicates the product is currently active with no scheduled retirement.

---

## 3. Migration 0480: `fixed_deposit` Table & Partial Index

* **File:** `database/migrations/0480_p04_m05_fixed_deposit.sql`  
* **Type:** DDL Migration (Bare SQL)  
* **Purpose:** Stores active and historical fixed deposit customer contracts.

```sql
BEGIN;

CREATE TABLE fixed_deposit (
    fd_id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                uuid NOT NULL REFERENCES account(account_id) ON DELETE RESTRICT,
    fd_plan_id                uuid NOT NULL REFERENCES fd_plan(fd_plan_id) ON DELETE RESTRICT,
    principal_amount          positive_money NOT NULL,
    interest_rate_at_opening  interest_rate NOT NULL,
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

-- FDs due for interest payout index
CREATE INDEX ix_fd_due_interest
    ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';

COMMIT;
```

### 🔍 What the SQL Commands Mean:
* `ON DELETE RESTRICT`: Referential integrity rule. Prevents anyone from deleting a customer's savings account or an FD product if fixed deposits still reference it.
* `positive_money` / `interest_rate`: PostgreSQL **DOMAIN types** (custom constrained types) created in the shared foundation ensuring positive values.
* `interest_rate_at_opening`: **Rate Snapshot Column (BR-19, G-11)**. Freezes the agreed rate at contract inception so future changes to `fd_plan` do not alter historical contracts.
* ⭐ `CREATE UNIQUE INDEX ... WHERE status = 'ACTIVE'`: **A Partial Unique Index**.
  * A regular `UNIQUE(account_id)` would prevent an account from ever having more than one FD in its entire lifetime.
  * The `WHERE status = 'ACTIVE'` predicate tells PostgreSQL: *only enforce uniqueness on rows where status is ACTIVE*. This permits unlimited historical `MATURED` or `CLOSED` records while mathematically guaranteeing at the disk level that no account can hold two active FDs simultaneously.
* `CREATE INDEX ix_fd_due_interest`: A **Partial B-Tree Index** on `(status, next_interest_date)` filtered by `status = 'ACTIVE'`. Used by the 30-day interest engine to quickly locate due accounts without scanning matured FDs.

---

## 4. Migration 0482: `interest_run` & `interest_payout`

* **File:** `database/migrations/0482_p04_m05_interest_run.sql`  
* **Type:** DDL Migration (Bare SQL)  
* **Purpose:** Audit and idempotency control for monthly central interest payouts.

```sql
BEGIN;

CREATE TABLE interest_run (
    run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_date      date NOT NULL UNIQUE,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    status          varchar(20) NOT NULL DEFAULT 'RUNNING'
                    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    fd_count        int DEFAULT 0,
    total_interest  numeric(15,2) DEFAULT 0,
    exception_count int DEFAULT 0,
    initiated_by    uuid REFERENCES app_user(user_id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interest_payout (
    interest_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fd_id           uuid NOT NULL REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
    interest_run_id uuid NOT NULL REFERENCES interest_run(run_id) ON DELETE RESTRICT,
    transaction_id  uuid UNIQUE REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
    cycle_date      date NOT NULL,
    payout_date     date NOT NULL,
    interest_amount numeric(15,2) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: same FD cannot be paid twice for same cycle
CREATE UNIQUE INDEX uq_payout_fd_cycle
    ON interest_payout(fd_id, cycle_date);

COMMIT;
```

### 🔍 What the SQL Commands Mean:
* `cycle_date date NOT NULL UNIQUE`: **Cycle-Level Idempotency (BR-15)**. Ensures that a monthly interest run can only succeed once per calendar date. If run again, PostgreSQL triggers unique violation `23505`.
* `CREATE UNIQUE INDEX uq_payout_fd_cycle ON interest_payout(fd_id, cycle_date)`: **Payout-Level Idempotency (BR-F2)**. Even if an edge-case rerun were attempted, no individual FD can receive two payout records for the same cycle date.
* `transaction_id uuid UNIQUE REFERENCES transaction(...)`: Enforces a 1-to-1 relationship between an interest payout record and its financial ledger entry.

---

## 5. Migration 0483: Concurrency Bug Fix Procedure

* **File:** `database/migrations/0483_p04_m05_interest_credit_fix.sql`  
* **Type:** Stored Procedure (`CREATE PROCEDURE ... LANGUAGE plpgsql`)  
* **Purpose:** Patched Member 4's procedure to eliminate batch timestamp collisions and ensure unique transaction reference numbers.

```sql
BEGIN;

CREATE OR REPLACE PROCEDURE sp_post_interest_credit(
    IN    p_account_id           uuid,
    IN    p_amount               numeric,
    IN    p_fd_id                uuid,
    IN    p_cycle_date           date,
    INOUT p_transaction_id       uuid DEFAULT NULL,
    INOUT p_reference_number     varchar DEFAULT NULL,
    INOUT p_balance_after        numeric DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance        numeric(15,2);
    v_channel_id     uuid;
    v_system_user_id uuid;
BEGIN
    -- 0. Validate input values
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    -- Lookup SYSTEM channel and user
    SELECT channel_id INTO v_channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM' AND status = 'ACTIVE';
    SELECT user_id INTO v_system_user_id FROM app_user WHERE username = 'system';

    -- 1. Lock the account row (Pessimistic Concurrency Lock)
    SELECT current_balance INTO v_balance
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    -- 3. Calculate new balance
    p_balance_after := v_balance + p_amount;

    -- 4. BUG FIX: Generate unique reference number using clock_timestamp() + FD substring
    p_reference_number := 'INT-' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD-HH24MISSMS') 
                          || '-' || substring(p_fd_id::text from 1 for 8);

    -- 5. Insert ledger row
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, balance_after, narration
    ) VALUES (
        p_account_id, v_system_user_id, v_channel_id, p_reference_number,
        'INTEREST_CREDIT', p_amount, p_balance_after,
        'Interest Credit for cycle ' || p_cycle_date::text
    ) RETURNING transaction_id INTO p_transaction_id;

    -- 6. Update account balance
    UPDATE account
    SET current_balance = p_balance_after
    WHERE account_id = p_account_id;

    -- 7. Audit log (SYSTEM actor)
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (NULL, 'SYSTEM', 'transaction', p_transaction_id, 'INTEREST_CREDIT',
            jsonb_build_object('amount', p_amount, 'fd_id', p_fd_id, 'cycle_date', p_cycle_date));
END;
$$;

COMMIT;
```

### 🔍 What the SQL Commands Mean:
* `CREATE OR REPLACE PROCEDURE ... (IN ... INOUT ...)`: Declares a **Stored Procedure** capable of returning values through `INOUT` parameters (such as the generated `p_transaction_id` and `p_balance_after`).
* `SELECT ... FOR UPDATE`: **Pessimistic Row Lock (L11)**. Locks the specific savings account row in memory until the transaction ends, blocking concurrent balance updates.
* ⭐ `clock_timestamp()` vs `now()`: **The Core Bug Fix**.
  * In PostgreSQL, `now()` returns the start timestamp of the current transaction. Inside a loop paying 100 FDs, every single call to `now()` produces the exact same microsecond, which broke Member 4's code with duplicate reference numbers.
  * `clock_timestamp()` returns actual wall-clock time, advancing statement-by-statement.
* `|| substring(p_fd_id::text from 1 for 8)`: Appends the first 8 characters of the FD's UUID to guarantee that even if two payments occur within the same millisecond on different threads, reference collisions are mathematically impossible.

---

## 6. Migration 0580: Performance Indexes

* **File:** `database/migrations/0580_p05_m05_performance_indexes.sql`  
* **Type:** DDL Migration  
* **Purpose:** Index adjustments identified during the `EXPLAIN ANALYZE` database review.

```sql
BEGIN;

CREATE INDEX ix_payout_cycle ON interest_payout (cycle_date);

-- Rename existing indexes to match the exact project specification
ALTER INDEX ix_transaction_account_date RENAME TO ix_txn_account_date;
ALTER INDEX ix_transaction_agent_date RENAME TO ix_txn_agent_date;

COMMIT;
```

### 🔍 What the SQL Commands Mean:
* `CREATE INDEX ix_payout_cycle ON interest_payout (cycle_date)`: Builds a **B-Tree index** on the `cycle_date` column of `interest_payout`. This converted full Sequential Scans on the payouts table into instant Index Scans for Report 4 (`vw_rpt04_interest_distribution`).
* `ALTER INDEX ... RENAME TO`: Renames indexes without dropping or rebuilding them, preserving disk space and cache warm-up.

---

## 7. Routine 1: Pure Interest Calculation Function

* **File:** `database/routines/fn_calculate_fd_interest.sql`  
* **Type:** PL/pgSQL Function (`IMMUTABLE`)  
* **Purpose:** Computes 30-day interest with exact decimal precision.

```sql
CREATE OR REPLACE FUNCTION fn_calculate_fd_interest(
    p_principal  numeric(15,2),
    p_rate       numeric(6,4),
    p_days       int DEFAULT 30
) RETURNS numeric(15,2) AS $$
BEGIN
    -- Formula: interest = round(principal × rate × days / 365, 2)
    -- Exact NUMERIC throughout — never floats (SRS §4.10)
    RETURN round(p_principal * p_rate * p_days / 365, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### 🔍 What the SQL Commands Mean:
* `RETURNS numeric(15,2)`: Guarantees the function returns exact currency (up to 15 digits total, 2 decimal places).
* `round(..., 2)`: Rounds to exactly 2 decimal places at the final step.
* `IMMUTABLE`: **Query Optimizer Directive**. Declares that given the same inputs, the function *always* returns the exact same result without reading or altering database tables. PostgreSQL can evaluate this function during query planning and cache results.

---

## 8. Routine 2: Atomic FD Opening Procedure

* **File:** `database/routines/sp_open_fixed_deposit.sql`  
* **Type:** PL/pgSQL Function (`RETURNS uuid`)  
* **Purpose:** Atomically debits principal from savings, writes ledger records, and creates the fixed deposit contract.

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
    v_ref_no      varchar(50);
BEGIN
    -- 1. Lock and read the account (Pessimistic Concurrency Lock)
    SELECT * INTO v_account
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;

    -- 2. Check account is ACTIVE using Member 3's eligibility helper
    IF NOT fn_check_account_fd_eligible(p_account_id) THEN
        RAISE EXCEPTION 'Account is not active: %', v_account.status;
    END IF;

    -- 3. Check sufficient balance
    IF v_account.current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %',
            v_account.current_balance, p_amount;
    END IF;

    -- 4. Read the FD plan
    SELECT * INTO v_plan FROM fd_plan WHERE fd_plan_id = p_fd_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FD plan not found: %', p_fd_plan_id;
    END IF;

    -- 5. Calculate maturity and next interest dates
    v_maturity := v_start_date + (v_plan.tenure_months || ' months')::interval;
    v_next_int := v_start_date + interval '30 days';

    -- 6. Debit principal from the savings account and post ledger entry
    UPDATE account
    SET current_balance = current_balance - p_amount,
        updated_at = now()
    WHERE account_id = p_account_id
    RETURNING current_balance, branch_id INTO v_account.current_balance, v_account.branch_id;

    v_ref_no := fn_next_transaction_reference();

    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        balance_after, branch_id
    ) VALUES (
        p_account_id, p_user_id, p_channel_id, v_ref_no,
        'WITHDRAWAL', p_amount, now(), 'Fixed Deposit Opening Principal Debit',
        v_account.current_balance, v_account.branch_id
    );

    -- 7. Create the FD with rate snapshot (BR-19, G-11)
    INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount,
        interest_rate_at_opening, start_date, maturity_date,
        next_interest_date, status
    ) VALUES (
        p_account_id, p_fd_plan_id, p_amount,
        v_plan.interest_rate,  -- Rate snapshot at opening
        v_start_date, v_maturity, v_next_int, 'ACTIVE'
    ) RETURNING fd_id INTO v_fd_id;

    -- 8. Audit log for FD creation
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (p_user_id, 'USER', 'fixed_deposit', v_fd_id, 'FD_OPENED',
            jsonb_build_object('account_id', p_account_id, 'principal_amount', p_amount));

    RETURN v_fd_id;
END;
$$ LANGUAGE plpgsql;
```

### 🔍 What the SQL Commands Mean:
* `v_account account%ROWTYPE`: A PL/pgSQL variable type that automatically matches the entire column structure of the `account` table.
* `SELECT * INTO v_account ... FOR UPDATE`: Reads the account row and places an exclusive lock on it so no other transaction can modify its balance until this function finishes.
* `v_start_date + (v_plan.tenure_months || ' months')::interval`: **PostgreSQL Date Arithmetic**. Dynamically adds the plan tenure (e.g. 6 or 12 months) to the start date to compute the exact maturity date.
* `UPDATE ... RETURNING current_balance INTO v_account.current_balance`: Debits the savings balance and retrieves the updated balance in a single round-trip.
* `jsonb_build_object(...)`: Generates a binary JSON object stored directly in the `audit_log` table.

---

## 9. Routine 3: The Central Interest Cycle Engine

* **File:** `database/routines/sp_run_interest_cycle.sql`  
* **Type:** PL/pgSQL Function (`RETURNS uuid`)  
* **Purpose:** The monthly batch engine that iterates over all due FDs, computes interest, posts ledger credits, and handles failures gracefully.

```sql
CREATE OR REPLACE FUNCTION sp_run_interest_cycle(
    p_cycle_date  date,
    p_user_id     uuid DEFAULT NULL  -- NULL for system/worker
) RETURNS uuid AS $$
DECLARE
    v_run_id        uuid;
    v_fd            RECORD;
    v_interest      numeric(15,2);
    v_fd_count      int := 0;
    v_total         numeric(15,2) := 0;
    v_exceptions    int := 0;
    v_txn_id        uuid;
    v_reference_number varchar;
    v_balance_after numeric(15,2);
BEGIN
    -- 1. Create the run record (UNIQUE on cycle_date prevents duplicates)
    INSERT INTO interest_run (cycle_date, status, initiated_by)
    VALUES (p_cycle_date, 'RUNNING', p_user_id)
    RETURNING run_id INTO v_run_id;

    -- 2. Find all active FDs due for interest on this cycle date
    FOR v_fd IN
        SELECT fd_id, account_id, principal_amount,
               interest_rate_at_opening, next_interest_date
        FROM fixed_deposit
        WHERE status = 'ACTIVE'
          AND next_interest_date <= p_cycle_date
    LOOP
        BEGIN  -- Nested subtransaction block for per-FD fault isolation
            -- 3. Calculate interest using snapshot rate
            v_interest := fn_calculate_fd_interest(
                v_fd.principal_amount,
                v_fd.interest_rate_at_opening
            );

            -- 4. Post INTEREST_CREDIT through M4's patched procedure
            CALL sp_post_interest_credit(
                v_fd.account_id, v_interest, v_fd.fd_id, p_cycle_date,
                v_txn_id, v_reference_number, v_balance_after
            );

            -- 5. Record the payout
            INSERT INTO interest_payout (
                fd_id, interest_run_id, transaction_id,
                cycle_date, payout_date, interest_amount
            ) VALUES (
                v_fd.fd_id, v_run_id, v_txn_id,
                p_cycle_date, CURRENT_DATE, v_interest
            );

            -- 6. Advance next_interest_date by 30 days
            UPDATE fixed_deposit
            SET next_interest_date = next_interest_date + interval '30 days',
                updated_at = now()
            WHERE fd_id = v_fd.fd_id;

            v_fd_count := v_fd_count + 1;
            v_total := v_total + v_interest;

        EXCEPTION WHEN OTHERS THEN
            -- Fault Isolation (FR-INT-04): log failure and proceed to next FD
            v_exceptions := v_exceptions + 1;
            RAISE WARNING 'Interest payout failed for FD %: %',
                v_fd.fd_id, SQLERRM;
        END;
    END LOOP;

    -- 7. Finalize the run
    UPDATE interest_run
    SET status = 'COMPLETED',
        completed_at = now(),
        fd_count = v_fd_count,
        total_interest = v_total,
        exception_count = v_exceptions
    WHERE run_id = v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;
```

### 🔍 What the SQL Commands Mean:
* `FOR v_fd IN SELECT ... LOOP`: A PL/pgSQL cursor loop that streams each qualifying record into memory one by one.
* ⭐ `BEGIN ... EXCEPTION WHEN OTHERS THEN`: **Fault Isolation (FR-INT-04)**.
  * In standard SQL, if statement #50 fails in a 100-record batch, the entire batch aborts.
  * In this routine, the nested `BEGIN ... EXCEPTION` block traps any unexpected error on a specific FD (e.g. account frozen or database lock contention). It increments `v_exceptions`, logs `SQLERRM` (the error message), and continues to record #51. Completed payouts remain intact.
* `next_interest_date + interval '30 days'`: Advances the interest payout calendar exactly 30 days into the future.
* `CALL sp_post_interest_credit(...)`: Executes the patched stored procedure to insert the ledger row and update the savings account balance.

---

## 10. View 1: Active Fixed Deposits Report View

* **File:** `database/views/vw_rpt03_active_fds.sql`  
* **Type:** Analytical SQL View (`CREATE VIEW`)  
* **Purpose:** Feeds Report 3 (Active FDs Listing) with joint-holder string aggregation and estimated payouts.

```sql
CREATE OR REPLACE VIEW vw_rpt03_active_fds AS
SELECT
    fd.fd_id,
    fd.account_id,
    a.account_number,
    a.branch_id,                          -- Exposed for branch-scope filtering
    b.branch_name,
    fd.fd_plan_id,
    fp.plan_name                          AS product_name,
    fp.tenure_months,
    fd.principal_amount,
    fd.interest_rate_at_opening,          -- Snapshot rate
    fd.start_date,
    fd.maturity_date,
    fd.next_interest_date,
    fd.status                             AS fd_status,
    -- Holder information (aggregated into a single comma-separated string)
    string_agg(c.full_name, ', ' ORDER BY ah.joined_date) AS holder_names,
    COUNT(ah.account_holder_id)           AS holder_count,
    -- Calculated field using our immutable function
    fn_calculate_fd_interest(
        fd.principal_amount,
        fd.interest_rate_at_opening
    )                                     AS estimated_next_payout
FROM fixed_deposit fd
JOIN account a ON a.account_id = fd.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
LEFT JOIN account_holder ah ON ah.account_id = a.account_id
LEFT JOIN customer c ON c.customer_id = ah.customer_id
WHERE fd.status = 'ACTIVE'
GROUP BY fd.fd_id, fd.account_id, a.account_number, a.branch_id,
         b.branch_name, fd.fd_plan_id, fp.plan_name, fp.tenure_months,
         fd.principal_amount, fd.interest_rate_at_opening,
         fd.start_date, fd.maturity_date, fd.next_interest_date, fd.status;

GRANT SELECT ON vw_rpt03_active_fds TO mims_app;
```

### 🔍 What the SQL Commands Mean:
* `string_agg(c.full_name, ', ' ORDER BY ah.joined_date)`: Combines multiple customer names into a single string (e.g. `"Nimal Perera, Kamala Silva"`). This avoids duplicate FD rows when an account has multiple joint owners.
* `a.branch_id`: Selected in the view so the application layer can append `WHERE branch_id = $1` to enforce branch-scoping for branch managers.
* `GRANT SELECT ON ... TO mims_app`: Least-privilege security principle. Grants read-only access to the application role.

---

## 11. View 2: Monthly Interest Distribution with ROLLUP

* **File:** `database/views/vw_rpt04_interest_distribution.sql`  
* **Type:** Analytical SQL View (`CREATE VIEW`)  
* **Purpose:** Feeds Report 4 (Monthly Interest Distribution) with multi-tier hierarchical subtotals.

```sql
CREATE OR REPLACE VIEW vw_rpt04_interest_distribution AS
SELECT
    ir.cycle_date,
    EXTRACT(YEAR FROM ir.cycle_date)    AS cycle_year,
    EXTRACT(MONTH FROM ir.cycle_date)   AS cycle_month,
    sp.plan_name                        AS savings_plan_name,
    COALESCE(fp.plan_name,'Savings interest')::varchar(100) AS fd_product_name,
    a.branch_id,
    b.branch_name,
    COUNT(ip.interest_id)               AS distribution_count,
    SUM(ip.interest_amount)             AS total_interest,
    AVG(ip.interest_amount)             AS avg_interest,
    MIN(ip.interest_amount)             AS min_interest,
    MAX(ip.interest_amount)             AS max_interest
FROM interest_payout ip
JOIN interest_run ir ON ir.run_id = ip.interest_run_id
LEFT JOIN fixed_deposit fd ON fd.fd_id = ip.fd_id
LEFT JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
JOIN account a ON a.account_id = ip.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN savings_plan sp ON sp.plan_id = a.plan_id
GROUP BY ROLLUP (
    (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
    (sp.plan_name),
    (COALESCE(fp.plan_name,'Savings interest')),
    (a.branch_id, b.branch_name)
);

GRANT SELECT ON vw_rpt04_interest_distribution TO mims_app;
```

### 🔍 What the SQL Commands Mean:
* ⭐ `GROUP BY ROLLUP (...)`: **Graded L13 SQL Technique (Hierarchical OLAP Aggregation)**.
  * Standard `GROUP BY` returns rows grouped at one level.
  * `ROLLUP` produces hierarchical subtotals and a grand total automatically in a single query pass.
  * It calculates:
    1. Granular breakdown by Branch + Product + Plan + Cycle Date.
    2. Subtotals by Product + Plan + Cycle Date.
    3. Subtotals by Savings Plan + Cycle Date.
    4. Subtotals by Cycle Date.
    5. A Grand Total row where all grouping columns are `NULL`.
* `EXTRACT(YEAR / MONTH FROM ...)`: Extracts calendar parts for temporal reporting.
* `COALESCE(fp.plan_name, 'Savings interest')`: If `fp.plan_name` is `NULL` (such as savings account interest distributions), it provides a fallback label.

---

## 12. Seed Architecture & PL/pgSQL Simulation Block

* **Files:** `database/seed/_uuids.sql` & `database/seed/13_transactions.sql`  
* **Type:** SQL Script & Anonymous PL/pgSQL `DO $$` Block  
* **Purpose:** Demonstrates deterministic seeding and dynamic multi-holder transaction simulation.

### 12.1 Structured Deterministic UUID Scheme (`_uuids.sql`)
```sql
-- Pattern: 00000000-0000-0000-XXYY-ZZZZZZZZZZZ0
-- Entity codes: 01=Branch, 02=Role, 03=FD Plan, 04=User/Agent, 05=Customer, 08=Account

-- Branches
-- '00000000-0000-0000-0101-000000000001' (Colombo Main)
-- '00000000-0000-0000-0101-000000000002' (Kandy City)
-- '00000000-0000-0000-0101-000000000003' (Galle Fort)
```
* **Explanation:** Replaced random `gen_random_uuid()` with structured hexadecimal sequences. This allows cross-member seed files to reference stable foreign keys on every rebuild.

---

### 12.2 Dynamic PL/pgSQL Transaction Generator Snippet (`13_transactions.sql`)
*(Representative excerpt demonstrating how 100+ transactions were generated safely without hardcoding broken assumptions)*:

```sql
DO $$
DECLARE
    v_signers   uuid[];
    v_agent_id  uuid;
    v_branch_id uuid;
    v_out_tx_id uuid;
    v_out_ref   varchar;
    v_out_bal   numeric;
    v_out_time  timestamptz;
BEGIN
    -- 1. Temporarily relax CI daily limits to permit 100+ transactions executed in 1 second
    UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START';
    UPDATE system_parameter SET param_value = '23:59' WHERE param_key = 'BUSINESS_HOUR_END';
    UPDATE system_parameter SET param_value = '999999999.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT';

    -- 2. Dynamically resolve assigned Agent and Branch to satisfy RLS checks
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id 
    FROM account_holder ah 
    JOIN customer_agent ca ON ca.customer_id = ah.customer_id 
    JOIN agent a ON a.agent_id = ca.agent_id 
    WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;

    -- 3. Dynamically collect all joint-account signers to satisfy withdrawal mandates
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers 
    FROM account_holder ah 
    WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';

    -- 4. Set session variables for Row-Level Security
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);

    -- 5. Post withdrawal through M4's stored procedure
    CALL sp_post_withdrawal(
        '00000000-0000-0000-0801-000000000002'::uuid, 
        3377.48, 
        (SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'), 
        v_agent_id, 
        v_signers, 
        'seed-txn-0001'::varchar, 
        'Seed withdrawal'::varchar, 
        v_out_tx_id, v_out_ref, v_out_bal, v_out_time
    );
END $$;
```

### 🔍 What the SQL Commands Mean:
* `DO $$ ... END $$;`: An **Anonymous PL/pgSQL Code Block**. Executes procedural logic on the server without creating a permanent database function.
* `ARRAY_AGG(ah.customer_id)::uuid[]`: Aggregates multiple customer UUIDs into a PostgreSQL array. Passes this array into `sp_post_withdrawal` to satisfy Member 4's `fn_check_withdrawal_mandate` verification.
* `PERFORM set_config(...)`: Sets local PostgreSQL configuration parameters in memory to simulate active user sessions for Row-Level Security.

---

## 13. Glossary of Advanced PostgreSQL Keywords You Used

| Keyword / Clause | What it Does in Plain English |
|---|---|
| `IMMUTABLE` | Tells PostgreSQL the function has no side effects and always returns identical output for identical inputs, enabling query plan caching. |
| `FOR UPDATE` | Acquires an exclusive row-level lock on selected rows, serializing concurrent writes and preventing race conditions or lost updates. |
| `FOR SHARE` | Acquires a shared lock on selected rows, ensuring they are not modified while other transactions can still read them. |
| `clock_timestamp()` | Returns the actual, advancing wall-clock timestamp statement-by-statement (unlike `now()`, which freezes at transaction start). |
| `string_agg()` | Concatenates column values from multiple rows into a single delimited string (`'Val 1, Val 2'`). |
| `GROUP BY ROLLUP` | Produces hierarchical multi-level subtotals and a grand total row in a single aggregation query pass. |
| `RETURNING` | Returns columns affected by an `INSERT`, `UPDATE`, or `DELETE` statement in the same round-trip without requiring a separate `SELECT`. |
| `ON DELETE RESTRICT` | Rejects any attempt to delete a parent row if related child rows exist in the database. |
| `ON CONFLICT DO NOTHING` | Makes `INSERT` statements idempotent by silently skipping existing duplicate primary keys. |
| `BEGIN ... EXCEPTION WHEN OTHERS` | Creates an isolated subtransaction block in PL/pgSQL that traps errors without aborting the parent batch loop. |

---
*Created for Rubasingha S.T. (Index: 240575P) — CS3043 Database Systems Project Viva Voce.*
