# 🏛️ MIMS Viva Master Reference Guide & Database Concepts Index

**Member 5:** Rubasingha S.T. · **Index:** 240575P  
**Domain:** Fixed Deposits, Central 30-Day Interest Cycle Engine, Analytical Reporting (RPT-03, RPT-04), Performance Optimization, Seed Framework  
**Project:** B-Trust Microbanking and Interest Management System (MIMS) — CS3043 Database Systems  

---

## 📌 Document Overview & Quick Links
This folder contains the complete, examiner-tested documentation of everything Member 5 engineered in MIMS:

| Document | Purpose |
|---|---|
| 📄 [`viva_summary.md`](./viva_summary.md) | Full contribution summary, phase-by-phase breakdown, 30s/2m elevator pitches, and Top 15 Viva Q&A. |
| 🎬 [`viva_ui_demo_guide.md`](./viva_ui_demo_guide.md) | 3-minute live UI demonstration script with exact URLs, dashboard cards, credentials, and speaking points. |
| 🏛️ [`fd_transaction_layered_architecture.md`](./fd_transaction_layered_architecture.md) | Step-by-step 6-layer message travel (UI $\rightarrow$ API Route $\rightarrow$ Service $\rightarrow$ Pool $\rightarrow$ Routine $\rightarrow$ Tables). |
| 📜 [`all_my_sql_queries_explained.md`](./all_my_sql_queries_explained.md) | Line-by-line syntax and keyword explanations for all migrations, functions, procedures, and views. |
| 💡 [`viva_core_concepts_faq.md`](./viva_core_concepts_faq.md) | Plain-English definitions of Idempotency, RBAC, CSRF, Zod, SHA-256, RLS, Indexes, PL/pgSQL, and `EXPLAIN ANALYZE`. |

---

## 🧭 The Core Database Concepts Map

Here is the exact reference of where and how you implemented each fundamental database concept required for the CS3043 syllabus:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE DATABASE CONCEPTS MAP                       │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Referential Integrity │ ON DELETE RESTRICT on all financial FKs     │
│ 2. Indexes               │ Partial Unique, Composite, B-Tree, Idemp.   │
│ 3. Functions             │ fn_calculate_fd_interest, sp_open_fd...     │
│ 4. Procedures            │ sp_post_interest_credit (CALL, INOUT)       │
│ 5. ACID Transactions     │ Atomicity, Locking (FOR UPDATE), WAL        │
│ 6. Idempotency           │ Constraints, API Keys, SHA-256, Fixed UUIDs │
│ 7. Security Features     │ RBAC, CSRF, RLS, Least Privilege, Domains   │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 1. 🔗 Referential Integrity (Foreign Keys & Delete Rules)

Referential integrity guarantees that relationships between tables remain consistent and that no orphan child records can ever exist.

### Where You Implemented It:
1. **`fixed_deposit` Table (`0480_p04_m05_fixed_deposit.sql`):**
   ```sql
   account_id uuid NOT NULL REFERENCES account(account_id) ON DELETE RESTRICT,
   fd_plan_id uuid NOT NULL REFERENCES fd_plan(fd_plan_id) ON DELETE RESTRICT
   ```
2. **`interest_payout` Table (`0482_p04_m05_interest_run.sql`):**
   ```sql
   fd_id           uuid NOT NULL REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
   interest_run_id uuid NOT NULL REFERENCES interest_run(run_id) ON DELETE RESTRICT,
   transaction_id  uuid UNIQUE REFERENCES transaction(transaction_id) ON DELETE RESTRICT
   ```
3. **`interest_run` Table (`0482_p04_m05_interest_run.sql`):**
   ```sql
   initiated_by    uuid REFERENCES app_user(user_id)
   ```

### 💡 Why `ON DELETE RESTRICT` (The Viva Rationale):
* In banking, financial history is legally immutable.
* If an account or an FD product has financial contracts or payouts attached to it, deleting the parent must be **strictly forbidden**.
* `ON DELETE RESTRICT` mathematically prevents deletion of parent accounts or plans if child deposits or payouts exist. (We never use `CASCADE` on ledger or contract tables because cascading deletes would silently destroy audit history).

---

## 2. ⚡ Indexes (Partial, Composite, and Performance)

An index is a sorted B-Tree structure on disk allowing PostgreSQL to locate records in $O(\log N)$ time instead of scanning every page ($O(N)$ sequential scan).

### Where You Implemented Them:
1. **Partial Unique Index (`0480_p04_m05_fixed_deposit.sql`):**
   ```sql
   CREATE UNIQUE INDEX uq_one_active_fd_per_account
       ON fixed_deposit(account_id) WHERE status = 'ACTIVE';
   ```
   * **Purpose:** Enforces business rule **BR-12** (an account can only have one active FD at a time).
   * **Why Partial?** A normal `UNIQUE(account_id)` would prevent a customer from ever opening another FD in their lifetime. By filtering `WHERE status = 'ACTIVE'`, PostgreSQL allows unlimited historical `MATURED` or `CLOSED` records while blocking concurrent active deposits.
2. **Composite Partial Index (`0480_p04_m05_fixed_deposit.sql`):**
   ```sql
   CREATE INDEX ix_fd_due_interest
       ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';
   ```
   * **Purpose:** Optimizes the monthly interest cycle query. Skips hundreds of thousands of matured rows and lets `sp_run_interest_cycle` locate due accounts in sub-milliseconds.
3. **Idempotency Composite Index (`0482_p04_m05_interest_run.sql`):**
   ```sql
   CREATE UNIQUE INDEX uq_payout_fd_cycle
       ON interest_payout(fd_id, cycle_date);
   ```
   * **Purpose:** Disk-level backstop preventing duplicate payouts for the same FD in the same cycle.
4. **Analytical Query Performance Index (`0580_p05_m05_performance_indexes.sql`):**
   ```sql
   CREATE INDEX ix_payout_cycle ON interest_payout (cycle_date);
   ```
   * **Purpose:** Created during the Phase 5 `EXPLAIN ANALYZE` review. Eliminated full sequential scans on `interest_payout` during Report 4 (`vw_rpt04_interest_distribution`) grouping.

---

## 3. ⚙️ Stored Functions (`CREATE FUNCTION ... LANGUAGE plpgsql`)

Functions execute procedural logic inside PostgreSQL and return values (`RETURNS ...`).

### Where You Implemented Them:
1. **Pure Interest Math Function (`fn_calculate_fd_interest.sql`):**
   ```sql
   CREATE OR REPLACE FUNCTION fn_calculate_fd_interest(
       p_principal numeric(15,2), p_rate numeric(6,4), p_days int DEFAULT 30
   ) RETURNS numeric(15,2) AS $$ ... $$ LANGUAGE plpgsql IMMUTABLE;
   ```
   * **Formula:** $\text{round}(\text{principal} \times \text{rate} \times \text{days} / 365, 2)$.
   * Marked `IMMUTABLE` so the PostgreSQL query optimizer can cache results. Uses exact `numeric` arithmetic to prevent floating-point drift.
2. **Atomic FD Opening Routine (`sp_open_fixed_deposit.sql`):**
   * **Signature:** `RETURNS uuid`
   * Locks the account (`FOR UPDATE`), checks eligibility, verifies funds, debits balance, inserts ledger withdrawal, snapshots interest rate, and creates the FD contract atomically.
3. **Central 30-Day Interest Cycle Engine (`sp_run_interest_cycle.sql`):**
   * **Signature:** `RETURNS uuid`
   * Master batch loop executing payouts across all active due FDs with per-FD exception handling and cycle advancement (`next_interest_date + interval '30 days'`).

---

## 4. 🛠️ Stored Procedures (`CREATE PROCEDURE ... LANGUAGE plpgsql`)

Procedures are invoked with `CALL` and can pass data back through `INOUT` parameters.

### Where You Implemented It:
* **The Concurrency Bug Fix Procedure (`0483_p04_m05_interest_credit_fix.sql`):**
  ```sql
  CREATE OR REPLACE PROCEDURE sp_post_interest_credit(
      IN    p_account_id       uuid,
      IN    p_amount           numeric,
      IN    p_fd_id            uuid,
      IN    p_cycle_date       date,
      INOUT p_transaction_id   uuid DEFAULT NULL,
      INOUT p_reference_number varchar DEFAULT NULL,
      INOUT p_balance_after    numeric DEFAULT NULL
  ) LANGUAGE plpgsql AS $$ ... $$;
  ```
  * **What it does:** Called by `sp_run_interest_cycle` using `CALL`. Acquires a pessimistic lock on the account, updates balance, and inserts an `INTEREST_CREDIT` transaction into the ledger.
  * **The Master Bug Fix:** Replaced PostgreSQL's transaction-frozen `now()` with `clock_timestamp()` and appended `substring(p_fd_id::text from 1 for 8)` to eliminate reference collisions across batch loops.

---

## 5. 💎 ACID Transactions (Full Compliance)

Every financial operation in MIMS strictly satisfies all four ACID properties:

| Property | Definition | How You Enforced It in Code |
|---|---|---|
| **Atomicity** | All-or-nothing execution; no partial financial writes. | In `sp_open_fixed_deposit`, balance deduction, ledger withdrawal, FD creation, and audit logging occur inside one transaction. If any check fails, **100% rolls back**. In `sp_run_interest_cycle`, nested `BEGIN...EXCEPTION` blocks isolate failures per FD so completed distributions survive. |
| **Consistency** | The database transitions only between valid states satisfying all constraints. | Declarative checks (`CHECK (tenure_months > 0)`, `CHECK (principal_amount > 0)`), custom domains (`positive_money`, `interest_rate`), and effective dating checks (`effective_to >= effective_from`). Account balance after debit matches transaction `balance_after`. |
| **Isolation** | Concurrent transactions cannot interfere with one another. | **Pessimistic Concurrency Control:** `SELECT ... FOR UPDATE` row locks on `account` prevent lost updates and overdraft race conditions. Distributed advisory locks (`pg_advisory_xact_lock`) serialize duplicate key submissions. |
| **Durability** | Committed transactions survive system crashes and power failures. | Guaranteed by PostgreSQL Write-Ahead Logging (WAL). Verified in Phase 6 via `scripts/backup-restore-test.sh` where `pg_dump`/`pg_restore` restored exact row hashes and balance totals. |

---

## 6. 🔁 Idempotency (At 3 Distinct System Levels)

Idempotency ensures that executing an action multiple times produces the exact same result as executing it once, without duplicate side effects.

### 1. Database Constraint Level:
* **`UNIQUE(cycle_date)` on `interest_run` (BR-15):** Prevents the bank from running the same monthly interest cycle twice. A second execution is blocked by error `23505`.
* **`UNIQUE(fd_id, cycle_date)` on `interest_payout` (BR-F2):** Guarantees no single fixed deposit can receive two interest credits for the same month.

### 2. Service & API Level:
* **`Idempotency-Key` Header & SHA-256 Hashing (`fixed-deposit-service.ts`):**
  * When opening an FD, the client sends an `idempotency-key` UUID.
  * The service stores `(idempotency_key, payload_hash, fd_id)` in `fd_opening_request`.
  * If network lag causes a retry with the **same payload**, the service replays the previous FD receipt without debiting money again.
  * If someone retries with a **modified payload**, the SHA-256 hash mismatches, and the server raises `IDEMPOTENCY_CONFLICT` (HTTP 409).

### 3. Seed Framework Level (Integration Point I-8):
* Fixed deterministic UUID scheme in `database/seed/_uuids.sql` (`00000000-0000-0000-XXYY-...`).
* All seed files use `INSERT INTO ... ON CONFLICT DO NOTHING`.
* Running `npm run db:seed` 1 time or 100 times produces identical row counts and financial balance sums.

---

## 7. 🛡️ Security Features & Defense-in-Depth

Security is enforced at the database and server layers, never relying on the client UI alone.

### 1. Role-Based Access Control (RBAC):
* Server-side route handlers enforce roles via `requireRole(user, ...)`:
  * Opening Fixed Deposits: Restricted to `AGENT`, `BRANCH_MANAGER`, `CENTRAL_OPS`.
  * Triggering Monthly Interest Runs: Restricted to `CENTRAL_OPS`, `ADMIN`.
  * Changing FD Product Rates: Restricted to `ADMIN`. Non-privileged users receive **HTTP 403 Forbidden**.

### 2. Cross-Site Request Forgery (CSRF) Protection:
* All state-changing requests (`POST`, `PATCH`, `DELETE`) require a valid `x-csrf-token` header verified against session cryptographic secrets.

### 3. Row-Level Security (RLS) & Multi-Branch Scoping:
* When establishing database transactions, the service invokes `setRlsContext(tx, user)`:
  ```sql
  SET LOCAL app.current_user_id = '...';
  SET LOCAL app.current_user_role = 'AGENT';
  SET LOCAL app.current_branch_id = '...';
  ```
  PostgreSQL RLS policies evaluate `branch_id` at the storage engine level, making cross-branch data leaks impossible.

### 4. Principle of Least Privilege:
* Runtime queries connect using the restricted `mims_app` role.
* `mims_app` is granted `SELECT` on reporting views and `EXECUTE` on routines, but possesses no `DROP`, `ALTER`, or table-deletion privileges.

### 5. SQL Injection Immunity:
* 100% of queries use handwritten parameterized SQL (`$1, $2, ...`). User input is never concatenated into SQL strings.

---

## 8. 📊 Advanced Analytical SQL (OLAP & ROLLUP)

* **View:** `vw_rpt04_interest_distribution` (`08_P5_reports-rpt03-rpt04.md`)
* **Concept:** Graded CS3043 Lecture 13 OLAP Technique.
* **Implementation:**
  ```sql
  GROUP BY ROLLUP (
      (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
      (sp.plan_name),
      (COALESCE(fp.plan_name, 'Savings interest')),
      (a.branch_id, b.branch_name)
  );
  ```
* **Why it matters:** In a single database scan, PostgreSQL computes:
  1. Granular branch breakdowns.
  2. Subtotals by FD product.
  3. Subtotals by savings plan.
  4. Subtotals by cycle date.
  5. The bank-wide Grand Total row (where grouped columns evaluate to `NULL`).

---
*Authored by Rubasingha S.T. (Index: 240575P) — CS3043 Database Systems Semester Project, Group 32.*
