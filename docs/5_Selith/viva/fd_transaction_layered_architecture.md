# 🏛️ Life of a Fixed Deposit Transaction: Layered Architecture Guide

**Project:** B-Trust Microbanking and Interest Management System (MIMS) — CS3043 Database Systems  
**Domain:** Fixed Deposit Lifecycle (`sp_open_fixed_deposit` / `sp_open_fd_controlled`)  
**Purpose:** Comprehensive Viva Preparation Guide for **Member 5 (Rubasingha S.T. · Index: 240575P)**  

---

## 📌 1. Architectural Overview & Philosophy

MIMS is built using a strict **Database-First, Defense-in-Depth** architecture across **6 distinct layers**. 

In our system:
1. **The Relational Database is the Supreme Source of Truth:** Business rules, financial balance checks, and referential integrity are enforced at the database layer where they cannot be bypassed.
2. **The Frontend Validates for Usability, Never for Safety:** The UI provides instant user feedback, but the server and database re-validate every single rule independently.
3. **Strict Layer Boundary Isolation:**
   - Client components never talk to the database.
   - API route handlers never execute raw SQL; they parse inputs, check permissions, and delegate to the **Service Layer**.
   - The Service Layer controls explicit transaction boundaries using `withTransaction()`.
   - The Database executes the financial mutations atomically inside stored routines using pessimistic row locking.

```
┌────────────────────────────────────────────────────────┐
│  Layer 1: Frontend Client UI (React / Next.js Client)   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS POST (JSON + CSRF + Idempotency-Key)
┌──────────────────────────▼─────────────────────────────┐
│  Layer 2: API Route Handler (Auth, RBAC, CSRF)          │
└──────────────────────────┬─────────────────────────────┘
                           │ Validated parameters & Authenticated User
┌──────────────────────────▼─────────────────────────────┐
│  Layer 3: Business Service Layer (Zod, Idempotency)    │
└──────────────────────────┬─────────────────────────────┘
                           │ withTransaction()
┌──────────────────────────▼─────────────────────────────┐
│  Layer 4: Data Access & Pool Layer (pg.Pool / Client)  │
└──────────────────────────┬─────────────────────────────┘
                           │ BEGIN ... SELECT sp_open_fd_controlled(...) ... COMMIT
┌──────────────────────────▼─────────────────────────────┐
│  Layer 5: Database Stored Routine (PL/pgSQL Engine)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Row Locks, INSERTs, UPDATEs
┌──────────────────────────▼─────────────────────────────┐
│  Layer 6: Relational Tables, Indexes & Constraints    │
└────────────────────────────────────────────────────────┘
```

---

## 📁 2. File and Directory Map

Here is the exact map of files and directories that participate in opening a Fixed Deposit:

| Layer | Directory / Path | Primary File | Role & Key Functions |
|---|---|---|---|
| **1. Frontend UI** | `app/fixed-deposits/new/` | `fd-opening.tsx` | Client component (`"use client"`), collects user input, calls `/quote`, generates `Idempotency-Key`, and triggers `confirm()` via `fetch`. |
| **1. UI Page Shell** | `app/fixed-deposits/new/` | `page.tsx` | Server Component page wrapper; calls `requirePageRole('AGENT','BRANCH_MANAGER','CENTRAL_OPS')`. |
| **2. API Route** | `app/api/fixed-deposits/` | `route.ts` | Route handler (`export async function POST`); runs `requireUser()`, `requireRole()`, `verifyCsrf()`, calls service. |
| **2. Auth & RBAC** | `lib/auth/` | `rbac.ts`, `csrf.ts` | Session token validation, role checking, anti-CSRF token verification. |
| **3. Service Layer** | `services/` | `fixed-deposit-service.ts` | Owns business orchestration: `openFixedDeposit()`, payload SHA-256 hashing, advisory locking, idempotency replay check. |
| **3. Validation** | `lib/validation/` | `fixed-deposit.ts` | Zod schemas (`fdOpeningSchema`, `fdKeySchema`) validating UUID formats and positive numeric money strings. |
| **4. Database Pool** | `lib/db/` | `pool.ts`, `transaction.ts`, `rls-context.ts` | Pooled connection manager (`pg.Pool`), `withTransaction()` wrapper, setting local session variables (`setRlsContext`). |
| **5. Stored Routine** | `database/routines/`<br>`database/migrations/` | `sp_open_fixed_deposit.sql`<br>`0635_p06_m02_fd_funding_link.sql` | PL/pgSQL stored procedure: `sp_open_fd_controlled` / `sp_open_fixed_deposit`. Acquires `FOR UPDATE` lock, checks balance, debits account, creates ledger entry, snapshots interest rate, inserts FD row, logs audit. |
| **6. Database Objects** | `database/migrations/` | `0480_p04_m05_fixed_deposit.sql`<br>`0180_p01_m05_fd_plan.sql` | Tables: `fixed_deposit`, `account`, `transaction`, `audit_log`, `fd_opening_request`. Index: `uq_one_active_fd_per_account`. |

---

## 🚀 3. Step-by-Step Message Travel: The Journey of an FD Request

Let's trace what happens when an **Agent** opens a **1-Year FD for LKR 100,000.00** from a customer's savings account.

---

### Step 1: User Action in Frontend Client Component (Layer 1)
* **File:** [`app/fixed-deposits/new/fd-opening.tsx`](file:///home/superselith/Code/database_project/mims-app/app/fixed-deposits/new/fd-opening.tsx)
* **Trigger:** The Agent selects the Savings Account, selects the "1 Year FD (14%)" product, enters `100000.00`, previews the quote, and clicks the **"Confirm and open"** button.
* **What Happens:**
  1. The client function `confirm()` executes.
  2. It generates a unique client-side idempotency UUID:
     ```typescript
     key.current = crypto.randomUUID(); // e.g. "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
     ```
  3. It extracts the CSRF token from the browser cookie via `csrfToken()`.
  4. It constructs an HTTP `POST` request payload:
     ```json
     {
       "accountId": "00000000-0000-0000-0801-000000000003",
       "fdPlanId": "00000000-0000-0000-0301-000000000002",
       "principalAmount": "100000.00"
     }
     ```
  5. It dispatches a `fetch()` request to `/api/fixed-deposits` with custom HTTP headers:
     * `Content-Type: application/json`
     * `x-csrf-token: <csrf_token_string>`
     * `idempotency-key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`

---

### Step 2: Ingress & Guard Rails in API Route Handler (Layer 2)
* **File:** [`app/api/fixed-deposits/route.ts`](file:///home/superselith/Code/database_project/mims-app/app/api/fixed-deposits/route.ts)
* **Function:** `export async function POST(request: NextRequest)`
* **What Happens:**
  1. **Authentication Check:**
     ```typescript
     const user = await requireUser(request);
     ```
     Inspects the encrypted session cookie (`mims_session`). If the cookie is missing, expired, or tampered with, it immediately throws `AuthenticationError` $\rightarrow$ returns HTTP `401 Unauthorized`.
  2. **RBAC Authorization Check:**
     ```typescript
     requireRole(user, 'AGENT', 'BRANCH_MANAGER', 'CENTRAL_OPS');
     ```
     Checks the user's role. If a `CUSTOMER` or `AUDITOR` attempts to call this endpoint, it throws `NotAuthorizedError` $\rightarrow$ returns HTTP `403 Forbidden`.
  3. **CSRF Protection:**
     ```typescript
     verifyCsrf(request);
     ```
     Validates the `x-csrf-token` header against the encrypted session secret to protect against Cross-Site Request Forgery attacks.
  4. **Delegation to Service Layer:**
     Calls `openFixedDeposit(body, user, idempotencyKey)` and awaits the result.

---

### Step 3: Business Logic & Idempotency in Service Layer (Layer 3)
* **File:** [`services/fixed-deposit-service.ts`](file:///home/superselith/Code/database_project/mims-app/services/fixed-deposit-service.ts)
* **Function:** `export async function openFixedDeposit(input, user, key)`
* **What Happens:**
  1. **Zod Schema Parsing:**
     ```typescript
     const value = fdOpeningSchema.parse(input);
     const idempotencyKey = fdKeySchema.parse(key);
     ```
     Guarantees that `accountId` and `fdPlanId` are strictly valid UUID strings and `principalAmount` is a valid positive money string with 2 decimal places.
  2. **Payload Hash Computation:**
     Computes a SHA-256 fingerprint of the request body:
     ```typescript
     const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
     ```
  3. **Transaction Initiation:**
     Calls `withTransaction(async tx => { ... })` from `lib/db`. This initiates an atomic database transaction.

---

### Step 4: Database Connection & Transaction Wrapper (Layer 4)
* **File:** [`lib/db/transaction.ts`](file:///home/superselith/Code/database_project/mims-app/lib/db/transaction.ts) & [`lib/db/pool.ts`](file:///home/superselith/Code/database_project/mims-app/lib/db/pool.ts)
* **What Happens:**
  1. `withTransaction` leases an active PostgreSQL client connection from the `pg.Pool`.
  2. Issues `BEGIN;` to the PostgreSQL server.
  3. Passes the transactional client `tx` into the callback.
  4. Calls `setRlsContext(tx, user)` which runs:
     ```sql
     SET LOCAL app.current_user_id = '...';
     SET LOCAL app.current_user_role = 'AGENT';
     SET LOCAL app.current_branch_id = '...';
     ```
     *(This ensures Row Level Security policies are active for this transaction).*

---

### Step 5: Service Pre-Checks & Locking (Layer 3 $\rightarrow$ Database)
* **Inside `fixed-deposit-service.ts`:**
  1. **PostgreSQL Advisory Lock (Distributed Concurrency Guard):**
     ```sql
     SELECT pg_advisory_xact_lock(hashtextextended($1, 0)); -- Key: "userId:idempotencyKey"
     ```
     If the user double-clicks the submit button, two HTTP requests arrive in parallel. This advisory lock forces the second request to pause and wait until the first request completes, preventing race conditions!
  2. **Idempotency Table Check:**
     Queries `fd_opening_request`:
     * If the key was **already processed with the same payload hash**, it skips opening a new FD and safely replays the previously opened FD record!
     * If the key was previously used with a **different payload**, it throws `BusinessRuleError('IDEMPOTENCY_CONFLICT')` $\rightarrow$ HTTP `409 Conflict`.
  3. **Pessimistic Row Locking on the Account:**
     ```sql
     SELECT account_id FROM account WHERE account_id = $1 FOR UPDATE;
     ```
     Acquires an exclusive lock on the savings account row. Any other concurrent transaction (like an ATM withdrawal) trying to access this account must wait.
  4. **Pre-flight Checks:**
     * Verifies `principalAmount >= system_parameter('MIN_FD_PRINCIPAL')`.
     * Verifies the FD plan is active: `SELECT ... FROM fd_plan WHERE status = 'ACTIVE' FOR SHARE`.
     * Verifies the counter channel exists: `SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'`.

---

### Step 6: Core Financial Execution inside Stored Routine (Layer 5)
* **File:** [`database/routines/sp_open_fixed_deposit.sql`](file:///home/superselith/Code/database_project/mims-app/database/routines/sp_open_fixed_deposit.sql) & migration [`0635_p06_m02_fd_funding_link.sql`](file:///home/superselith/Code/database_project/mims-app/database/migrations/0635_p06_m02_fd_funding_link.sql)
* **Routine:** `sp_open_fd_controlled(account_id, fd_plan_id, amount, user_id, channel_id)`
* **What Happens Inside PostgreSQL Engine:**
  
  ```
  [ PostgreSQL Stored Routine Execution Flow ]
  
  1. Validate Account Status ──► fn_check_account_fd_eligible(account_id)
                                    └── Must be 'ACTIVE' (BR-11)
  
  2. Validate Funds ───────────► Check: current_balance >= amount
                                    └── Prevents overdraft
  
  3. Compute Dates ────────────► maturity_date = start_date + tenure_months
                                 next_interest_date = start_date + 30 days
  
  4. Debit Savings Account ────► UPDATE account
                                    SET current_balance = current_balance - amount
  
  5. Post Financial Ledger ────► INSERT INTO transaction (
                                    transaction_type = 'WITHDRAWAL',
                                    amount = amount,
                                    balance_after = new_balance,
                                    narration = 'FD Opening Principal Debit'
                                 )
  
  6. Rate Snapshotting ────────► INSERT INTO fixed_deposit (
                                    interest_rate_at_opening = fd_plan.interest_rate,
                                    status = 'ACTIVE'
                                 )
                                    └── Monitored by Partial Unique Index
  
  7. Audit Trail ──────────────► INSERT INTO audit_log (action = 'FD_OPENED')
  
  8. Return FD ID ─────────────► RETURNING fd_id INTO v_fd_id
  ```

---

### Step 7: Declarative Constraint Checks & Disk Commit (Layer 6)
* **Database Engine Verification:**
  * When the `INSERT INTO fixed_deposit` executes, the database engine checks the **Partial Unique Index**:
    ```sql
    CREATE UNIQUE INDEX uq_one_active_fd_per_account 
    ON fixed_deposit(account_id) WHERE status = 'ACTIVE';
    ```
    If another active FD already exists on this account, the insert is immediately aborted with PostgreSQL error code **`23505`** (Unique Violation).
  * The Service records the transaction token in `fd_opening_request`:
    ```sql
    INSERT INTO fd_opening_request (actor_user_id, idempotency_key, payload_hash, fd_id)
    VALUES ($1, $2, $3, $4);
    ```
  * `withTransaction` issues `COMMIT;`.
  * PostgreSQL writes changes to the WAL (Write-Ahead Log) and releases all row and advisory locks. The money is debited, the contract exists, and the ledger is permanent.

---

### Step 8: Response Bubble-Up Back to the User
1. **Layer 4 $\rightarrow$ Layer 3:** `withTransaction` completes cleanly. The service queries the newly created row joined with `fd_plan` and returns `{ data: row, replayed: false }`.
2. **Layer 3 $\rightarrow$ Layer 2:** The route handler receives `{ data: row }` and constructs an HTTP `201 Created` JSON response:
   ```json
   {
     "data": {
       "fdId": "e2c34a12-8f90-41ab-8201-998877665544",
       "accountNumber": "1001-000003",
       "productName": "1 Year FD",
       "principalAmount": "100000.00",
       "rate": "0.1400",
       "startDate": "2026-10-12",
       "maturityDate": "2027-10-12",
       "nextInterestDate": "2026-11-11",
       "status": "ACTIVE"
     }
   }
   ```
3. **Layer 2 $\rightarrow$ Layer 1:** Next.js sends the HTTP response across the network.
4. **Layer 1 Client Component:**
   * In `fd-opening.tsx`, `await accountRequest(...)` resolves.
   * `setResult(response.data)` updates React state.
   * The form disappears and displays the **Success Card**:
     > **Fixed deposit opened**  
     > `1001-000003 · LKR 100,000.00 · 14.00%`  
     > `Matures 2027-10-12 · next payout 2026-11-11`  
     > [View fixed deposits button]

---

## ⚡ 4. Sequence Diagram: Complete Message Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Bank Agent
    participant UI as Layer 1: Client Component (fd-opening.tsx)
    participant Route as Layer 2: API Route (/api/fixed-deposits)
    participant Service as Layer 3: Service (fixed-deposit-service.ts)
    participant Pool as Layer 4: DB Pool (withTransaction)
    participant DB as Layer 5: PostgreSQL Engine (sp_open_fd_controlled)
    participant Tables as Layer 6: Relational Tables & Constraints

    Agent->>UI: Selects Account, 1-Yr FD, LKR 100,000 & clicks Confirm
    UI->>UI: Generates Idempotency-Key & reads CSRF Token
    UI->>Route: POST /api/fixed-deposits (Headers: CSRF, Idempotency-Key)
    
    rect rgb(240, 248, 255)
        Note over Route: Authentication & Authorization (RBAC)
        Route->>Route: requireUser() [Validates Session Cookie]
        Route->>Route: requireRole('AGENT', 'BRANCH_MANAGER', 'CENTRAL_OPS')
        Route->>Route: verifyCsrf()
    end

    Route->>Service: openFixedDeposit(payload, user, idempotencyKey)
    Service->>Service: fdOpeningSchema.parse() [Zod Validation]
    Service->>Service: SHA-256 Hash of Payload

    Service->>Pool: withTransaction(async tx => ...)
    Pool->>DB: BEGIN;
    Pool->>DB: SET LOCAL app.current_user_id, app.current_user_role (RLS)

    rect rgb(255, 250, 240)
        Note over Service, DB: Advisory Lock & Concurrency Control
        Service->>DB: SELECT pg_advisory_xact_lock('user:key')
        Service->>DB: SELECT fd_id FROM fd_opening_request (Idempotency Replay Check)
        Service->>DB: SELECT account_id FROM account FOR UPDATE (Row Lock)
        Service->>DB: Verify MIN_FD_PRINCIPAL & Active fd_plan
    end

    rect rgb(245, 255, 245)
        Note over DB, Tables: Atomic Database Routine Execution
        Service->>DB: SELECT sp_open_fd_controlled(...)
        DB->>Tables: UPDATE account SET current_balance = current_balance - 100000
        DB->>Tables: INSERT INTO transaction (WITHDRAWAL, balance_after)
        DB->>Tables: INSERT INTO fixed_deposit (rate_snapshot = 0.1400, ACTIVE)
        Tables-->>DB: uq_one_active_fd_per_account (Check: No other active FD)
        DB->>Tables: INSERT INTO audit_log (action = 'FD_OPENED')
        DB-->>Service: Returns new fd_id
    end

    Service->>Tables: INSERT INTO fd_opening_request (key, hash, fd_id)
    Service->>Tables: SELECT details FROM fixed_deposit JOIN account JOIN fd_plan
    Pool->>DB: COMMIT; (WAL written, Locks released)
    Pool-->>Service: Transaction complete

    Service-->>Route: { data: row, replayed: false }
    Route-->>UI: HTTP 201 Created (JSON Response)
    UI-->>Agent: Renders "Fixed deposit opened" Success Screen
```

---

## 💥 5. What Happens if Something Fails Midway? (Rollback Mechanics)

One of the most critical questions in a database viva is: **"What happens if a failure occurs halfway through?"**

Here is how the architecture handles failures at different points:

| Point of Failure | Scenario | What Happens | Resulting System State |
|---|---|---|---|
| **Layer 2 (API)** | Non-logged-in user or invalid CSRF token | Request is rejected before touching the service or database pool. | Zero database connections opened. HTTP `401` or `403` returned. |
| **Layer 3 (Validation)** | Negative principal amount or malformed UUID | Zod parser throws `ZodError` during schema parse. | Transaction never starts. HTTP `400 Bad Request` returned. |
| **Layer 5 (Pre-check)** | Savings account balance is only LKR 20,000 (Insufficient funds) | `sp_open_fd_controlled` detects `current_balance < amount`, throws exception `FD_OPENING_REJECTED`. | `withTransaction` catches the exception and issues `ROLLBACK;`. **No money deducted, no FD created.** |
| **Layer 6 (Constraint)** | Account already has an active fixed deposit | `INSERT INTO fixed_deposit` violates partial unique index `uq_one_active_fd_per_account`. PostgreSQL throws error code `23505`. | Instant database rollback. Service catches `23505` and returns HTTP `409 Conflict: ACTIVE_FD_EXISTS`. |
| **Network Failure** | Client sends the request, DB commits, but internet drops before client receives HTTP 201 | Client reconnects and retries with the **same `Idempotency-Key`**. | Layer 3 advisory lock acquires; `fd_opening_request` finds existing record; **replays previous FD details without debiting money a 2nd time!** |

---

## 🎯 6. How to Explain This in Your Viva (2-Minute Script)

If the examiner asks:  
*"Pick a transaction from your domain and explain the layers it travels through from the frontend to the database."*

### Deliver this crisp answer:
> *"I'll walk through opening a Fixed Deposit via `sp_open_fixed_deposit`.
> 
> 1. **At the Frontend Client Layer (`app/fixed-deposits/new/fd-opening.tsx`)**, the agent enters the account, product, and amount. When they click submit, the client generates a unique `idempotency-key` and sends an HTTP POST request with CSRF headers to `/api/fixed-deposits`.
> 2. **At the API Route Layer (`app/api/fixed-deposits/route.ts`)**, we enforce server-side security. The route verifies the session cookie with `requireUser()`, checks permissions with `requireRole('AGENT', 'BRANCH_MANAGER', 'CENTRAL_OPS')`, and verifies the CSRF token before passing the payload to the service.
> 3. **At the Service Layer (`services/fixed-deposit-service.ts`)**, inputs are strictly validated using Zod schemas, and a SHA-256 hash of the payload is computed. The service initiates a transaction boundary via `withTransaction()` and sets PostgreSQL session variables for Row Level Security.
> 4. **At the Concurrency Layer**, the service uses `pg_advisory_xact_lock` to serialize duplicate requests on the same key, checks `fd_opening_request` for key replays, and locks the savings account record using `SELECT ... FOR UPDATE` to prevent race conditions or overdrafts.
> 5. **At the Stored Routine Layer (`database/routines/sp_open_fixed_deposit.sql`)**, PostgreSQL executes the business logic atomically inside PL/pgSQL: it checks account eligibility, debits the savings balance, writes a `WITHDRAWAL` record into the ledger, snapshots the current interest rate, and creates the `fixed_deposit` row.
> 6. **At the Relational Integrity Layer**, our **partial unique index** (`WHERE status = 'ACTIVE'`) enforces that an account can never hold two active FDs simultaneously. If any constraint fails, the entire transaction rolls back completely.
> 7. Once committed, the service records the idempotency key and returns a 201 Created response, and the React UI displays the confirmation card with maturity and payout dates."*

---
*Created for Member 5 (Rubasingha S.T. · Index: 240575P) — CS3043 Database Systems Project Defense.*
