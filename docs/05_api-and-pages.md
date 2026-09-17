# 05 — API and Pages

Endpoint contracts and the page-to-API map.

**Conventions** (AGENTS.md §9): success `{ data }`, failure `{ error: { code, message } }`.
Every route authenticates and authorizes **on the server**. Money-moving `POST` endpoints
require an `Idempotency-Key` header. All state-changing routes are CSRF-protected. Roles:
`ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER`, `AGENT`, `AUDITOR`, `CUSTOMER`.

**Standard errors** on every route: `401` unauthenticated · `403` role or branch scope
denied · `400` validation · `500` unexpected (safe message only). Only route-specific
errors are listed below.

---

## Authentication — Member 1

### `POST /api/auth/login`
- **Purpose** Authenticate and create a server-side session (FR-AUTH-01).
- **Roles** public
- **Body** `{ username, password }`
- **Validation** both present; username ≤ 100 chars
- **SQL** `SELECT user_id, password_hash, status, role_id FROM app_user WHERE username = $1`; on success `INSERT INTO user_session`; always `INSERT INTO login_attempt`
- **Transaction** single transaction: session insert + attempt log + `last_login` update
- **Success** `200 { data: { user: { id, username, role, branchId } } }` + `Secure`/`HttpOnly`/`SameSite=Lax` cookie
- **Errors** `401 INVALID_CREDENTIALS` — **identical message whether or not the username exists** (FR-AUTH-03); `429 TOO_MANY_ATTEMPTS`
- **Page** `/sign-in`

### `POST /api/auth/logout`
- **Roles** any authenticated · **SQL** `UPDATE user_session SET revoked_at = now() WHERE session_id = $1` · **Success** `204`
- Server-side invalidation, not just cookie clearing (FR-AUTH-04).

---

## Organisation — Member 2

| Method & path | Purpose | Roles | Notes |
|---|---|---|---|
| `GET /api/branches` | List branches | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | Branch managers see only their own branch |
| `POST /api/branches` | Create branch | ADMIN | `409 DUPLICATE_BRANCH_CODE` on `23505` |
| `PATCH /api/branches/{id}` | Update / deactivate | ADMIN | Never deletes (FR-ORG-05) |
| `GET /api/agents` | List agents | ADMIN, CENTRAL_OPS, BRANCH_MANAGER | Scoped by branch |
| `POST /api/agents` | Create agent + linked user | ADMIN, BRANCH_MANAGER | **One transaction**: `app_user` + `agent` + audit |
| `PATCH /api/agents/{id}` | Update / deactivate / transfer branch | ADMIN, BRANCH_MANAGER | Transfer is effective-dated so history stays attributable (FR-ORG-04) |

### `POST /api/customers`
- **Purpose** Register a customer (FR-CUS-01…05).
- **Roles** AGENT, BRANCH_MANAGER
- **Body** `{ fullName, nicPassportNo, dateOfBirth, gender, phone, address, email, branchId, agentId, documents[] }`
- **Validation** NIC/passport format; `dateOfBirth` in the past; email format; `branchId` within the caller's scope
- **SQL / routine** one transaction: `INSERT customer` → `INSERT customer_document` (each) → `INSERT customer_agent (is_active = true)` → `INSERT audit_log`
- **Transaction** all four, atomic (§4.3: "Customer, documents, assignment and audit event are inserted in one database transaction")
- **Success** `201 { data: { customerId, customerNumber } }`
- **Errors** `409 DUPLICATE_IDENTITY` (unique `nic_passport_no`), `409 DUPLICATE_EMAIL`
- **Page** `/customers/new`

| `GET /api/customers` | Search by name, NIC, branch, agent | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | Trigram index on `full_name`; identity masked for unauthorised roles (FR-CUS-04); sort column via `allowListed()` |
| `GET /api/customers/{id}` | Profile with accounts and assignment history | as above; CUSTOMER for self only | RLS enforces self-access |

---

## Plans and accounts — Member 3

| Method & path | Purpose | Roles |
|---|---|---|
| `GET /api/plans` | Savings plans with rates, minimums, eligibility | any authenticated |
| `PATCH /api/plans/{id}` | Update plan (effective-dated) | ADMIN, CENTRAL_OPS |
| `GET /api/fd-products` | FD products (M5) | any authenticated |

### `POST /api/accounts`
- **Purpose** Open an individual or joint savings account (FR-ACC-01…04).
- **Roles** AGENT, BRANCH_MANAGER
- **Body** `{ planId, branchId, holders: [{ customerId, holderType }], mandate?: { type, requiredSignatories }, initialDeposit? }`
- **Validation** plan active; 1 holder for individual, 2–4 for joint; every holder's age satisfies the plan; joint requires a mandate; `initialDeposit ≥ plan.min_balance`
- **SQL routine** `CALL sp_open_savings_account(...)`
- **Transaction** account + holders + mandate + optional initial deposit ledger row + balance + audit — **all atomic**
- **Success** `201 { data: { accountId, accountNumber, currentBalance } }`
- **Errors** `409 PLAN_ELIGIBILITY_FAILED` · `409 BELOW_MINIMUM_BALANCE` · `409 INVALID_HOLDER_COUNT` · `409 MANDATE_REQUIRED`
- **Page** `/accounts/new`

| `GET /api/accounts` | List / search, scoped | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR |
| `GET /api/accounts/{id}` | Detail: plan, holders, mandate, balance, FD | as above; CUSTOMER if a holder |
| `POST /api/accounts/{id}/holders` | Add a joint holder and mandate | BRANCH_MANAGER |
| `POST /api/accounts/{id}/close` | Close — requires zero balance and no active FD (BR-18) | BRANCH_MANAGER |

---

## Transactions — Member 4

### `POST /api/transactions/deposits`
- **Purpose** Post a deposit and return an immutable reference and updated balance.
- **Roles** AGENT, BRANCH_MANAGER
- **Headers** `Idempotency-Key` (**required**)
- **Body** `{ accountId, amount, channelId, narration? }`
- **Validation** `amount > 0`, exactly 2 decimals; account active; within business hours
- **SQL routine** `CALL sp_post_deposit($1..$n)` — locks the account, inserts the ledger row, updates the balance and `balance_after`, writes audit
- **Transaction** one; rollback leaves no partial effect (FR-DEP-05)
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter, postedAt } }`
- **Errors** `409 ACCOUNT_NOT_ACTIVE` · `409 OUTSIDE_BUSINESS_HOURS` · **repeated `Idempotency-Key` → `200` with the original result, no second credit** (FR-DEP-04)
- **Page** `/transactions/deposit`

### `POST /api/transactions/withdrawals`
- **Purpose** Post a validated withdrawal (FR-WD-01…05).
- **Roles** AGENT, BRANCH_MANAGER; CUSTOMER if an authorised holder
- **Headers** `Idempotency-Key` (**required**)
- **Body** `{ accountId, amount, channelId, onBehalfOfCustomerId?, narration? }`
- **Validation** requester is an authorised holder; account active; business hours; single and daily limits
- **SQL routine** `CALL sp_post_withdrawal(...)` — `FOR UPDATE`, then re-validate status, mandate, limits and post-withdrawal minimum **inside** the transaction
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter } }`
- **Errors** `409 INSUFFICIENT_FUNDS` · `409 BELOW_MINIMUM_BALANCE` · `409 MANDATE_NOT_SATISFIED` · `409 LIMIT_EXCEEDED` · `409 ACCOUNT_NOT_ACTIVE`
- **Note** A rejection writes an audit event and **no ledger row** (FR-WD-05).
- **Page** `/transactions/withdraw`

### `POST /api/transactions/{id}/reverse`
- **Roles** **BRANCH_MANAGER only** (§4.8) · **Body** `{ reason }` (required)
- **Routine** `CALL sp_reverse_transaction(...)` — inserts a compensating entry, links it, updates the balance. The original row is never modified.
- **Errors** `409 ALREADY_REVERSED` (unique violation on `transaction_reversal.original_transaction_id`) · `403` for non-managers
- **Page** `/transactions/{id}`

| `GET /api/accounts/{id}/transactions` | Statement with running balance (FR-TXN-04) | AGENT, BRANCH_MANAGER, AUDITOR, CUSTOMER (own) | Paginated; index `(account_id, transaction_date DESC)` |
| `GET /api/transactions/{id}` | Single transaction + reversal link | as above | |

---

## Fixed deposits and interest — Member 5

### `GET /api/fd-products`
- **Purpose** List all active FD product plans (BR-13).
- **Roles** any authenticated
- **SQL** `SELECT fd_plan_id, plan_name, tenure_months, interest_rate, description, status, effective_from, effective_to FROM fd_plan WHERE effective_to IS NULL ORDER BY tenure_months ASC`
- **Success** `200 { data: [{ fdPlanId, planName, tenureMonths, interestRate, description, status, effectiveFrom, effectiveTo }] }`
- **Notes** Rates are returned as string fractions (e.g. `"0.1300"` = 13%). Only currently-effective plans (`effective_to IS NULL`) are returned.
- **Page** `/fd-products`

### `PATCH /api/fd-products/{id}`
- **Purpose** Update an FD product's rate, status, or description (SCD2 effective-dating for rate changes).
- **Roles** ADMIN only · CSRF-protected
- **Body** `{ interestRate?, status?, description? }`
- **Validation** `interestRate` must be a fraction `> 0` and `≤ 1`; `status` must be `ACTIVE` or `INACTIVE`
- **SQL routine** When `interestRate` changes: sets `effective_to = CURRENT_DATE` on the old row, inserts a new row with the updated rate and `effective_from = CURRENT_DATE` (SCD2). Status/description changes update in-place.
- **Transaction** one; service owns the boundary via `withTransaction()`
- **Success** `200 { data: { fdPlanId, planName, tenureMonths, interestRate, … } }`
- **Errors** `400 BAD_REQUEST` (invalid rate or status) · `403 FORBIDDEN` (non-ADMIN or missing CSRF) · `404 NOT_FOUND`
- **Page** `/fd-products`

### `POST /api/fixed-deposits`
- **Roles** AGENT, BRANCH_MANAGER, CENTRAL_OPS
- **Body** `{ accountId, fdPlanId, principalAmount }`
- **Validation** account active; **no existing active FD**; balance covers the principal; principal ≥ configured minimum
- **Routine** `CALL sp_open_fixed_deposit(...)` — locks the account, debits the principal through the ledger, creates the FD with `maturity_date` and `interest_rate_at_opening`
- **Success** `201 { data: { fdId, principal, startDate, maturityDate, nextInterestDate, rate } }`
- **Errors** `409 ACTIVE_FD_EXISTS` (partial unique index) · `409 INSUFFICIENT_FUNDS` · `409 ACCOUNT_NOT_ACTIVE`
- **Page** `/fixed-deposits/new`

### `POST /api/interest-runs`
- **Purpose** Execute a controlled 30-day interest cycle (FR-INT-01…05).
- **Roles** CENTRAL_OPS, ADMIN, or the scheduled worker presenting `INTEREST_WORKER_TOKEN`
- **Body** `{ cycleDate, dryRun?: boolean }`
- **Routine** `CALL sp_run_interest_cycle(...)` — creates the run (`UNIQUE(cycle_date)`), selects due FDs with locking, and processes **each FD in its own transaction**
- **Transaction** one per distribution; a failure increments `exception_count` without rolling back completed FDs (FR-INT-04)
- **Success** `201 { data: { runId, cycleDate, fdCount, totalInterest, exceptionCount, status } }`
- **Errors** `409 RUN_ALREADY_EXISTS` — a re-run for the same cycle creates **no duplicate credit** (NFR-SAFE-03, AC-08)
- **Page** `/interest-runs`

| `GET /api/fixed-deposits` | List with filters | staff roles; CUSTOMER for own |
| `GET /api/interest-runs` | Run history with totals and exceptions | CENTRAL_OPS, ADMIN, AUDITOR |

---

## Reports — framework M1, each report by its owner

`GET /api/reports/{report}` — `report` ∈ `agent-transactions` (RPT-01) ·
`account-summary` (RPT-02) · `active-fds` (RPT-03) · `interest-distribution` (RPT-04) ·
`customer-activity` (RPT-05).

- **Roles** BRANCH_MANAGER (own branch), CENTRAL_OPS, AUDITOR, ADMIN
- **Query** `from`, `to`, `branchId`, `agentId`, `accountId`, `planId`, `status`, `format=json|csv`, `page`, `pageSize`
- **Validation** dates valid and ordered; `branchId` inside the caller's scope; sort column via `allowListed()`
- **SQL** the report view for that report, filtered by parameterized predicates **plus the branch-scope predicate in the `WHERE` clause**
- **Success** `{ data: { rows, subtotals, grandTotal, filters, generatedAt, requestedBy } }` (REP-COM-01, REP-COM-03)
- **CSV** identical query and identical totals (REP-COM-04); streamed, not buffered (REP-COM-05)
- **Audit** every report access is logged (REP-COM-06)
- **Errors** `403` for a branch outside scope — **enforced in SQL, not by filtering after the fetch** (REP-COM-02)

### `GET /api/audit`
- **Roles** AUDITOR, ADMIN · **Query** `actorId`, `entityType`, `entityId`, `action`, `from`, `to`
- Uses indexes `(user_id, logged_at DESC)` and `(entity_type, entity_id)`. Read-only; the audit log has no write endpoint.

---

## Page-to-API map

| Page | Primary API | Roles | Owner |
|---|---|---|---|
| `/sign-in` | `POST /api/auth/login` | public | M1 |
| `/` dashboard | scoped summary queries | all | M1 |
| `/admin/users`, `/admin/roles` | `/api/admin/users` | ADMIN | M1 |
| `/admin/parameters` | `/api/admin/parameters` | ADMIN | M1 |
| `/admin/audit` | `GET /api/audit` | AUDITOR, ADMIN | M1 |
| `/admin/health` | `GET /api/health` | ADMIN | M4 |
| `/branches`, `/agents` | `/api/branches`, `/api/agents` | ADMIN, BRANCH_MANAGER | M2 |
| `/customers`, `/customers/new`, `/customers/{id}` | `/api/customers` | AGENT, BRANCH_MANAGER | M2 |
| `/plans` | `GET /api/plans` | all | M3 |
| `/accounts`, `/accounts/new`, `/accounts/{id}` | `/api/accounts` | AGENT, BRANCH_MANAGER | M3 |
| `/transactions/deposit` | `POST /api/transactions/deposits` | AGENT, BRANCH_MANAGER | M4 |
| `/transactions/withdraw` | `POST /api/transactions/withdrawals` | AGENT, BRANCH_MANAGER | M4 |
| `/transactions/{id}` | `GET`, `POST .../reverse` | staff; manager to reverse | M4 |
| `/accounts/{id}/statement` | `GET /api/accounts/{id}/transactions` | staff; CUSTOMER own | M4 |
| `/reconciliation` | `GET /api/reports/reconciliation` | CENTRAL_OPS, AUDITOR | M4 |
| `/fd-products` | `/api/fd-products` | ADMIN, CENTRAL_OPS | M5 |
| `/fixed-deposits`, `/fixed-deposits/new` | `/api/fixed-deposits` | AGENT, BRANCH_MANAGER, CENTRAL_OPS | M5 |
| `/interest-runs` | `/api/interest-runs` | CENTRAL_OPS, ADMIN | M5 |
| `/reports/agent-transactions` | RPT-01 | manager+, auditor | M2 |
| `/reports/account-summary` | RPT-02 | manager+, auditor | M3 |
| `/reports/customer-activity` | RPT-05 | manager+, auditor | M4 |
| `/reports/active-fds` | RPT-03 | manager+, auditor | M5 |
| `/reports/interest-distribution` | RPT-04 | CENTRAL_OPS, auditor | M5 |

**Endpoint count: 34.** Every endpoint in SRS Appendix C.1 is covered.

---

## Rules for every route handler

1. No SQL in a route handler. Call a service.
2. Authorize before validating; validate before calling the service.
3. Apply branch scope **inside the SQL**, never as a post-fetch array filter.
4. Map typed domain errors to status codes; never return SQL text, driver messages or
   stack traces (NFR-SEC-05).
5. Money in JSON is a **string** (`"1500.00"`), never a JavaScript number.
6. Money-moving endpoints require `Idempotency-Key` and are CSRF-protected.
