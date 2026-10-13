# 🎬 3-Minute Live UI Demonstration Script for Viva

**Candidate:** Rubasingha S.T. (Index: 240575P) · **Member 5**  
**Domain:** Fixed Deposits, Central Interest Cycle Engine, Analytical Reporting (RPT-03, RPT-04), FD Products Catalog  
**Target Duration:** Exactly 3 Minutes (180 Seconds)  
**Credentials:**  
* **Staff Agent:** Username: `agent_c1` · Password: `Password123!`  
* **Central Ops / Admin:** Username: `admin` (or `central_ops`) · Password: `Password123!`  

---

## 🧭 Overview of UI Pages You Own & Will Demonstrate

| Page URL | UI Purpose | Database Feature You Are Demonstrating |
|---|---|---|
| [`/fixed-deposits/new`](http://localhost:3000/fixed-deposits/new) | Open a new Fixed Deposit from savings balance | `SELECT ... FOR UPDATE` row locks, `sp_open_fixed_deposit`, Rate Snapshotting, Ledger `WITHDRAWAL` entry |
| [`/fixed-deposits`](http://localhost:3000/fixed-deposits) | Fixed Deposit ledger & contract status | Partial Unique Index (`uq_one_active_fd_per_account`), immutable snapshot rate display |
| [`/interest-runs`](http://localhost:3000/interest-runs) | Central 30-day interest batch console | `sp_run_interest_cycle`, fault isolation (`BEGIN...EXCEPTION`), Cycle Idempotency (`UNIQUE(cycle_date)`) |
| [`/reports/active-fds`](http://localhost:3000/reports/active-fds) | RPT-03: Active Fixed Deposits Report | `string_agg` multi-holder aggregation, `fn_calculate_fd_interest` next payout projection |
| [`/reports/interest-distribution`](http://localhost:3000/reports/interest-distribution) | RPT-04: Monthly Interest Distribution | **`GROUP BY ROLLUP`** (L13 OLAP) hierarchical subtotals and grand totals |
| [`/fd-products`](http://localhost:3000/fd-products) | Product Catalogue & Rate History | Effective Dating (`effective_from`, `effective_to`), Admin RBAC restriction |

---

## ⏱️ Minute-by-Minute Demonstration Flow

```
[00:00 - 01:10] ────────► MINUTE 1: Open an FD, Rate Snapshot & The Partial Index Demo
                             (Login: agent_c1 | Pages: /fixed-deposits/new & /fixed-deposits)

[01:10 - 02:15] ────────► MINUTE 2: The 30-Day Central Interest Batch & Idempotency
                             (Login: admin / central_ops | Page: /interest-runs)

[02:15 - 03:00] ────────► MINUTE 3: Advanced SQL Reports (ROLLUP) & Product Catalog
                             (Login: admin | Pages: /reports/interest-distribution & /fd-products)
```

---

### ⏱️ MINUTE 1 (00:00 – 01:10): Fixed Deposit Opening & Database Defense
**Persona:** Bank Agent (`agent_c1` / `Password123!`)  
**Objective:** Show atomic FD opening, live balance deduction, rate snapshotting, and trigger the partial unique index error.

#### 1. Navigate & Open an FD:
1. Sign in as `agent_c1` and go to **Savings products $\rightarrow$ Fixed deposits $\rightarrow$ Open fixed deposit** ([`/fixed-deposits/new`](http://localhost:3000/fixed-deposits/new)).
2. Select any active savings account from the dropdown.
3. Select an FD Product: **1 Year FD (14.00%)**.
4. Enter Principal: `50000.00`.
5. Click **"Review fixed deposit"**:
   * *Point to the screen:* Show how the preview card displays the account, the debit amount, and the projected savings balance after debit.
6. Click **"Confirm and open"**:
   * *Point to the green success card:* Shows Account Number, LKR 50,000.00, 14.00% rate, calculated Maturity Date, and Next Payout Date.

#### 🗣️ What to say to the Examiner:
> *"Here in `/fixed-deposits/new`, the agent submits an opening request. Behind the scenes, my stored procedure `sp_open_fixed_deposit` executes inside an atomic transaction. It acquires a `SELECT ... FOR UPDATE` pessimistic lock on the savings account to prevent overdraft race conditions, debits the LKR 50,000 from the savings balance, writes a withdrawal ledger entry, snapshots the 14% interest rate into `interest_rate_at_opening`, and calculates the maturity date exactly 12 months ahead."*

#### 2. The Negative Test (Stun the Examiner!):
1. Immediately click **"Open fixed deposit"** again.
2. Select the **exact same account**, select any product, enter `10000.00`, and click Confirm.
3. *Show the error banner:* **"This account already has an active fixed deposit."**

#### 🗣️ What to say to the Examiner:
> *"Notice this rejection! This is NOT just a frontend check. It is enforced directly at the storage engine level by my **Partial Unique Index**:  
> `CREATE UNIQUE INDEX uq_one_active_fd_per_account ON fixed_deposit(account_id) WHERE status = 'ACTIVE'`.  
> An account can have unlimited past matured or closed FDs, but PostgreSQL mathematically blocks opening two active FDs simultaneously."*

---

### ⏱️ MINUTE 2 (01:10 – 02:15): The Central Interest Cycle & Idempotency
**Persona:** Admin / Central Operations (`admin` / `Password123!`)  
**Objective:** Execute the monthly interest batch, show fault tolerance, and prove cycle idempotency.

#### 1. Navigate to the Central Console:
1. Sign out from agent and sign in as `admin`.
2. On your **Dashboard**, look under **"Your workspaces"**:
   * Click **"Explore workspace ↗"** on the **"Interest cycle"** card *(the 2nd card on the top row)* — or navigate directly to [`/interest-runs`](http://localhost:3000/interest-runs).
3. Enter a Cycle Date: e.g., `2026-02-01`.
4. Click **"Preview distributions"**:
   * *Point to the confirmation card:* Shows how many FDs are due, how many savings payouts are calculated, and the estimated total credit in LKR.
5. Click **"Confirm and process"**:
   * The status updates to `COMPLETED`, displaying the total interest credited and `0 exceptions`.
   * Look at the **Interest run history table** below: the run record is permanently logged.

#### 🗣️ What to say to the Examiner:
> *"This is the Interest Cycle console powered by my routine `sp_run_interest_cycle`. It finds all active FDs where `next_interest_date <= cycle_date`.  
> Crucially, each payout runs in an isolated `BEGIN ... EXCEPTION` subtransaction block. If one account is frozen, that single exception is caught and logged, while all other customers are successfully credited without rolling back the batch.  
> Furthermore, while integrating with Member 4's ledger routine, I caught and fixed a critical concurrency bug where `now()` caused unique reference collisions across batch loops, replacing it with `clock_timestamp()`."*

#### 2. Demonstrate Idempotency in the UI:
1. Keep the date as `2026-02-01` and click **"Confirm and process"** again.
2. *Show the result:* The system returns the **existing cycle** without creating new payouts or debiting money!

#### 🗣️ What to say to the Examiner:
> *"Notice that re-running the cycle date did not double-credit any customer. The database enforces **cycle-level idempotency** via `UNIQUE(cycle_date)` on `interest_run` and **payout-level idempotency** via `UNIQUE(fd_id, cycle_date)` on `interest_payout`."*

---

### ⏱️ MINUTE 3 (02:15 – 03:00): Advanced SQL Reports (ROLLUP) & Product Catalog
**Persona:** Admin / Auditor (`admin` / `Password123!`)  
**Objective:** Showcase `GROUP BY ROLLUP` analytical queries, `string_agg` joint owner aggregation, and streaming CSV export.

#### 1. Monthly Interest Distribution Report (RPT-04):
1. In the top navigation bar, click **"Reports"** (or click **"Reports"** workspace card on the Dashboard).
2. Choose **"Monthly interest distribution"** ([`/reports/interest-distribution`](http://localhost:3000/reports/interest-distribution)).
3. *Point to the table:*
   * Point out the subtotals by branch, subtotals by FD product, subtotals by savings plan, and the grand total at the bottom.
4. Click the **"Export CSV"** button (downloads the CSV report instantly).

#### 🗣️ What to say to the Examiner:
> *"This is Report 4, powered by my database view `vw_rpt04_interest_distribution`.  
> To implement this, I used **`GROUP BY ROLLUP`**—an advanced OLAP technique from Lecture 13. Rather than doing multiple queries or looping in JavaScript, PostgreSQL computes the granular rows, the product subtotals, the savings plan subtotals, and the bank-wide grand total in a single database pass.  
> I also ran `EXPLAIN ANALYZE` on this report and created the index `ix_payout_cycle`, eliminating sequential scans and bringing response times under 1 millisecond."*

#### 2. Active Fixed Deposits Report (RPT-03) & Product Catalog (Quick Finish):
1. In Reports, switch to **"Active fixed deposits"** ([`/reports/active-fds`](http://localhost:3000/reports/active-fds)):
   * Point to the "Account" and "Estimated payout" columns:
     > *"In this view (`vw_rpt03_active_fds`), I used `string_agg()` to concatenate joint account holders into a clean string, and my immutable function `fn_calculate_fd_interest()` to compute exact next payouts."*
2. Return to the **Dashboard** and click **"Explore workspace ↗"** on the **"FD products"** card *(2nd card on the bottom row)* ([`/fd-products`](http://localhost:3000/fd-products)):
   * Show the 3 BR-13 products (6 Mo @ 13%, 1 Yr @ 14%, 3 Yr @ 15%) and the **Rate history** table showing effective dates (`effective_from`, `effective_to`).

---

## 🎯 Wrap-Up Closing Sentence:
> *"In summary, my contributions span the entire database-first lifecycle: from designing the seed framework that the whole team used, to building the atomic FD procedures with pessimistic locking, the fault-tolerant 30-day interest batch engine, and query optimization using partial indexes and `GROUP BY ROLLUP`."*

---
*Created for Rubasingha S.T. (Index: 240575P) — CS3043 Group 32 Viva Voce Examination.*
