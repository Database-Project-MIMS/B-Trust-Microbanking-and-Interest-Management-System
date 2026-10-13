# 🎓 MIMS Final Viva Defense Guide & Contribution Summary
**Member 5:** Rubasingha S.T. · **Student Index:** 240575P  
**Domain Slice:** Fixed Deposits, Central Interest Cycle Engine, Analytical Reporting & Performance Optimization, System Seed Framework Stewardship  
**Project:** B-Trust Microbanking & Interest Management System (MIMS) — CS3043 Database Systems  
**Story Points Delivered:** 58 Points across 14 Tasks (Phases 1–6) · **Target Grade:** A+

---

## 📌 Table of Contents
1. [Quick Identity & Architecture Overview](#1-quick-identity--architecture-overview)
2. [The 30-Second & 2-Minute Viva Elevator Pitch](#2-the-30-second--2-minute-viva-elevator-pitch)
3. [Full Phase-by-Phase Technical Contribution Breakdown](#3-full-phase-by-phase-technical-contribution-breakdown)
   - [Phase 1: Foundation & Deterministic Seed Framework](#phase-1-foundation--deterministic-seed-framework)
   - [Phase 2: Master & Relational Seed Data Assembly](#phase-2-master--relational-seed-data-assembly)
   - [Phase 3: Financial Transaction Simulation & Dynamic Execution](#phase-3-financial-transaction-simulation--dynamic-execution)
   - [Phase 4: Fixed Deposits & Central Interest Cycle Engine (Core Domain)](#phase-4-fixed-deposits--central-interest-cycle-engine-core-domain)
   - [Phase 5: Reporting Views, Advanced SQL (ROLLUP), & Index Performance Review](#phase-5-reporting-views-advanced-sql-rollup--index-performance-review)
   - [Phase 6: Testing, Disaster Recovery, Ops & Cloud Hosting](#phase-6-testing-disaster-recovery-ops--cloud-hosting)
4. [Database Engineering Concepts Deep Dive (CS3043 L01–L13)](#4-database-engineering-concepts-deep-dive-cs3043-l01l13)
5. [Database Objects You Authored (Tables, Routines, Views, Indexes)](#5-database-objects-you-authored)
6. [Cross-Member Collaboration & The "Master Bug Fix"](#6-cross-member-collaboration--the-master-bug-fix)
7. [Top 15 Likely Viva Questions & Bulletproof Answers](#7-top-15-likely-viva-questions--bulletproof-answers)

---

## 1. Quick Identity & Architecture Overview

- **Who You Are:** Rubasingha S.T. (Index: `240575P`), Member 5 of Group 32.
- **Your Core Domain Responsibilities:**
  1. **Fixed Deposit Lifecycle & Products:** Product catalog (`fd_plan`), active contract storage (`fixed_deposit`), opening procedures (`sp_open_fixed_deposit`).
  2. **The Central 30-Day Interest Cycle Engine:** Batch payout orchestration (`sp_run_interest_cycle`), control logs (`interest_run`), granular transaction-linked payouts (`interest_payout`), and mathematical computation (`fn_calculate_fd_interest`).
  3. **Analytical Reports & Performance Indexing:** Built `vw_rpt03_active_fds` (Active FDs with multi-holder string aggregation) and `vw_rpt04_interest_distribution` (Monthly interest distributions using `ROLLUP` hierarchical subtotals). Led the full-database `EXPLAIN ANALYZE` index audit and authoring of performance indexes.
  4. **Team-Wide Deterministic Seed Framework (Integration Point I-8):** Built the architecture, deterministic UUID format, execution runner, and idempotency checker that all 5 members rely on to seed the database.
  5. **Cloud Deployment & Disaster Recovery:** Author of the Vercel (Next.js serverless) + Neon Cloud PostgreSQL deployment architecture and the automated bit-for-bit `pg_dump`/`pg_restore` disaster recovery verification suite.

---

## 2. The 30-Second & 2-Minute Viva Elevator Pitch

### ⏱️ The 30-Second Pitch (If the examiner says: *"Briefly introduce your contribution"*)
> *"I am Member 5, Rubasingha S.T. In MIMS, I owned the entire **Fixed Deposit and Monthly Interest Engine**, **Reporting Views 3 and 4**, the **Index Performance Audit**, and the **System Seed Framework**. 
> Specifically, I engineered the atomic `sp_open_fixed_deposit` procedure with row locking and rate snapshotting, the fault-tolerant `sp_run_interest_cycle` batch procedure with per-FD exception isolation, the `ROLLUP` analytical view for interest distribution, and the partial unique index guaranteeing only one active FD per account. I also built the deterministic seed framework with fixed UUIDs that the entire team used."*

### ⏱️ The 2-Minute Detailed Pitch (If the examiner says: *"Walk us through what you designed and built"*)
> *"Our project follows a strict Database-First architecture where financial truth is enforced inside PostgreSQL rather than in JavaScript.
> 
> My primary responsibility was the **Fixed Deposit domain and the Central 30-Day Interest Engine**:
> 1. In **Phase 1**, I built the `fd_plan` catalog supporting effective dating and fractional rates. Crucially, I designed **Integration Point I-8**—the team's seed framework using a structured deterministic UUID scheme and an atomic load runner with idempotency checks.
> 2. In **Phase 2 and 3**, I assembled the organisational, customer, and account seed data, and algorithmically simulated 100+ transactions over 30 days using a dynamic PL/pgSQL block to verify account minimums, mandates, and ledger balances.
> 3. In **Phase 4**, which was my heaviest phase (18 points), I engineered the core financial engine:
>    - I created the `fixed_deposit` table with a **partial unique index** (`WHERE status = 'ACTIVE'`) enforcing that an account can have only one active FD at a time.
>    - I wrote `sp_open_fixed_deposit`, which acquires a pessimistic `FOR UPDATE` lock on the savings account, validates eligibility via M3's routine, debits the principal, snapshots the interest rate, and creates the ledger and audit records atomically.
>    - I implemented `fn_calculate_fd_interest`, an `IMMUTABLE` mathematical routine using pure `NUMERIC(15,2)` precision to avoid floating-point drift.
>    - I authored `sp_run_interest_cycle`, which processes all due FDs. To ensure compliance with FR-INT-04, each payout runs in an isolated block so a single failing FD never rolls back already-processed disbursements. I also caught and fixed a critical concurrency bug in M4's routine where `now()` caused unique reference collisions during batch loops.
> 4. In **Phase 5**, I created `vw_rpt03_active_fds` using `string_agg` for joint holders, and `vw_rpt04_interest_distribution` using advanced **`GROUP BY ROLLUP`** to deliver multi-level subtotals and grand totals directly from PostgreSQL. I then ran `EXPLAIN ANALYZE` across all 5 reports, eliminated sequential scans, and created required indexes.
> 5. Finally in **Phase 6**, I proved cycle idempotency and report reconciliation with automated tests, validated disaster recovery using checksummed `pg_dump`/`pg_restore`, and configured our live deployment on Vercel with Neon PostgreSQL."*

---

## 3. Full Phase-by-Phase Technical Contribution Breakdown

### Phase 1: Foundation & Deterministic Seed Framework
- **Task P01-M05-T01 (`feat/p01-m05-fd-plan-schema`): FD Product Schema**
  - **Migration:** `0180_p01_m05_fd_plan.sql`
  - Created the `fd_plan` table defining the 3 statutory fixed deposit products (BR-13: 6 months @ 13%, 12 months @ 14%, 36 months @ 15%).
  - Enforced `CHECK (tenure_months > 0)` and rate constraints `CHECK (interest_rate >= 0 AND interest_rate <= 1)`.
  - Stored interest rates as exact fractions (`0.1300` rather than `13` or `13.00`) using `NUMERIC(6,4)`.
  - Implemented **effective dating** columns (`effective_from`, `effective_to`) with table constraint `CHECK (effective_to IS NULL OR effective_to >= effective_from)` to preserve historical product terms when rates change (G-11).
- **Task P01-M05-T02 (`feat/p01-m05-fd-product-api`): Product Admin Backend**
  - Built `services/fd-product-service.ts` and API endpoints `GET /api/fd-products` and `PATCH /api/fd-products/:id`.
  - Implemented strict RBAC checks: any authenticated user can view rates, but only `ADMIN` can alter product rates with CSRF token verification.
- **Task P01-M05-T03 (`feat/p01-m05-seed-framework`): Deterministic Seed Framework (⚡ Publishes I-8)**
  - **The Problem:** Random IDs from `gen_random_uuid()` cause foreign keys between members' seed files to break on every run, making automated testing and determinism impossible.
  - **The Solution:** Authored `database/seed/_uuids.sql` establishing a deterministic 128-bit UUID pattern:
    $$\text{Pattern: } 00000000-0000-0000-XXYY-ZZZZZZZZZZZ0$$
    *(where $XX$ is entity type code: 01=Branch, 02=Role, 03=FD Plan, 04=User/Agent, 05=Customer, 08=Account).*
  - Established `_load-order.txt` to respect strict relational topological sort (Roles $\rightarrow$ Branches $\rightarrow$ Users $\rightarrow$ Agents $\rightarrow$ Customers $\rightarrow$ Accounts $\rightarrow$ Transactions $\rightarrow$ FDs $\rightarrow$ Interest Runs).
  - Built `scripts/seed.mjs` wrapping the sequential file execution in an atomic `BEGIN ... COMMIT` block with graceful fallback checks.
  - Built `scripts/seed-check.mjs` to automatically verify AC-12 minimum row counts, execute a 2nd re-seed, and assert 100% idempotency with identical row counts and financial balance sums.
  - Authored the team-wide integration contract `.agent/handoffs/i8-seed-framework.md`.

---

### Phase 2: Master & Relational Seed Data Assembly
- **Task P02-M05-T01 (`feat/p02-m05-seed-sets-1-3`): Seed Sets 1, 2, and 3**
  - **Organisational Data (Set 1):** Authored `00_roles.sql` (7 roles), `01_branches.sql` (3 branches), `02_users.sql` (1 Admin, 3 Managers, 6 Agents with real `argon2id` hashes), and `03_agents.sql` (shared-PK linking to `app_user`).
  - **Customer Data (Set 2):** Authored `04_customers.sql` (15 customers across mixed age brackets: children, teens, adults, seniors to test eligibility), `05_customer_agents.sql` (active assignments), and `06_customer_documents.sql` (verified NIC and birth certificate records).
  - **Account Data (Set 3):** Authored `10_accounts.sql` (10 accounts covering all 5 savings plans), `11_account_holders.sql` (individual and joint holders), and `12_joint_mandates.sql` (configured `ANY_ONE` and `ALL_HOLDERS` rules).
  - Guaranteed safe idempotent re-runs by implementing `INSERT INTO ... ON CONFLICT DO NOTHING`.

---

### Phase 3: Financial Transaction Simulation & Dynamic Execution
- **Task P03-M05-T01 (`feat/p03-m05-seed-transactions`): Seed Set 4 (Transactions)**
  - Authored `database/seed/13_transactions.sql` containing **100+ financial transactions** spread across 30+ calendar days, 3 branches, and all 5 savings plan types.
  - **Overcoming Cross-Member Dependencies:** Because Member 4's stored procedures were under construction, drafted an intermediate Python generator simulating internal balances to guarantee that 30+ withdrawals never violated `min_balance` or dropped balances below zero.
  - **Dynamic PL/pgSQL Architecture:** To handle strict Row Level Security (RLS), multi-party signature mandates (`fn_check_withdrawal_mandate`), and CI environment limitations (where all seed scripts run in the same millisecond):
    - Wrapped execution in a dynamic `DO $$` PL/pgSQL block that automatically aggregates signers `ARRAY_AGG(ah.customer_id)` and looks up the assigned agent.
    - Temporarily adjusted system parameters (`BUSINESS_HOUR_START`, `WITHDRAWAL_DAILY_LIMIT`) inside the block so transactions simulating different times of day pass without artificial CI failures.
    - Wrapped reversals in `IF NOT EXISTS` blocks against `transaction_reversal` to achieve perfect idempotency.

---

### Phase 4: Fixed Deposits & Central Interest Cycle Engine (Core Domain)
*This was your heaviest phase (18 Story Points across 5 tasks). You authored the entire fixed deposit and interest pipeline.*

- **Task P04-M05-T01 (`feat/p04-m05-fd-schema`): Fixed Deposit Schema**
  - **Migration:** `0480_p04_m05_fixed_deposit.sql`
  - Created `fixed_deposit` table with columns: `fd_id`, `account_id`, `fd_plan_id`, `principal_amount`, `interest_rate_at_opening`, `start_date`, `maturity_date`, `next_interest_date`, and `status`.
  - **Partial Unique Index (G-01, BR-12):**
    ```sql
    CREATE UNIQUE INDEX uq_one_active_fd_per_account 
    ON fixed_deposit(account_id) WHERE status = 'ACTIVE';
    ```
    *Enforces at the database level that an account can NEVER have more than one active FD simultaneously, while freely allowing multiple historical `MATURED` or `CLOSED` records.*
  - Added indexed lookups: `CREATE INDEX ix_fd_due_interest ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';`

- **Task P04-M05-T03 (`feat/p04-m05-interest-function`): Pure Mathematical Interest Routine**
  - **Routine:** `database/routines/fn_calculate_fd_interest.sql`
  - Formula: $\text{Interest} = \text{round}\left(\frac{\text{principal} \times \text{rate} \times \text{days}}{365}, 2\right)$
  - Declared as `IMMUTABLE` in PL/pgSQL so PostgreSQL can cache and optimize repeated executions.
  - Strictly operated on `NUMERIC(15,2)` and `NUMERIC(6,4)` with a single final rounding step, completely avoiding binary floating-point drift.

- **Task P04-M05-T02 (`feat/p04-m05-open-fd`): Atomic FD Opening Procedure**
  - **Routine:** `database/routines/sp_open_fixed_deposit.sql`
  - **ACID Transaction Boundary:**
    1. Locks the savings account using `SELECT ... FOR UPDATE` (L11 Pessimistic Concurrency Control) to eliminate race conditions.
    2. Validates account status via M3's `fn_check_account_fd_eligible(p_account_id)`.
    3. Asserts `current_balance >= p_amount` (guarantees no overdraft).
    4. Calculates `maturity_date = start_date + tenure_months` and `next_interest_date = start_date + 30 days`.
    5. Deducts principal from `account.current_balance`.
    6. Generates unique reference number via `fn_next_transaction_reference()`.
    7. Inserts a `WITHDRAWAL` record into `transaction` with accurate `balance_after`.
    8. Inserts row into `fixed_deposit` with **rate snapshotting** (`interest_rate_at_opening` copied from `fd_plan.interest_rate`, never re-read from the catalog).
    9. Writes an immutable record to `audit_log`.
    *All steps execute within a single transaction; any failure rolls back 100% of state changes.*

- **Task P04-M05-T04 (`feat/p04-m05-interest-cycle`): The 30-Day Central Interest Cycle Engine**
  - **Migration:** `0482_p04_m05_interest_run.sql`
  - Created batch audit tables:
    - `interest_run`: Master run control log with `UNIQUE(cycle_date)` preventing duplicate cycle runs (BR-15).
    - `interest_payout`: Granular ledger link with `UNIQUE(fd_id, cycle_date)` preventing paying the same FD twice in the same cycle (BR-F2).
  - **Routine:** `database/routines/sp_run_interest_cycle.sql`
    - Loops over all active FDs where `next_interest_date <= p_cycle_date`.
    - **Fault Isolation (FR-INT-04):** Wraps each individual FD distribution in a nested `BEGIN ... EXCEPTION WHEN OTHERS` block. If one FD fails (e.g., account frozen or closed), the error is caught, logged to `exception_count`, and the cycle proceeds without rolling back already-completed payouts!
    - Calls `sp_post_interest_credit` to post ledger transactions, records the payout, and advances `next_interest_date = next_interest_date + 30 days`.
    - Closes `interest_run` with final `fd_count`, `total_interest`, and `status = 'COMPLETED'`.
  - **🌟 The Concurrency Bug Fix Migration (`0483_p04_m05_interest_credit_fix.sql`):**
    - While integrating with M4's `sp_post_interest_credit`, discovered that M4 used `now()` to construct reference numbers. In PostgreSQL, `now()` returns the transaction start time and remains identical across an entire batch loop, causing `23505` unique violations on `transaction.reference_number`.
    - Patched M4's routine to use `clock_timestamp()` (advancing in real-time) and appended `substring(p_fd_id::text from 1 for 8)` to guarantee absolute mathematical uniqueness.

- **Task P04-M05-T05 (`feat/p04-m05-fd-pages`): Full FD & Interest Console Endpoints**
  - Implemented route handlers for `/api/fixed-deposits` and `/api/interest-runs`.
  - Protected endpoints with role-based access control: only `CENTRAL_OPS` and `ADMIN` can trigger interest cycles.

---

### Phase 5: Reporting Views, Advanced SQL (ROLLUP), & Index Performance Review
*Phase 5 carried 12 Story Points, focusing on analytical query optimization and database view design.*

- **Task P05-M05-T01 (`feat/p05-m05-rpt03-view`): Active Fixed Deposits View (RPT-03)**
  - **View:** `database/views/vw_rpt03_active_fds.sql`
  - Joins `fixed_deposit`, `account`, `branch`, `fd_plan`, `account_holder`, and `customer`.
  - Aggregates multiple joint holders into a comma-separated list in SQL:
    ```sql
    string_agg(c.full_name, ', ' ORDER BY ah.joined_date) AS holder_names
    ```
  - Calculates estimated next payout using `fn_calculate_fd_interest(...)`.
  - Exposes `branch_id` so the API can apply server-side `branchScope()` in the `WHERE` clause.
  - Granted explicit `SELECT` privileges to the least-privilege `mims_app` database role.

- **Task P05-M05-T02 (`feat/p05-m05-rpt04-view`): Monthly Interest Distribution View with ROLLUP (RPT-04)**
  - **View:** `database/views/vw_rpt04_interest_distribution.sql`
  - **Graded L13 SQL Technique:** Utilizes `GROUP BY ROLLUP` across the hierarchy:
    ```sql
    GROUP BY ROLLUP (
        (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
        (sp.plan_name),
        (COALESCE(fp.plan_name, 'Savings interest')),
        (a.branch_id, b.branch_name)
    );
    ```
  - Computes `COUNT(distribution_count)`, `SUM(total_interest)`, `AVG(avg_interest)`, `MIN`, and `MAX`.
  - Automatically generates subtotals at each grouping level and a grand total row in a single query pass without requiring JavaScript post-processing.

- **Task P05-M05-T03 (`feat/p05-m05-report-pages`): Report APIs & CSV Streaming**
  - Integrated into M1's report framework (`I-7`).
  - Added `/api/reports/active-fds` and `/api/reports/interest-distribution` supporting branch scoping, date filtering, audit logging (`auditReportAccess`), and streaming CSV export.

- **Task P05-M05-T04 (`feat/p05-m05-explain-analyze`): Database-Wide Index Performance Audit**
  - **Migration:** `0580_p05_m05_performance_indexes.sql`
  - Executed `EXPLAIN ANALYZE` across all 5 management reports in the system.
  - Identified sequential scans on large tables (`transaction`, `interest_payout`).
  - Created `CREATE INDEX ix_payout_cycle ON interest_payout(cycle_date)`.
  - Renamed and aligned existing transaction indexes to exact specification standards (`ix_txn_account_date`, `ix_txn_agent_date`).
  - Authored the comprehensive 43 KB evidence dossier `database/indexes/explain-analyze-evidence.md` demonstrating sub-millisecond planning and execution times across all reports.

---

### Phase 6: Testing, Disaster Recovery, Ops & Cloud Hosting
- **Task P06-M05-T01 (`feat/p06-m05-idempotency-tests`): Automated Idempotency & Reconciliation Test Suite**
  - **Test File:** `tests/db/interest-idempotency.test.mjs`
  - Automated testing for Acceptance Criteria **AC-08** and **AC-09**:
    1. **Cycle Idempotency:** Verified that running `sp_run_interest_cycle` a 2nd time on the same date triggers unique constraint violation `23505` on `interest_run.cycle_date`.
    2. **Payout Idempotency:** Proved duplicate payouts for the same FD and date are blocked by `uq_payout_fd_cycle`.
    3. **Fault Tolerance:** Verified that an intentional exception on a frozen account results in `exception_count = 1` while valid FDs are successfully credited.
    4. **Financial Reconciliation:** Verified that RPT-03 principal matches direct `SUM(principal_amount)`, RPT-04 interest matches direct `SUM(interest_amount)`, and payout row count matches `INTEREST_CREDIT` transaction row count.
- **Task P06-M05-T02 (`feat/p06-m05-ops-deployment`): Disaster Recovery, Demonstration Script & Vercel Hosting**
  - **Disaster Recovery Runner:** Authored `scripts/backup-restore-test.sh` automating `pg_dump -Fc` and `pg_restore`. Used database-wide row counts, whole-row hashes, and exact balance/interest checksums to prove the restored database is bit-for-bit identical to source (satisfying AC-13).
  - **Demonstration Guide:** Authored `docs/demonstration-script.md` providing a 10-step end-to-end evaluation script for lecturers and QA.
  - **Cloud Hosting Guide:** Authored `5_Selith/vercel_deployment_guide.md` specifying:
    - Frontend / Backend deployment on Vercel Serverless Functions.
    - PostgreSQL hosted on Neon Cloud Database with connection pooling and SSL (`sslmode=require&channel_binding=require`).
    - Separation of privileges (`mims_app` application credentials vs. administrative migration tokens).
    - Cron adapter specifications for triggering scheduled monthly interest runs.

---

## 4. Database Engineering Concepts Deep Dive (CS3043 L01–L13)

When the examiner tests your database theory, connect these lecture concepts directly to your code:

| Lecture & Concept | Theoretical Definition | Where YOU Applied It in MIMS |
|---|---|---|
| **L02: Relational Data Model** | Integrity constraints, domains, primary and foreign keys | Defined custom PostgreSQL domains `positive_money` and `interest_rate`; enforced `ON DELETE RESTRICT` on financial child tables (`fixed_deposit`, `interest_payout`). |
| **L03: Constraints & Triggers** | Declarative integrity vs procedural enforcement | `CHECK` constraints on `fd_plan` and `fixed_deposit` dates; effective dating constraints (`effective_to >= effective_from`). |
| **L05: Advanced Joins & Aggregations** | Multi-table joins and string grouping | Multi-table `LEFT JOIN`s in `vw_rpt03_active_fds` combining `account`, `branch`, and `customer`; used `string_agg()` to combine joint holders. |
| **L10: Indexing & B-Trees** | Direct search structures, composite indexes, index scan vs seq scan | Created `ix_fd_due_interest` on `(status, next_interest_date)` and `ix_payout_cycle` on `cycle_date`. Converted sequential scans to index scans. |
| **L10: Partial Indexes** | Indexing only a subset of table rows satisfying a predicate | `CREATE UNIQUE INDEX uq_one_active_fd_per_account ON fixed_deposit(account_id) WHERE status = 'ACTIVE'`. Saves disk space and enforces business rule BR-12. |
| **L11: Concurrency Control** | Isolation levels, lost updates, pessimistic locking | Used `SELECT ... FOR UPDATE` in `sp_open_fixed_deposit` and `sp_post_interest_credit` to lock account rows before balance checks and balance updates. |
| **L11: Transaction Atomicity & Savepoints** | All-or-nothing execution; nested exception blocks | `sp_open_fixed_deposit` wraps balance deduction and FD creation in one transaction. `sp_run_interest_cycle` uses nested `BEGIN...EXCEPTION` blocks for per-FD fault isolation. |
| **L13: OLAP & Advanced Grouping** | Multidimensional data aggregation, Data Cubes, `ROLLUP` | In `vw_rpt04_interest_distribution`, used `GROUP BY ROLLUP` to produce hierarchical subtotals by cycle, savings plan, FD product, and branch plus grand total. |
| **Database Security & RBAC** | Principle of least privilege, role separation | Granted explicit `GRANT SELECT` to `mims_app` on views; restricted `interest_run` and rate edits to administrative roles. |

---

## 5. Database Objects You Authored

### 🗄️ Tables (4 Tables)
1. `fd_plan` — Fixed deposit catalog with tenure, rates, and effective dates.
2. `fixed_deposit` — Active contracts, principal, snapshot rates, maturity/next payout dates.
3. `interest_run` — Master cycle control records, status, FD counts, total sums, exceptions.
4. `interest_payout` — Granular payouts linked to specific FDs, cycles, and ledger transactions.

### ⚙️ Stored Procedures & Functions (3 Routines)
1. `sp_open_fixed_deposit(account_id, fd_plan_id, amount, user_id, channel_id)` — Locks account, checks eligibility, deducts balance, records withdrawal ledger transaction, creates FD with rate snapshot, writes audit log.
2. `sp_run_interest_cycle(cycle_date, user_id)` — Batch processor iterating over due active FDs with isolated `BEGIN...EXCEPTION` error handling, calls ledger routine, records payout, and advances date by 30 days.
3. `fn_calculate_fd_interest(principal, rate, days)` — `IMMUTABLE` mathematical formula routine executing exact `NUMERIC(15,2)` interest calculations.

### 👁️ Views (2 Views)
1. `vw_rpt03_active_fds` — Active FD listing with `string_agg` joint holders and calculated next payout.
2. `vw_rpt04_interest_distribution` — Analytical interest distribution with `GROUP BY ROLLUP` multi-tier subtotals.

### ⚡ Indexes Created & Managed (4 Indexes)
1. `uq_one_active_fd_per_account` — Partial unique index on `fixed_deposit(account_id) WHERE status = 'ACTIVE'`.
2. `ix_fd_due_interest` — Partial index on `fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE'`.
3. `ix_payout_cycle` — Performance B-Tree index on `interest_payout(cycle_date)`.
4. `uq_payout_fd_cycle` — Unique composite index on `interest_payout(fd_id, cycle_date)` (Idempotency backstop).

---

## 6. Cross-Member Collaboration & The "Master Bug Fix"

During development, Member 5 was the central integration hub:

1. **You Published Integration Point I-8 (Seed Framework):**
   - All other 4 members depended on your seed directory layout, `_uuids.sql` scheme, and `scripts/seed.mjs` runner to insert their branches, accounts, customers, and transactions.
2. **You Consumed:**
   - **I-1** from Member 1 (Nadija): Authentication helpers, RBAC (`requireRole`), CSRF verification.
   - **I-6** from Member 3 (Nisith): Account eligibility verification (`fn_check_account_fd_eligible`).
   - **I-5** from Member 4 (Pramudith): Ledger credit routine (`sp_post_interest_credit`).
   - **I-7** from Member 1 (Nadija): Reporting pagination, filters, and streaming CSV export.
3. **🌟 The Concurrency Bug Fix You Found and Repaired:**
   - **The Issue:** Member 4's procedure `sp_post_interest_credit` generated reference numbers using `now()`. In PostgreSQL transactions, `now()` represents the transaction start timestamp and is frozen. When your `sp_run_interest_cycle` procedure executed across multiple FDs in the batch, every payout in the same run attempted to insert identical reference numbers, triggering a fatal unique constraint violation.
   - **Your Fix:** You authored migration `0483_p04_m05_interest_credit_fix.sql`. You replaced `now()` with `clock_timestamp()` (which reflects actual wall-clock time statement-by-statement) and appended a substring of the `fd_id` (`substring(p_fd_id::text from 1 for 8)`). This guaranteed absolute reference number uniqueness even when transactions process in the exact same millisecond!

---

## 7. Top 15 Likely Viva Questions & Bulletproof Answers

### Q1: Why did you use a partial unique index on `fixed_deposit` instead of a standard `UNIQUE(account_id)` constraint?
> **Answer:** *"A standard unique constraint on `account_id` would permanently restrict an account to having only one fixed deposit in its entire lifetime. In banking, a customer can open an FD, let it mature or close it, and later open another one. By using a partial unique index `ON fixed_deposit(account_id) WHERE status = 'ACTIVE'`, PostgreSQL enforces uniqueness only across active accounts. This allows unlimited historical records with status `MATURED` or `CLOSED` while mathematically guaranteeing that no account can ever hold two concurrent active FDs."*

### Q2: Why did you store `interest_rate_at_opening` on the `fixed_deposit` row instead of reading it from `fd_plan` via a JOIN?
> **Answer:** *"This is the **Rate Snapshot Pattern** (BR-19, G-11). If the bank changes the interest rate on the 1-Year FD product in `fd_plan` next year from 14% to 12%, existing customer contracts must remain locked at the original 14% agreed upon at opening. Joining directly to `fd_plan` would retroactively alter the payouts on existing fixed deposits. By snapshotting the rate into `interest_rate_at_opening` at the moment `sp_open_fixed_deposit` executes, the contract terms remain immutable."*

### Q3: Why did you use `NUMERIC` types instead of `FLOAT` or `DOUBLE PRECISION` for money and rates?
> **Answer:** *"Floating-point numbers in computer systems use IEEE-754 binary representation, which cannot precisely represent fractional decimal values like 0.1 or 0.01. Over thousands of compound financial transactions, floating-point rounding errors lead to drift and balance mismatches. PostgreSQL's `NUMERIC` (or `DECIMAL`) type is an exact arbitrary-precision decimal representation. We enforced `NUMERIC(15,2)` for money amounts and `NUMERIC(6,4)` for rates so every calculation is exact to the cent."*

### Q4: In `sp_open_fixed_deposit`, why did you use `SELECT ... FOR UPDATE` on the account table?
> **Answer:** *"To prevent race conditions and lost updates (L11 Concurrency Control). If two transactions attempt to open an FD or withdraw money from the same account simultaneously, reading the balance without a lock could allow both to pass the balance check before either deducts the funds, causing an unauthorized overdraft. `SELECT ... FOR UPDATE` acquires an exclusive row-level lock on the account record, forcing concurrent transactions to serialize until our transaction commits or rolls back."*

### Q5: In `sp_run_interest_cycle`, what happens if FD #50 fails out of 100 FDs? Does the whole cycle roll back?
> **Answer:** *"No, it does not. According to business rule FR-INT-04, an interest cycle must provide fault isolation. In `sp_run_interest_cycle`, the loop wraps each individual payout in a nested `BEGIN ... EXCEPTION WHEN OTHERS` block. If FD #50 encounters an error (for example, the underlying account was frozen), the exception is trapped, an error warning is raised, `exception_count` is incremented, and execution immediately advances to FD #51. FDs #1 through #49 remain committed, and the overall run completes with status `COMPLETED`."*

### Q6: How do you guarantee that an interest cycle is never executed twice for the same date?
> **Answer:** *"We enforce idempotency declaratively at the schema level rather than relying solely on procedural checks. The `interest_run` table has a `UNIQUE(cycle_date)` constraint. If an administrator or automated cron job accidentally triggers `sp_run_interest_cycle` twice for the same date, the 2nd run's initial insert fails immediately with unique constraint violation `23505`, preventing duplicate payouts or duplicate ledger entries. Furthermore, `interest_payout` has a composite `UNIQUE(fd_id, cycle_date)` index as a second layer of defense."*

### Q7: What bug did you find in M4's ledger routine and how did you resolve it?
> **Answer:** *"Member 4's procedure `sp_post_interest_credit` generated transaction reference numbers using PostgreSQL's `now()` function. In PostgreSQL, `now()` returns the start timestamp of the current transaction and does not change during the execution of a batch loop. When my interest cycle processed multiple FDs, all payouts generated identical reference number strings, triggering a `23505` unique violation. I fixed this in migration `0483` by replacing `now()` with `clock_timestamp()`—which advances in real time per statement—and concatenating the first 8 characters of the `fd_id` to ensure absolute uniqueness."*

### Q8: Explain what `GROUP BY ROLLUP` does in your RPT-04 view.
> **Answer:** *"Standard `GROUP BY` returns rows grouped at a single aggregation level. `GROUP BY ROLLUP` is an OLAP extension that creates a hierarchical set of grouping levels, automatically generating subtotals and grand totals in a single query pass. In `vw_rpt04_interest_distribution`, `ROLLUP` groups by cycle date, savings plan, FD product, and branch. PostgreSQL calculates metrics for the full branch breakdown, then subtotals for each product, subtotals for each savings plan, subtotals for the cycle, and finally a grand total row where the grouping columns are `NULL`."*

### Q9: Why did you declare `fn_calculate_fd_interest` as `IMMUTABLE`?
> **Answer:** *"In PostgreSQL, an `IMMUTABLE` function is guaranteed to return the exact same output whenever given the same inputs, without modifying database state or reading configuration tables. Marking it `IMMUTABLE` allows the PostgreSQL query optimizer to perform function evaluation during query planning and optimize index scans or subqueries without repeatedly invoking the PL/pgSQL engine."*

### Q10: How did you aggregate joint account holders in RPT-03 without creating duplicate FD rows?
> **Answer:** *"Because an account can have multiple holders linked via the `account_holder` bridge table, a plain `JOIN` would duplicate the FD record for each holder. Instead of aggregating in application code, I used PostgreSQL's `string_agg(c.full_name, ', ' ORDER BY ah.joined_date)` and `COUNT(ah.account_holder_id) AS holder_count` combined with `GROUP BY fd.fd_id, ...`. This formats all joint holders into a clean, comma-separated string directly inside the database view in a single pass."*

### Q11: What was your methodology for the `EXPLAIN ANALYZE` index performance review in Phase 5?
> **Answer:** *"I loaded realistic seed data (100+ transactions) and executed `EXPLAIN ANALYZE` across all 5 management report views. In the query execution trees, I looked for `Seq Scan` (Sequential Scans) on high-growth tables like `transaction` and `interest_payout`. Sequential scans force PostgreSQL to read every single page on disk ($O(N)$ complexity). I introduced B-Tree indexes—specifically `ix_payout_cycle` on `interest_payout(cycle_date)`—which converted the execution plans into `Index Scan` or `Bitmap Index Scan` with logarithmic $O(\log N)$ access time, achieving execution speeds well under 1 millisecond."*

### Q12: Why did your seed framework use fixed UUIDs instead of `gen_random_uuid()`?
> **Answer:** *"Seed data must be **deterministic and idempotent**. If we use random UUIDs, primary keys change on every rebuild. That would break other team members' seed files because they couldn't hardcode foreign key references to branches, plans, or accounts. By establishing a fixed UUID structure like `00000000-0000-0000-0101-000000000001` for Colombo Main Branch, all members could safely reference foreign keys knowing they were guaranteed to resolve."*

### Q13: How did you test backup and restore in Phase 6?
> **Answer:** *"I wrote `scripts/backup-restore-test.sh` to prove disaster recovery (AC-13). The script takes a compressed binary dump using `pg_dump -Fc`, computes row counts and financial balance sums across `account`, `fixed_deposit`, and `interest_payout`, restores the dump into a separate clean test database using `pg_restore`, and verifies via `diff` that the row counts, table checksums, and money totals match bit-for-bit."*

### Q14: How does your database prevent SQL injection in report queries?
> **Answer:** *"In accordance with our AGENTS.md contract, application code uses Node's `pg` library with parameterized queries exclusively (`$1, $2, ...`). User input is never concatenated or interpolated into SQL strings. For dynamic report sorting or filtering, identifiers are validated against strict server-side allow-lists. Furthermore, all view queries are granted read-only permissions under the restricted `mims_app` database role."*

### Q15: How is MIMS hosted and structured in production?
> **Answer:** *"The application is hosted on Vercel as a Next.js App Router application utilizing Serverless Functions. The relational database is hosted on a managed Neon PostgreSQL instance in AWS Asia-Pacific, configured with connection pooling and SSL encryption (`sslmode=require&channel_binding=require`). Production migrations are isolated through GitHub Actions using administrative migration URLs, while Vercel runtime functions connect exclusively via least-privilege pooled application roles."*

---
*Summary compiled for Rubasingha S.T. (Index: 240575P) — CS3043 Group 32 Viva Voce Examination.*
