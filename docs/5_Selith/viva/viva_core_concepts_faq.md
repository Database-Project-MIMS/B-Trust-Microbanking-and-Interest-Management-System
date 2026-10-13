# 💡 Viva Quick Reference: Core Concepts Explained Simply

**Document:** Essential Technical Concepts for Viva Voce  
**Member:** Rubasingha S.T. · Index: 240575P · Group 32  
**Target:** Super brief, plain-English answers with concrete banking examples.

---

## 1. What is Idempotency?

**In One Sentence:**  
An operation is **idempotent** if running it multiple times produces the **exact same result** as running it once, without causing extra side effects.

* **Real-World Analogy:**  
  * **Elevator Button:** Whether you press the "5th Floor" button once or 10 times, the elevator only takes you to the 5th floor once (**Idempotent**).
  * **ATM Withdrawal:** Pressing "Withdraw LKR 5,000" three times and dispensing LKR 15,000 (**NOT Idempotent**).
* **In Our Project:**  
  * **Interest Run:** If the monthly batch job runs twice for `2026-02-01`, `UNIQUE(cycle_date)` blocks the second run. Customers are **never paid double interest**.
  * **Database Seed:** Seeding the database 1 time or 100 times produces identical row counts and identical financial totals (`ON CONFLICT DO NOTHING`).

---

## 2. What are RBAC Checks? (Role-Based Access Control)

*(Note: "BRAC" is a common typo for **RBAC**).*

**In One Sentence:**  
RBAC is a security mechanism that restricts system features based on a user's **job role** rather than configuring permissions per individual person.

* **In Our Project:**  
  * We have 7 roles: `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER`, `AGENT`, `CUSTOMER`, `AUDITOR`, `SYSTEM`.
  * In code: `requireRole(user, 'ADMIN')`.
  * Example: An Agent can register customers, but if an Agent calls the API to change FD interest rates, the server blocks them with **HTTP 403 Forbidden**.
* **Viva Golden Rule:**  
  *"Hiding a button in the UI is NOT security. RBAC is verified on the server for every single API request."*

---

## 3. What is CSRF and What Does It Do?

**What it stands for:** **C**ross-**S**ite **R**equest **F**orgery.

* **The Attack Scenario:**  
  1. You are logged into B-Trust Bank in Browser Tab 1. Your browser holds an active login cookie.
  2. You open Tab 2 and accidentally click a malicious phishing link.
  3. The evil website secretly executes a hidden JavaScript request: `POST https://b-trust.com/api/transactions/transfer` to send money to the attacker.
  4. The browser automatically attaches your bank cookie $\rightarrow$ the bank thinks YOU made the request!
* **How We Stop It (CSRF Protection):**  
  * The bank gives the frontend a secret cryptographic token: `x-csrf-token`.
  * Every state-changing request (`POST`, `PATCH`, `DELETE`) **must send this token in the header**.
  * The malicious external website cannot read or forge this token. When the server checks the request, the token is missing/invalid $\rightarrow$ **Request Blocked (HTTP 403)**.

---

## 4. What the heck is a Zod Schema? (Not General Zod!)

**In One Sentence:**  
**Zod** is a TypeScript data validation library that acts as a strict "bouncer" at the API door.

* **Why We Need It:**  
  * TypeScript types only exist while writing code; they **vanish at runtime** when the app is running in JavaScript.
  * When a user sends JSON to an API route, JavaScript has no idea if `principalAmount` is a valid number, negative, or malicious text.
* **How It Works in MIMS:**  
  ```typescript
  const fdOpeningSchema = z.object({
    accountId: z.string().uuid(),
    fdPlanId: z.string().uuid(),
    principalAmount: z.string().regex(/^[0-9]+(\.[0-9]{2})?$/)
  });
  ```
  * `fdOpeningSchema.parse(input)` validates the data instantly.
  * If someone sends `principalAmount: "-500"` or `accountId: "hacked"`, Zod throws an error and rejects the request with **HTTP 400 Bad Request** before it ever reaches the database!

---

## 5. Why do we need SHA-256 Hashing? What is it used for?

**In One Sentence:**  
SHA-256 is a one-way mathematical function that converts any text into a fixed 64-character unique fingerprint (hash).

* **Where We Use It:**  
  In the Service Layer (`fixed-deposit-service.ts`) inside the `fd_opening_request` idempotency table.
* **Why We Hash the Request Payload:**  
  **To detect payload tampering or conflict!**
  1. Suppose an Agent submits an FD opening with `idempotency-key = "KEY-123"` for **LKR 100,000**. We save `KEY-123` with the SHA-256 hash of that payload.
  2. If network lag causes the Agent's browser to retry `KEY-123` with the **exact same payload** $\rightarrow$ Hash matches $\rightarrow$ Safely return the previous receipt (**Safe Replay**).
  3. But if a malicious script tries to reuse `KEY-123` to open an FD for **LKR 500,000** $\rightarrow$ Hash mismatch! The server detects that the payload was altered and throws **`IDEMPOTENCY_CONFLICT` (HTTP 409)**.

---

## 6. Is the Idempotency Key from a 3rd party? Is it a frontend-only thing?

* **Do we use a third party?**  
  **No.** We use standard native Web APIs: `crypto.randomUUID()` in the browser and Node.js. It generates a standard 128-bit UUID v4.
* **Is it a frontend-only thing?**  
  **NO — it is a full Client-Server Contract:**
  1. **Frontend Role:** Generates the unique key when the user clicks the button and sends it in the `Idempotency-Key` HTTP header.
  2. **Backend Role:** 
     - Locks the key using PostgreSQL advisory locks (`pg_advisory_xact_lock`).
     - Stores the key and its outcome in the database (`fd_opening_request`).
     - If the network drops and the frontend retries with the same key, the backend catches it, sees it already succeeded, and returns the existing result without debiting the customer's account again.

---

## 7. What is RLS (Row Level Security)? Is it a PostgreSQL special feature?

**In One Sentence:**  
**Row Level Security (RLS)** is a native enterprise feature of PostgreSQL that restricts which rows in a table a user can see or modify based on who is querying the database.

* **How It Differs from Normal Table Permissions:**  
  * Normal database permissions (`GRANT SELECT ON account TO mims_app`) are **all-or-nothing**: if you can read the table, you can read every row in the bank.
  * **With RLS:** PostgreSQL evaluates a security policy on **every single row** during query execution.
* **In Our Project (Multi-Branch Isolation):**  
  ```sql
  ALTER TABLE account ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY account_branch_isolation ON account
    USING (branch_id = current_setting('app.current_branch_id')::uuid);
  ```
  * When a Branch Manager in Kandy queries `SELECT * FROM account`, PostgreSQL's storage engine **physically hides** Colombo and Galle accounts!
  * Even if an application developer makes a mistake and forgets to add `WHERE branch_id = ...` in Node.js, **PostgreSQL guarantees cross-branch data leaks are impossible**.

---

## 8. What are Indexes and how did I use them for efficiency?

**In One Sentence:**  
An **Index** is a sorted B-Tree lookup structure on disk that allows PostgreSQL to jump directly to specific records in $O(\log N)$ time instead of reading the entire table page-by-page (Sequential Scan in $O(N)$ time).

* **Real-World Analogy:**  
  Looking up a word in the alphabetical index at the back of a 1,000-page book rather than reading all 1,000 pages from start to finish.
* **Where YOU Used Indexes in MIMS:**  
  1. **Partial Unique Index (`uq_one_active_fd_per_account`):**  
     `CREATE UNIQUE INDEX ... ON fixed_deposit(account_id) WHERE status = 'ACTIVE';`  
     * Only indexes active rows. Saves disk space and enforces business rule BR-12 (only one active FD per account).
  2. **Interest Due Index (`ix_fd_due_interest`):**  
     `CREATE INDEX ... ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';`  
     * When the 30-day interest batch runs, PostgreSQL skips thousands of inactive or future FDs and instantly grabs only the FDs due today.
  3. **Reporting Optimization Index (`ix_payout_cycle` in Migration 0580):**  
     `CREATE INDEX ix_payout_cycle ON interest_payout(cycle_date);`  
     * Report 4 groups payouts by cycle date. Adding this index eliminated full sequential table scans and dropped execution time to under 0.5 milliseconds!

---

## 9. What the heck is PL/pgSQL?

**In One Sentence:**  
**PL/pgSQL** stands for **Procedural Language / PostgreSQL** — it is a full programming language that runs directly *inside* the PostgreSQL database engine.

* **Why Bare SQL Isn't Enough:**  
  * Standard SQL is **declarative** — you can say `SELECT * FROM account`, but you cannot write `if/else` conditions, loops, or catch errors.
* **What PL/pgSQL Adds:**  
  * Variables (`DECLARE v_balance numeric;`)
  * Conditional logic (`IF v_balance < amount THEN RAISE EXCEPTION ...`)
  * Cursor Loops (`FOR v_fd IN SELECT ... LOOP`)
  * Exception Handling (`BEGIN ... EXCEPTION WHEN OTHERS THEN ... END`)
* **In Our Project:**  
  * Your interest cycle engine `sp_run_interest_cycle.sql` is written in PL/pgSQL. It loops through due accounts and traps errors per customer. Running it inside the database avoids 100 separate round-trips over the network between Node.js and PostgreSQL!

---

## 10. What is `EXPLAIN ANALYZE` and how did I use it to prove my indexes work?

**In One Sentence:**  
`EXPLAIN ANALYZE` is PostgreSQL's built-in query profiler and performance X-ray machine.

* **How It Works:**  
  When you run `EXPLAIN ANALYZE SELECT ...`, PostgreSQL executes the query and prints the exact execution plan tree, showing:
  * Whether it used a slow `Seq Scan` (reading every page on disk) or a fast `Index Scan` / `Bitmap Index Scan`.
  * The exact cost, memory buffers hit (`shared hit`), and execution time in milliseconds.
* **In Our Project (Phase 5 Task 4):**  
  * You ran `EXPLAIN ANALYZE` on all 5 management report queries.
  * You spotted a Sequential Scan on the `interest_payout` table in Report 4.
  * You wrote migration `0580_p05_m05_performance_indexes.sql` creating `ix_payout_cycle`.
  * You re-ran `EXPLAIN ANALYZE` and documented the before-and-after proof in `database/indexes/explain-analyze-evidence.md`, demonstrating that queries complete in **under 1 millisecond** (fulfilling NFR-PERF-03).

---
*Prepared for Rubasingha S.T. (Index: 240575P) — CS3043 Database Systems Project Viva Defense.*
