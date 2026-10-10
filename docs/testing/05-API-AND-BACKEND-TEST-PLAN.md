# 05 — API and Backend Test Plan

Every API endpoint on `dev` (33 route files, 37 handlers): who can call it, what it
accepts, what it returns, which errors it gives, a ready-to-run curl command, and the
test cases. Read 09 §6 (curl) and §7 (Postman) first.

All behaviour below comes from the code (file paths given). Where the code differs from
the requirement, the **Expected result** column states the *correct* behaviour, and the
Notes column says "Known issue — likely Fail" with the finding number in
`07-STATIC-REVIEW-FINDINGS.md`. Record what actually happens.

Column meanings are the same as in 04. **Tester** is never the owner. For Member 4
features that were implemented by Selith or Nadija, the tester is neither Pramudith nor
the implementer.

---

## 0. Setup used by every curl example

```bash
BASE=http://localhost:3000
PW='<the synthetic password from the header of database/seed/02_users.sql>'

# log in as a role; one cookie jar per role
login () {   # usage: login agent_c1 agent.txt
  curl -s -c "$2" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$PW\"}" "$BASE/api/auth/login"; echo
}
csrf () { awk '$6=="mims_csrf"{print $7}' "$1"; }   # usage: CSRF=$(csrf agent.txt)

login admin admin.txt;           login central_ops co.txt;     login auditor aud.txt
login bm_colombo bm.txt;         login bm_kandy bmk.txt
login agent_c1 agent.txt;        login agent_k1 agentk.txt;    login customer_adult_one cust.txt

# IDs that are random per rebuild — look them up once
CH=$(psql "$DATABASE_URL" -Atc "SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'")
ADULT_PLAN=$(curl -s -b agent.txt "$BASE/api/plans" | python3 -c "import sys,json;print([p['planId'] for p in json.load(sys.stdin)['data'] if p['planName']=='Adult'][0])")
JOINT_PLAN=$(curl -s -b agent.txt "$BASE/api/plans" | python3 -c "import sys,json;print([p['planId'] for p in json.load(sys.stdin)['data'] if p['planName']=='Joint'][0])")
FD1Y=$(curl -s -b admin.txt "$BASE/api/fd-products" | python3 -c "import sys,json;print([p['fdPlanId'] for p in json.load(sys.stdin)['data'] if p['status']=='ACTIVE' and p['tenureMonths']==12][0])")
```

**Fixed seed IDs** (`database/seed/_uuids.sql`, `10_accounts.sql`, `11_account_holders.sql`):

| Name | ID |
|---|---|
| Branch Colombo / Kandy / Galle | `00000000-0000-0000-0101-000000000001` / `…0002` / `…0003` |
| agent_c1 (Kamal Perera) | `00000000-0000-0000-0401-000000000011` |
| agent_k1 | `00000000-0000-0000-0401-000000000013` |
| Customer 03 Adult One (linked to `customer_adult_one`) | `00000000-0000-0000-0501-000000000003` |
| Customer 04 Adult Two (Colombo, agent_c1) | `00000000-0000-0000-0501-000000000004` |
| Customer 01 Child One (DOB 2015) | `00000000-0000-0000-0501-000000000001` |
| Customer 08 Adult Three (Kandy) | `00000000-0000-0000-0501-000000000008` |
| Account BR-COL-00000003 (Adult, customer 03) | `00000000-0000-0000-0801-000000000003` |
| Account BR-COL-00000002 (Teen, min 500) | `00000000-0000-0000-0801-000000000002` |
| Account BR-COL-00000005 (Joint ANY_ONE, customers 03 + 04) | `00000000-0000-0000-0801-000000000005` |
| Account BR-KAN-00000001 (Joint ALL_HOLDERS, 08/09/10) | `00000000-0000-0000-0801-000000000006` |
| Account BR-KAN-00000002 (Adult, Kandy) | `00000000-0000-0000-0801-000000000007` |

**Response envelope:** `{ "data": … }` on success; `{ "error": { "code", "message" } }`
on failure (`lib/http/error-response.ts`). Exceptions: the statement returns
`{ data, meta }` and `GET /api/audit` returns `{ data, page, pageSize }`.

**Common error codes:** `401 UNAUTHORIZED` (no or expired session),
`403 FORBIDDEN` (role or CSRF, from `requireRole`/`verifyCsrf`),
`403 NOT_AUTHORIZED` (service-level scope), `400 VALIDATION_FAILED` (zod),
`400 INVALID_JSON`, `404 NOT_FOUND`, `409 <BUSINESS_CODE>`,
`500 UNEXPECTED_DB_ERROR` / `INTERNAL_ERROR`.

---

## 1. Endpoint catalogue

| # | Method & path | Auth / roles | CSRF | Idempotency-Key | Owner | Implemented by | Existing tests |
|---|---|---|---|---|---|---|---|
| 1 | `POST /api/auth/login` | public | – (Origin + JSON checks) | – | Nadija | Nadija (`114d5c4`) | `tests/api/auth.test.mjs`, `tests/e2e/sign-in.test.mjs` |
| 2 | `POST /api/auth/logout` | none enforced | ✓ | – | Nadija | Nadija | same |
| 3 | `GET /api/health` | any session | – | – | Pramudith | Pramudith | `tests/api/health.test.mjs` |
| 4 | `POST /api/interest-runs` | CENTRAL_OPS, ADMIN **or** worker Bearer token | ✓ (session path) | – | Nadija (worker auth) / Selith (cycle) | Nadija | `tests/api/interest-runs.test.mjs` |
| 5 | `GET /api/admin/parameters` | ADMIN | – | – | Nadija | Nadija | `tests/api/parameters.test.mjs` |
| 6 | `PUT /api/admin/parameters/{key}` | ADMIN | ✓ | – | Nadija | Nadija | `parameters.test.mjs`, `cycle-config.test.mjs` |
| 7 | `GET /api/branches` | ADMIN, CENTRAL_OPS, BM, AUDITOR | – | – | Vibodha | Vibodha | `organization.test.mjs`, `master-data-integrity.test.mjs` |
| 8 | `POST /api/branches` | ADMIN | ✓ | – | Vibodha | Vibodha | same |
| 9 | `PATCH /api/branches/{id}` | ADMIN | ✓ | – | Vibodha | Vibodha | same |
| 10 | `GET /api/agents` | ADMIN, CENTRAL_OPS, BM | – | – | Vibodha | Vibodha | same |
| 11 | `POST /api/agents` | ADMIN, BM | ✓ | – | Vibodha | Vibodha | same |
| 12 | `PATCH /api/agents/{id}` | ADMIN, BM | ✓ | – | Vibodha | Vibodha | same |
| 13 | `GET /api/agents/{id}/activity` | ADMIN, CENTRAL_OPS, BM (branch), AGENT (self) | – | – | Vibodha | Vibodha | `agent-activity.test.mjs` |
| 14 | `GET /api/plans` | any session | – | – | Nisith | Nisith | `plans.test.mjs` |
| 15 | `PATCH /api/plans/{id}` | ADMIN, CENTRAL_OPS | ✓ | – | Nisith | Nisith | `plans.test.mjs` |
| 16 | `GET /api/fd-products` | any session | – | – | Selith | Selith | `fd-products.test.mjs` |
| 17 | `PATCH /api/fd-products/{id}` | ADMIN | ✓ | – | Selith | Selith | `fd-products.test.mjs` |
| 18 | `GET /api/customers` | AGENT, BM, CENTRAL_OPS, AUDITOR | – | – | Vibodha | Vibodha | `customers.test.mjs`, `customer-service.test.mjs` |
| 19 | `POST /api/customers` | AGENT, BM | ✓ | – | Vibodha | Vibodha | same |
| 20 | `GET /api/customers/{id}` | AGENT, BM, CENTRAL_OPS, AUDITOR, CUSTOMER (self) | – | – | Vibodha | Vibodha | same |
| 21 | `GET /api/customers/{id}/fixed-deposits` | AGENT, BM, CENTRAL_OPS, AUDITOR, CUSTOMER | – | – | Vibodha | Vibodha | `customer-fixed-deposits.test.mjs`, `customer-fd-scope.test.mjs` |
| 22 | `GET /api/accounts` | AGENT, BM, CENTRAL_OPS, AUDITOR | – | – | Nisith | Nisith | `accounts.test.mjs` |
| 23 | `POST /api/accounts` | AGENT, BM | ✓ | **required** | Nisith | Nisith | `accounts.test.mjs` |
| 24 | `GET /api/accounts/{id}` | AGENT, BM, CENTRAL_OPS, AUDITOR, CUSTOMER | – | – | Nisith | Nisith | `accounts.test.mjs` |
| 25 | `POST /api/accounts/{id}/holders` | BM | ✓ | – | Nisith | Nisith | `accounts.test.mjs` |
| 26 | `POST /api/accounts/{id}/close` | BM | ✓ | – | Nisith | Nisith | `accounts.test.mjs` |
| 27 | `GET /api/accounts/{id}/transactions` | AGENT, BM, AUDITOR, CUSTOMER | – | – | Pramudith | Selith on Pramudith's behalf | **none** |
| 28 | `POST /api/transactions/deposits` | AGENT, BM | ✓ | **required** | Pramudith | Route: Selith on Pramudith's behalf; `sp_post_deposit`: Pramudith | **placeholder** (`deposits.test.mjs`) |
| 29 | `POST /api/transactions/withdrawals` | AGENT, BM, CUSTOMER | ✓ | **required** | Pramudith | Selith on Pramudith's behalf (`0362`); repaired by Vibodha (`0363` repair) | **placeholder** (`withdrawals.test.mjs`) |
| 30 | `POST /api/transactions/{id}/reverse` | BM, ADMIN | ✓ | – | Pramudith | Selith on Pramudith's behalf (`0363` reversal); route auth by Nadija | `reversal.test.mjs` (weak), `reversals.test.mjs` (placeholder) |
| 31 | `GET /api/transactions/{id}` | AGENT, BM, AUDITOR, CUSTOMER | – | – | Pramudith | Selith on Pramudith's behalf | **none** |
| 32 | `GET /api/audit` | AUDITOR, ADMIN | – | – | Nadija | Nadija | `audit.test.mjs` |
| 33 | `GET /api/reports/agent-transactions` | ADMIN, CENTRAL_OPS, AUDITOR, BM | – | – | Vibodha | Vibodha | `rpt01-report.test.mjs` |
| 34 | `GET /api/reports/account-summary` | ADMIN, CENTRAL_OPS, AUDITOR, BM | – | – | Nisith | Nisith | `rpt02-report.test.mjs` |
| 35 | `GET /api/reports/active-fds` | BM, CENTRAL_OPS, AUDITOR, ADMIN | – | – | Selith | Selith | **none** |
| 36 | `GET /api/reports/interest-distribution` | BM, CENTRAL_OPS, AUDITOR, ADMIN | – | – | Selith | Selith | **none** |
| 37 | `GET /api/reports/customer-activity` | BM, CENTRAL_OPS, AUDITOR, ADMIN | – | – | Pramudith | Nadija on Pramudith's behalf | `rpt05-report.test.mjs` |

**No API exists** for: FD opening or listing (`/api/fixed-deposits`), interest run listing,
reconciliation (page only), transaction channels, users/roles admin. These are documented
in `docs/05_api-and-pages.md` but are not in the code (07, F-24).

---

## 2. Endpoint details

### 2.1 Authentication, health, interest request

**#1 `POST /api/auth/login`** — `app/api/auth/login/route.ts:7`, `services/auth-service.ts:24`
- **Body:** `{ "username": string ≤100 (trimmed), "password": string ≤4096 }`, header
  `Content-Type: application/json`.
- **200:** `{ data: { user: { id, username, role, branchId } } }` plus two cookies:
  - `mims_session` — HttpOnly, SameSite=Lax, Expires = absolute timeout;
  - `mims_csrf` — readable, no Expires.
  - `Secure` only in production. **The CSRF token is not in the body.**
- **Errors:**
  - `400 INVALID_INPUT` (not JSON or bad fields)
  - `400 INVALID_JSON`
  - `403 FORBIDDEN` (cross-origin `Origin` header)
  - `401 INVALID_CREDENTIALS` "Invalid username or password" (same for unknown user and
    wrong password)
  - `403 ACCOUNT_INACTIVE`
  - `429 TOO_MANY_ATTEMPTS` (≥5 failures for this username in 15 min, checked **before**
    the password)
- **DB:** `login_attempt`, `app_user`, `role`, `agent`, `user_session`.

**#2 `POST /api/auth/logout`** — `app/api/auth/logout/route.ts:6`
- **CSRF:** required. No session is required.
- **204:** no body. Sets `user_session.revoked_at` and deletes `mims_session` (does **not**
  delete `mims_csrf`).

**#3 `GET /api/health`** — `services/health-service.ts:16`
- **200 `{ data: { status: "ok" } }`.** ADMIN and CENTRAL_OPS also get `db{connected,
  poolTotal, poolIdle, poolWaiting}`, `migrationsApplied`, `lastMigration`, `uptimeSeconds`.
- A database failure returns 503 with `status:"degraded"`.

**#4 `POST /api/interest-runs`** — `services/interest-request-service.ts:12`
- **Auth:** a session (CENTRAL_OPS or ADMIN + CSRF) **or** `Authorization: Bearer
  $INTEREST_WORKER_TOKEN` with no session cookie.
- **Body (strict):** `{ "cycleDate": "YYYY-MM-DD", "dryRun": boolean }`.
- **200 `{ data: { status: "STARTED" } }`.** **It only inserts one `audit_log` row
  (`INTEREST_RUN_INITIATED`). It does not run the cycle** (07, F-24).

### 2.2 Administration

**#5 `GET /api/admin/parameters`**
- **ADMIN.** Returns `[{ param_id, param_key, param_value, description, data_type,
  updated_at }]`.

**#6 `PUT /api/admin/parameters/{key}`**
- **ADMIN + CSRF.** Body `{ "value": string ≤500 }`.
- **Rules:**
  - `BUSINESS_HOUR_*` must be `HH:mm`.
  - `WITHDRAWAL_*` must be a positive decimal with ≤2 dp.
  - `SESSION_*` and `INTEREST_CYCLE_DAYS` must be an integer 1–9999.
  - Any other key, e.g. `MIN_FD_PRINCIPAL`, accepts any text (F-21).
- **Errors:** `400 VALIDATION` / `VALIDATION_FAILED`, `404 NOT_FOUND`.
- **DB:** the trigger `trg_audit_system_parameter` writes `audit_log`. The actor is
  recorded as SYSTEM (F-11).

**#32 `GET /api/audit`**
- **AUDITOR, ADMIN.** Query (strict): `actorId` (uuid), `entityType`, `entityId` (uuid),
  `action`, `from`/`to` (`YYYY-MM-DD` or ISO date-time **with offset**), `page`,
  `pageSize` ≤100.
- **Returns** `{ data:[{ log_id, user_id, actor_type, entity_type, entity_id, action,
  old_values, new_values, ip_address, logged_at }], page, pageSize }`.
- **Errors:** `400 BAD_REQUEST`.

### 2.3 Organisation

**#7 `GET /api/branches`**
- `?status=ACTIVE|INACTIVE|SUSPENDED`.
- **Scope:** BM sees only their own branch (SQL predicate).
- **Returns** `[{ branchId, branchCode, branchName, address, district, phone, status, … }]`.

**#8 `POST /api/branches`**
- **ADMIN + CSRF.** Body (strict, all required): `branchCode ≤20, branchName ≤100,
  address ≤255, district ≤100, phone ≤20`.
- **201**, or `409 DUPLICATE_BRANCH_CODE`.

**#9 `PATCH /api/branches/{id}`**
- **ADMIN + CSRF.** Body: any of `branchName, address, district, phone, status`.
  `branchCode` is immutable.
- **Errors:** `404`, `409 BRANCH_HAS_ACTIVE_AGENTS`.

**#10 `GET /api/agents`**
- **ADMIN, CENTRAL_OPS, BM** (BM: own branch). Only `role_name = 'AGENT'` rows.
- NIC and email are **not** masked.

**#11 `POST /api/agents`**
- **ADMIN, BM + CSRF.** Body (strict): `username` (3–100 `[A-Za-z0-9._-]`), `password`
  (12–128), `branchId?` (ADMIN must send; BM is forced to own branch, a different one →
  403), `employeeNo, nicPassportNo, fullName, dateOfBirth, gender, phone, address, email,
  hiredDate`.
- **201.** `409 DUPLICATE_USERNAME | DUPLICATE_EMPLOYEE_NO | DUPLICATE_IDENTITY |
  DUPLICATE_EMAIL | BRANCH_NOT_ACTIVE | INVALID_BRANCH`.

**#12 `PATCH /api/agents/{id}`**
- **ADMIN, BM + CSRF.** Profile fields + `status`.
- Out-of-branch → `403 NOT_AUTHORIZED`; unknown → `404`.

**#13 `GET /api/agents/{id}/activity?from&to`**
- Dates `YYYY-MM-DD`, from ≤ to; unknown parameters → 400.
- **Returns** `{ agentId, from, to, timeZone, scope, agent{…}, byType:[{type,count,total}] }`.
- AGENT viewing another agent → `403 NOT_AUTHORIZED`.

### 2.4 Plans and FD products

**#14 `GET /api/plans`**
- **Any session.** Returns `[{ planId, planName, interestRate, minBalance, minAgeYears,
  maxAgeYears, minHolders, maxHolders, requiresAllAdult, status, … }]`.

**#15 `PATCH /api/plans/{id}`**
- **ADMIN, CENTRAL_OPS + CSRF.**
- **Body (strict):**
  - `interestRate` string 0 < r ≤ 1, ≤4 dp
  - `minBalance`
  - `description`
  - `status`
  - `minAgeYears` / `maxAgeYears` 0–120
  - `minHolders` / `maxHolders` 1–20
  - `requiresAllAdult`
- **Errors:** `409 INVALID_AGE_RANGE | INVALID_HOLDER_RANGE | INVALID_MIN_BALANCE`, `404`.
- **No audit row** (F-11).

**#16 `GET /api/fd-products`**
- **Any session.** Returns all versions, including expired ones.

**#17 `PATCH /api/fd-products/{id}`**
- **ADMIN + CSRF.** Body `{ interestRate?: "0.1350" (string), status?, description? }`.
- A rate change closes the old row and inserts a **new row with a new `fdPlanId`**.
- **Errors:** `400 BAD_REQUEST`, `404`; a bad uuid → 500.
- **No audit row** (F-11, F-23).

### 2.5 Customers

**#18 `GET /api/customers`**
- **Query (strict):** `q` ≤150, `name`, `nicPassportNo`, `branchId`, `agentId`, `status`,
  `sortBy` (fullName | customerNumber | createdAt), `sortDirection`, `page`, `pageSize` ≤100.
- **Scope:**
  - BM: own branch.
  - AGENT: only actively assigned customers.
  - A `branchId` outside scope → 403.
- **Masking:** NIC and email are masked for AGENT and BM.
- **Returns** `{ customers:[…], total, page, pageSize }`.

**#19 `POST /api/customers`**
- **AGENT, BM + CSRF.**
- **Body (strict):**
  - `fullName` ≤150
  - `nicPassportNo` 5–50 alphanumeric
  - `dateOfBirth` (past)
  - `gender?`, `phone?`, `address?`
  - `email`
  - `branchId` (must be own branch)
  - `agentId` (AGENT = self; BM = an active agent of the branch)
  - `documents` (required array, 0–20 × `{docType, filePath}`)
- **201 `{ customerId, customerNumber }`.**
- **Errors:** `409 DUPLICATE_IDENTITY | DUPLICATE_EMAIL | INVALID_ASSIGNED_AGENT`.
- **DB:** `customer`, `customer_document` (unverified), `customer_agent`,
  `trg_audit_customer`.

**#20 `GET /api/customers/{id}`**
- **Returns** profile, assignment history, documents, accounts.
- Out of scope → uniform `404`; bad uuid → 400.

**#21 `GET /api/customers/{id}/fixed-deposits`**
- **No query parameters allowed.** View `vw_customer_fd_summary`; ADMIN excluded.

### 2.6 Accounts

**#22 `GET /api/accounts`**
- `q, status, planId, branchId, sortBy, sortDirection, page, pageSize`.
- **Scope:** AGENT sees only assigned customers' accounts; ADMIN and CUSTOMER → 403.

**#23 `POST /api/accounts`**
- **AGENT, BM + CSRF + `Idempotency-Key`** (`^[A-Za-z0-9_-]{8,80}$`, per user).
- **Body (strict):**
  - `planId`, `branchId` (own branch)
  - `holders`: 1–4 × `{customerId, holderType PRIMARY|JOINT}`, exactly one PRIMARY
  - `mandate?` `{type ANY_ONE|ALL_HOLDERS, requiredSignatories?}`
  - `initialDeposit?` (string `^\d{1,13}(\.\d{1,2})?$`)
- **201** new / **200** replay `{ accountId, accountNumber, currentBalance }`.
- **Errors:**
  - `409 PLAN_ELIGIBILITY_FAILED | DOCUMENTS_NOT_VERIFIED | BELOW_MINIMUM_BALANCE |
    OUTSIDE_BUSINESS_HOURS | INVALID_HOLDER_COUNT | UNDERAGE_HOLDER | DUPLICATE_HOLDER |
    MANDATE_REQUIRED | MANDATE_NOT_ALLOWED | HOLDER_NOT_FOUND …`
  - `422 IDEMPOTENCY_KEY_REUSED | MISSING_PRIMARY_HOLDER | PLAN_NOT_FOUND …`
- **DB:** `sp_open_savings_account`, `account_opening_request`.

**#24 `GET /api/accounts/{id}`**
- **Returns** summary + `minBalance`, `availableToWithdraw`, `lastTransaction`, `holders[]`,
  `mandate{…, state}`, `fixedDeposits[]|null`.
- Out of scope → `404`.

**#25 `POST /api/accounts/{id}/holders`**
- **BM + CSRF.** Body `{ customerId }`. `sp_add_account_holder`.
- **201.** `409 ACCOUNT_NOT_ACTIVE | INVALID_HOLDER_COUNT | UNDERAGE_HOLDER |
  DOCUMENTS_NOT_VERIFIED | DUPLICATE_HOLDER`.

**#26 `POST /api/accounts/{id}/close`**
- **BM + CSRF.** No body. `sp_close_account`.
- **200 `{ accountId, status:"CLOSED", closedAt }`.**
- `409 BALANCE_NOT_ZERO | ACTIVE_FD_EXISTS | ACCOUNT_ALREADY_CLOSED | ACCOUNT_NOT_ACTIVE`.
- Every seeded account has a balance and an active FD, so it returns 409 on seed data.

**#27 `GET /api/accounts/{id}/transactions?page&pageSize`** — statement
- **AGENT, BM, AUDITOR, CUSTOMER.**
- **Returns** `{ data:[{ transactionId, referenceNumber, transactionType, amount,
  transactionDate, balanceAfter, narration }], meta:{page,pageSize,total} }`.
- **Known issues (F-15):**
  - An unknown account gives `400`, not 404.
  - A bad page or uuid gives 500.
  - Rows are ordered by date only.

### 2.7 Transactions

**#28 `POST /api/transactions/deposits`** — `services/transaction-service.ts:16`,
`database/routines/sp_post_deposit.sql`
- **AGENT, BM + CSRF + `Idempotency-Key`.**
- **Body:** `{ accountId, amount: "2500.00" (exactly 2 dp), channelId, narration? }`.
- **201** new / **200** replay `{ transactionId, referenceNumber, amount, balanceAfter,
  postedAt }`.
- **Errors:** `400 MISSING_IDEMPOTENCY_KEY | VALIDATION_FAILED`, `404 ACCOUNT_NOT_FOUND`
  (other branch), `409 ACCOUNT_NOT_ACTIVE | OUTSIDE_BUSINESS_HOURS | CHANNEL_UNAVAILABLE`.
- **Known issues:**
  - The key is global and the body is not compared (F-04).
  - Deposits are not attributed to the agent or branch (F-10).

**#29 `POST /api/transactions/withdrawals`** — `transaction-service.ts:54`
- **AGENT, BM, CUSTOMER + CSRF + `Idempotency-Key`.**
- **Body:** `{ accountId, amount, channelId, onBehalfOfCustomerId?, narration? }`.
- **Intended errors:** `409 INSUFFICIENT_FUNDS | BELOW_MINIMUM_BALANCE | LIMIT_EXCEEDED |
  MANDATE_NOT_SATISFIED | ACCOUNT_NOT_ACTIVE | OUTSIDE_BUSINESS_HOURS`.
- **Known issue (F-01, Critical):** the service calls the overloaded `sp_post_withdrawal`
  with untyped parameters. A throwaway-cluster experiment reproduced
  `42725 procedure … is not unique`, so **every call is expected to return
  `500 UNEXPECTED_DB_ERROR`**.
- **Related issues:** signer handling (F-05) and the missing rejection audit (F-06).

**#30 `POST /api/transactions/{id}/reverse`**
- **BM, ADMIN + CSRF.** Body `{ "reason": "…" }`.
- **201 `{ reversalTransactionId, balanceAfter }`** (the reversal reference is lost, F-16).
- **Errors:** `404 TRANSACTION_NOT_FOUND`, `409 ALREADY_REVERSED`, `409
  BUSINESS_RULE_VIOLATION` (reversing a reversal, overdraft, unsupported type).
- **Known issue (F-02, Critical):** another branch's manager can "reverse" a transaction.
  The ledger row is inserted, but the balance is unchanged.

**#31 `GET /api/transactions/{id}`**
- **AGENT, BM, AUDITOR, CUSTOMER.**
- **Returns** `{ transactionId, accountId, referenceNumber, transactionType, amount,
  transactionDate, balanceAfter, narration, isReversed }`.
- **Known issue (F-03):** no branch or holder check, and no RLS on `transaction`.

### 2.8 Reports

All REAL report endpoints accept `format=json|csv` and write a `REPORT_ACCESSED` audit row.

**#33 RPT-01 `GET /api/reports/agent-transactions`**
- **Query (strict):** `from`, `to`, `branchId`, `agentId`, `format`, `page`, `pageSize`
  ≤100, `sort` (employeeNo | agentName | netTotal), `direction`.
- BM forced to own branch (another → 403).
- **Returns** rows with per-type counts and totals, `subtotals`, `grandTotal`,
  `exclusions`.
- **CSV** streams all rows with `rowType`.

**#34 RPT-02 `GET /api/reports/account-summary`**
- **Query:** `from`, `to`, `branchId`, `accountId`, `planId`, `status`, `format`, `page`,
  `pageSize`, `sort`, `direction`.
- **View:** `vw_rpt02_account_summary`.
- **CSV:** all rows (up to 50,000).

**#35 RPT-03 `GET /api/reports/active-fds`**
- **Query:** `from`, `to`, `branchId`, `planId`, `status`, `format`, `sort`.
- **View:** `vw_rpt03_active_fds`.
- **Known issues (F-09):**
  - Unauthenticated or wrong role → 500.
  - No validation and no paging.
  - Totals use JS numbers.

**#36 RPT-04 `GET /api/reports/interest-distribution`**
- **Query:** `from`, `to`, `branchId`, `planId`. `planId` is matched against the
  **plan name**, e.g. `Adult` (F-09).
- **View:** `vw_rpt04_interest_distribution`, with ROLLUP subtotal rows for bank-wide
  users.

**#37 RPT-05 `GET /api/reports/customer-activity`**
- **Query:** `from`, `to`, `branchId`, `accountId`, `planId`, `status`, `sort` (name |
  deposits | withdrawals | interest | net), `format`, `page`, `pageSize`.
- **View:** `vw_rpt05_customer_activity`.
- **CSV:** only the current page (F-14).

---

## 3. Test cases

Run in order, top to bottom. Earlier rows create data later rows use. Business hours
must be open (WF-ADM-03 / API-ADM-04).

> **Abbreviations:** "as agent_c1" = use `-b agent.txt` and `CSRF=$(csrf agent.txt)`.
> `$BASE`, `$CH`, `$ADULT_PLAN` etc. come from §0.

### 3.1 Authentication and session

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-AUTH-01 | POST /api/auth/login | agent_c1 | Seeded user | `curl -i -c agent.txt -H 'Content-Type: application/json' -d "{\"username\":\"agent_c1\",\"password\":\"$PW\"}" $BASE/api/auth/login` | 200; body has `user.role="AGENT"`, `branchId` = Colombo; `Set-Cookie` for `mims_session` (HttpOnly) and `mims_csrf`; no password hash in body | Postman/curl | Covered by existing test (`tests/e2e/sign-in.test.mjs`) | Nadija | Selith | Not run | |
| API-AUTH-02 | POST /api/auth/login | — | Unknown user `nobody_x` vs wrong password for `agent_c2` | Send both | Both 401 `INVALID_CREDENTIALS` with identical message | Postman/curl | Covered by existing test (`tests/api/auth.test.mjs`) | Nadija | Selith | Not run | No user enumeration |
| API-AUTH-03 | POST /api/auth/login | — | Username `agent_g2` | Send 5 wrong passwords, then the correct password | 6th call 429 `TOO_MANY_ATTEMPTS` even with the right password; DB: 5 `login_attempt` rows with `success=false` | Postman/curl + SQL | Covered by existing test (`tests/api/auth.test.mjs`) | Nadija | Selith | Not run | Locks agent_g2 for 15 min — use it only here. Per-username lockout (F-17) |
| API-AUTH-04 | POST /api/auth/login | — | — | Send body as `text/plain`; send `{}`; send username of 101 characters | 400 `INVALID_INPUT` each time | Postman/curl | Partially covered (`tests/e2e/sign-in.test.mjs`) | Nadija | Selith | Not run | |
| API-AUTH-05 | POST /api/auth/login | — | — | Add header `Origin: http://evil.example` | 403 `FORBIDDEN` "Request origin could not be verified." | Postman/curl | Manual only | Nadija | Selith | Not run | |
| API-AUTH-06 | any protected GET | none | No cookie | `curl -i $BASE/api/accounts` | 401 `UNAUTHORIZED` "Authentication required." | Postman/curl | Covered by existing test (`tests/api/authorization.test.mjs`) | Nadija | Selith | Not run | |
| API-AUTH-07 | any protected GET | — | Forged cookie | `curl -i -b 'mims_session=deadbeef' $BASE/api/accounts` | 401 "Session expired or invalid." | Postman/curl | Covered by existing test (`tests/api/health.test.mjs`) | Nadija | Selith | Not run | |
| API-AUTH-08 | POST /api/auth/logout | agent_c1 (temp jar) | Log in to `tmp.txt` | Logout **without** `x-csrf-token` | 403 `FORBIDDEN` | Postman/curl | Covered by existing test (`tests/api/authorization.test.mjs`) | Nadija | Selith | Not run | |
| API-AUTH-09 | POST /api/auth/logout | agent_c1 (temp jar) | `tmp.txt` from API-AUTH-08 | `curl -i -b tmp.txt -c tmp.txt -X POST -H "x-csrf-token: $(csrf tmp.txt)" $BASE/api/auth/logout`, then reuse the **old** session cookie value on `GET /api/accounts` | 204; then 401. DB: `user_session.revoked_at` set | Postman/curl + SQL | Covered by existing test (`tests/api/auth.test.mjs`) | Nadija | Selith | Not run | `mims_csrf` is not cleared (F-19) |
| API-AUTH-10 | any | any | Session idle > `SESSION_IDLE_TIMEOUT_MINUTES` | As ADMIN set `SESSION_IDLE_TIMEOUT_MINUTES`=1 (API-ADM-04 style), log in a temp jar, wait 70 s, call `GET /api/plans`; restore to 20 | 401 after the wait | Postman/curl | Partially covered (`tests/api/health.test.mjs` expired session) | Nadija | Selith | Not run | Restore the value afterwards |

### 3.2 Health and administration

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-HLT-01 | GET /api/health | admin | | `curl -s -b admin.txt $BASE/api/health` | 200; `status:"ok"`, `db.connected:true`, `migrationsApplied` = number of migration files (51), `lastMigration` = `0620_p06_m02_interest_reference.sql` | Postman/curl | Covered by existing test (`tests/api/health.test.mjs`) | Pramudith | Selith | Not run | |
| API-HLT-02 | GET /api/health | agent_c1 | | Same as agent | 200 with **only** `status`; no pool or migration details | Postman/curl | Covered by existing test (`tests/api/health.test.mjs`) | Pramudith | Selith | Not run | |
| API-ADM-01 | GET /api/admin/parameters | admin | | `curl -s -b admin.txt $BASE/api/admin/parameters` | 200; 9 keys incl. `BUSINESS_HOUR_START` 08:30, `BUSINESS_HOUR_END` 17:00, `WITHDRAWAL_SINGLE_LIMIT` 100000.00 | Postman/curl | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Selith | Not run | |
| API-ADM-02 | GET /api/admin/parameters | central_ops, agent_c1 | | Same with co.txt, agent.txt | 403 `FORBIDDEN` | Postman/curl | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Selith | Not run | |
| API-ADM-03 | PUT /api/admin/parameters/{key} | admin | | `curl -s -b admin.txt -X PUT -H "x-csrf-token: $(csrf admin.txt)" -H 'Content-Type: application/json' -d '{"value":"25:99"}' $BASE/api/admin/parameters/BUSINESS_HOUR_END` | 400 `VALIDATION_FAILED`; value unchanged | Postman/curl | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Selith | Not run | |
| API-ADM-04 | PUT /api/admin/parameters/{key} | admin | Only if testing outside 08:30–17:00 Colombo | PUT `BUSINESS_HOUR_START` = `00:00` and `BUSINESS_HOUR_END` = `23:59` | 200 each; `GET` shows new values; SQL: `SELECT action,actor_type FROM audit_log WHERE entity_type='system_parameter' ORDER BY logged_at DESC LIMIT 2` shows 2 UPDATE rows | Postman/curl + SQL | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Selith | Not run | Restore 08:30 / 17:00 at the end of the session. `actor_type` is SYSTEM, not the admin (F-11) |
| API-ADM-05 | PUT /api/admin/parameters/{key} | admin | | PUT without CSRF header; PUT key `NOPE` | 403; 404 `NOT_FOUND` | Postman/curl | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Selith | Not run | |
| API-ADM-06 | PUT /api/admin/parameters/MIN_FD_PRINCIPAL | admin | | Value `"abc"` | Should be 400 | Postman/curl | Manual only | Nadija | Selith | Not run | Known issue — likely Fail (accepts any text, F-21). Restore `10000.00` |
| API-AUD-01 | GET /api/audit | auditor | Earlier tests wrote audit rows | `curl -s -b aud.txt "$BASE/api/audit?entityType=system_parameter&pageSize=5"` | 200 `{data:[…],page:1,pageSize:5}`; rows newest first | Postman/curl | Covered by existing test (`tests/api/audit.test.mjs`) | Nadija | Selith | Not run | |
| API-AUD-02 | GET /api/audit | agent_c1, bm_colombo | | Same | 403 | Postman/curl | Covered by existing test (`tests/api/audit.test.mjs`) | Nadija | Selith | Not run | |
| API-AUD-03 | GET /api/audit | auditor | | `?from=2026-10-09T10:00` (no offset, as the page sends) and `?actorId=xyz` | 400 `BAD_REQUEST` for both | Postman/curl | Partially covered (`tests/api/audit.test.mjs`) | Nadija | Selith | Not run | Confirms page bug F-13 |
| API-AUD-04 | GET /api/audit | auditor | | `?from=2026-10-09T00:00:00%2B05:30&to=2026-10-09` | 200 | Postman/curl | Manual only | Nadija | Selith | Not run | |

### 3.3 Organisation

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-ORG-01 | GET /api/branches | admin; bm_colombo | | Call with both jars | admin: 3 seeded branches (+ any created); bm_colombo: **only** BR-COL | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | Scope applied in SQL |
| API-ORG-02 | GET /api/branches | agent_c1 | | Call | 403 | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-03 | POST /api/branches | admin | | `curl -s -b admin.txt -H "x-csrf-token: $(csrf admin.txt)" -H 'Content-Type: application/json' -d '{"branchCode":"BR-MAT","branchName":"Matara","address":"1 Beach Rd","district":"Matara","phone":"0412222222"}' $BASE/api/branches` | 201 with `branchId`. SQL: `audit_log` row `entity_type='branch', action='INSERT'` | Postman/curl + SQL | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | Skip if WF-ORG-02 already created BR-MAT; use BR-MT2 |
| API-ORG-04 | POST /api/branches | admin | BR-MAT exists | Repeat API-ORG-03 | 409 `DUPLICATE_BRANCH_CODE` | Postman/curl | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-05 | POST /api/branches | admin; bm_colombo | | Body missing `phone`; extra field `"x":1`; same valid body as BM | 400; 400; 403 | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-06 | PATCH /api/branches/{id} | admin | Colombo has active agents | PATCH Colombo `{"status":"INACTIVE"}` | 409 `BRANCH_HAS_ACTIVE_AGENTS`; Colombo still ACTIVE | Postman/curl | Covered by existing test (`tests/db/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | Trigger `trg_branch_prevent_deactivation_with_active_agents` |
| API-ORG-07 | PATCH /api/branches/{id} | admin | BR-MAT from API-ORG-03 (no agents) | PATCH `{"status":"INACTIVE"}` then `GET ?status=INACTIVE` | 200; listed as INACTIVE; row not deleted | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-08 | GET /api/agents | bm_colombo; agent_c1 | | Call | BM: only Colombo agents, NIC/email visible; AGENT: 403 | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-09 | POST /api/agents | bm_colombo | | Body from §2.3 #11 with `username` `agent_c3`, `employeeNo` `EMP-C3`, `nicPassportNo` `199912345678`, `email` `agent.c3@example.com` | 201; `branchId` = Colombo even though not sent. SQL: `app_user` + `agent` rows; password hash starts `$argon2id$` | Postman/curl + SQL | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | Skip if WF-ORG-06 created agent_c3 — use agent_c4 |
| API-ORG-10 | POST /api/agents | bm_colombo | agent_c3 exists | Same body again; then a new username with same `employeeNo`; then `branchId` = Kandy | 409 `DUPLICATE_USERNAME`; 409 `DUPLICATE_EMPLOYEE_NO`; 403 `NOT_AUTHORIZED` | Postman/curl | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-11 | PATCH /api/agents/{id} | bm_kandy | agent_c1 is Colombo | PATCH agent_c1 `{"phone":"0779999999"}` | 403 `NOT_AUTHORIZED` | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-12 | PATCH /api/agents/{id} | bm_colombo | agent_c3 | PATCH `{"status":"INACTIVE"}`; then try login as agent_c3 | 200; login 403 `ACCOUNT_INACTIVE` | Postman/curl | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-13 | GET /api/agents/{id}/activity | agent_c1 | | Own id `?from=2026-01-01&to=2026-12-31`; then agent_c2's id | 200 with `scope:"SELF"`; then 403 | Postman/curl | Covered by existing test (`tests/api/agent-activity.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-14 | GET /api/agents/{id}/activity | bm_kandy | | agent_c1's id | 403 `NOT_AUTHORIZED` | Postman/curl | Covered by existing test (`tests/api/agent-activity.test.mjs`) | Vibodha | Nisith | Not run | |
| API-ORG-15 | GET /api/agents/{id}/activity | admin | | `?from=2026-12-31&to=2026-01-01`; `?foo=1` | 400 both | Postman/curl | Covered by existing test (`tests/api/agent-activity.test.mjs`) | Vibodha | Nisith | Not run | |

### 3.4 Plans and FD products

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-PLAN-01 | GET /api/plans | agent_c1 | | Call | 200; 5 plans: Children 0.1200/0.00, Teen 0.1100/500.00, Adult 0.1000/1000.00, Senior 0.1300/1000.00, Joint 0.0700/5000.00 | Postman/curl | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | Rates are strings |
| API-PLAN-02 | PATCH /api/plans/{id} | central_ops | `$ADULT_PLAN` | `-d '{"description":"Adult savings (tested)"}'` with CSRF | 200; description updated | Postman/curl | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | No audit row (F-11) |
| API-PLAN-03 | PATCH /api/plans/{id} | central_ops | | `{"minAgeYears":60,"maxAgeYears":18}`; `{"interestRate":"1.5"}`; `{"bogus":1}` | 400/409 each; plan unchanged | Postman/curl | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | |
| API-PLAN-04 | PATCH /api/plans/{id} | agent_c1; central_ops w/o CSRF | | Valid body | 403; 403 | Postman/curl | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | |
| API-FDP-01 | GET /api/fd-products | auditor | | Call | 200; ACTIVE FD-6M 0.1300, FD-1Y 0.1400, FD-3Y 0.1500 (tenure 6/12/36) | Postman/curl | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | |
| API-FDP-02 | PATCH /api/fd-products/{id} | admin | `$FD1Y` | `-d '{"interestRate":"0.1450"}'` with CSRF; then GET | 200 with a **new** `fdPlanId`; old row INACTIVE with `effectiveTo` = today | Postman/curl | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | Refresh `$FD1Y` afterwards. No audit row (F-11) |
| API-FDP-03 | PATCH /api/fd-products/{id} | central_ops; admin | | central_ops valid body; admin `{"interestRate":0.14}` (number); admin `{"interestRate":"1.5"}` | 403; 400; 400 | Postman/curl | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | |
| API-FDP-04 | PATCH /api/fd-products/{id} | admin | | Id `not-a-uuid` | Should be 400/404 | Postman/curl | Manual only | Selith | Nadija | Not run | Known issue — likely Fail (500, F-23) |

### 3.5 Customers

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-CUS-01 | GET /api/customers | agent_c1 | Assignments: agent_c1 → customers 01–04 | `curl -s -b agent.txt "$BASE/api/customers?pageSize=50"` | Only customers 01–04; NIC shown as `***1234`, email `***@***` | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-02 | GET /api/customers | bm_colombo; central_ops | | Call | BM: Colombo customers only (01–05 + new); CO: all 15+, unmasked | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-03 | GET /api/customers | bm_colombo | | `?branchId=00000000-0000-0000-0101-000000000002` | 403 | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | URL tampering |
| API-CUS-04 | GET /api/customers | agent_c1 | | `?sortBy=password`; `?q=' OR 1=1 --`; `?page=0` | 400; 200 with 0 rows (no SQL error); 400 | Postman/curl | Partially covered (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | SQL-injection probe |
| API-CUS-05 | POST /api/customers | agent_c1 | | Body §2.5 #19 with NIC `200012345678`, email `test.customer@example.com`, `documents:[{"docType":"NIC","filePath":"/docs/test.pdf"}]` | 201 `{customerId, customerNumber:"CUS-…"}`. SQL: 1 `customer`, 1 `customer_document` (verified_by NULL), 1 active `customer_agent`, 1 `audit_log` (entity customer) | Postman/curl + SQL | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | Skip if WF-CUS-02 used this NIC; use `200012345679` |
| API-CUS-06 | POST /api/customers | agent_c1 | API-CUS-05 done | Same NIC, different email | 409 `DUPLICATE_IDENTITY`; SQL: customer count unchanged, no orphan documents | Postman/curl + SQL | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | Atomic rollback |
| API-CUS-07 | POST /api/customers | agent_c1 | | `dateOfBirth` tomorrow; `nicPassportNo` "ab"; 21 documents; `agentId` = agent_c2; `branchId` = Kandy | 400; 400; 400; 409 `INVALID_ASSIGNED_AGENT` (or 403); 403 | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-08 | POST /api/customers | auditor; agent_c1 w/o CSRF | | Valid body | 403; 403 | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-09 | GET /api/customers/{id} | customer_adult_one | | Own id `…0501-000000000003`; then `…0501-000000000004` | 200 with accounts BR-COL-00000003 and BR-COL-00000005; then 404 | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-10 | GET /api/customers/{id} | agent_k1; bm_kandy | | Customer 03 (Colombo) | 404 (uniform, no data leak) | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-11 | GET /api/customers/{id}/fixed-deposits | customer_adult_one; central_ops; admin | Seed FDs on accounts 003/005 | Customer 03 | 200 with FD rows (principal, `interestRateAtOpening`, dates, status); CO 200; admin 403 | Postman/curl | Covered by existing test (`tests/api/customer-fixed-deposits.test.mjs`) | Vibodha | Nisith | Not run | |
| API-CUS-12 | GET /api/customers/{id}/fixed-deposits | bm_kandy | | Customer 03; and `?x=1` as CO | 404/403; 400 | Postman/curl | Covered by existing test (`tests/api/customer-fd-scope.test.mjs`) | Vibodha | Nisith | Not run | |

### 3.6 Accounts

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-ACC-01 | GET /api/accounts | agent_c1; bm_colombo; admin; customer | | Call with each | agent: accounts of customers 01–04; BM: all Colombo accounts; admin 403; customer 403 | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-02 | POST /api/accounts | bm_colombo | Customer 04 Adult Two (verified document), business hours open | `curl -s -b bm.txt -H "x-csrf-token: $(csrf bm.txt)" -H 'Idempotency-Key: open-adult2-0001' -H 'Content-Type: application/json' -d "{\"planId\":\"$ADULT_PLAN\",\"branchId\":\"00000000-0000-0000-0101-000000000001\",\"holders\":[{\"customerId\":\"00000000-0000-0000-0501-000000000004\",\"holderType\":\"PRIMARY\"}],\"initialDeposit\":\"1500.00\"}" $BASE/api/accounts` | 201 `{accountId, accountNumber:"BR-COL-…", currentBalance:"1500.00"}`. SQL: 1 account, 1 holder, 1 DEPOSIT transaction with `balance_after` 1500.00, 1 `account_opening_request` | Postman/curl + SQL | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Save `NEW_ACC`. Skip if WF-ACC-02 opened it (use key `open-adult2-0002`) |
| API-ACC-03 | POST /api/accounts | bm_colombo | API-ACC-02 done | Same request, same key | **200** with the same `accountId`; account count unchanged; no second deposit | Postman/curl + SQL | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Idempotency (BR-I3) |
| API-ACC-04 | POST /api/accounts | bm_colombo | | Same key, `initialDeposit` `2000.00` | 422 `IDEMPOTENCY_KEY_REUSED` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-05 | POST /api/accounts | bm_colombo | Customer 01 Child One (age 11) | New key, Adult plan, holder customer 01 | 409 `PLAN_ELIGIBILITY_FAILED`; no account | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | `fn_check_plan_eligibility` |
| API-ACC-06 | POST /api/accounts | bm_colombo | | New key, Adult plan, customer 04, `initialDeposit` `500.00` | 409 `BELOW_MINIMUM_BALANCE` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-07 | POST /api/accounts | bm_colombo | | New key, Joint plan, 1 holder (customer 04), mandate ANY_ONE | 409 `INVALID_HOLDER_COUNT` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Joint needs 2–4 |
| API-ACC-08 | POST /api/accounts | bm_colombo | | New key `open-joint-0001`, Joint plan, holders 04 PRIMARY + 05 JOINT, mandate `{"type":"ALL_HOLDERS"}`, deposit `6000.00` | 201; SQL: 2 holders, 1 `joint_mandate` ALL_HOLDERS with required_signatories 2 | Postman/curl + SQL | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Save `JOINT_ACC` |
| API-ACC-09 | POST /api/accounts | bm_colombo | | New key; Joint plan with holder 01 (child) + 04 | 409 `UNDERAGE_HOLDER` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-10 | POST /api/accounts | agent_c1 | | No `Idempotency-Key`; key `short`; `branchId` Kandy; customer 06 (Kandy) | 400; 400; 403; 409 `HOLDER_NOT_FOUND` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-11 | POST /api/accounts | bm_colombo | Customer from API-CUS-05 (unverified document) | New key, Adult plan, that customer | 409 `DOCUMENTS_NOT_VERIFIED` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Confirms F-07 |
| API-ACC-12 | GET /api/accounts/{id} | agent_c1 | `…0801-000000000003` | Call | 200; `availableToWithdraw` = balance − 1000.00; holders; `fixedDeposits` array | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-13 | GET /api/accounts/{id} | agent_k1; customer_adult_one | | 003 as agent_k1; 007 (Kandy) as customer | 404; 404 | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-14 | POST /api/accounts/{id}/holders | bm_colombo | Seed joint account 005 (2 holders) | `-d '{"customerId":"00000000-0000-0000-0501-000000000005"}'` | 201, `holderCount` 3 | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-15 | POST /api/accounts/{id}/holders | bm_colombo; agent_c1 | | Same customer again; Adult account 003; agent_c1 any | 409 `DUPLICATE_HOLDER`; 409 `INVALID_HOLDER_COUNT`; 403 | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-16 | POST /api/accounts/{id}/close | bm_colombo | Account 003 has balance + active FD | Close 003 | 409 `BALANCE_NOT_ZERO` (or `ACTIVE_FD_EXISTS`); status unchanged | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-17 | POST /api/accounts/{id}/close | bm_colombo | New account with no deposit: open with new key, Adult plan, customer 02 is Teen… use customer 05 Senior, **no** `initialDeposit` | Open, then close it | 201 then 200 `status:"CLOSED"`; SQL: `audit_log` action `CLOSE`; closing again → 409 `ACCOUNT_ALREADY_CLOSED` | Postman/curl + SQL | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| API-ACC-18 | POST /api/accounts/{id}/close | agent_c1; bm_kandy | | Close account 003 | 403; 403/404 | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |

### 3.7 Transactions (Member 4 slice — Owner Pramudith)

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-TXN-01 | POST /api/transactions/deposits | agent_c1 | `$CH`, account 003, hours open. Note balance B0 (API-ACC-12) | `curl -s -b agent.txt -H "x-csrf-token: $(csrf agent.txt)" -H 'Idempotency-Key: dep-acc3-0001' -H 'Content-Type: application/json' -d "{\"accountId\":\"00000000-0000-0000-0801-000000000003\",\"amount\":\"2500.00\",\"channelId\":\"$CH\",\"narration\":\"Cash deposit\"}" $BASE/api/transactions/deposits` | 201; `balanceAfter` = B0 + 2500.00; reference `DEP-…`/unique. SQL: new `transaction` DEPOSIT with `balance_after`, `account.current_balance` updated, `audit_log` action `DEPOSIT` | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-post-deposit.test.mjs`; API test is a placeholder) | Pramudith | Vibodha | Not run | Route implemented by Selith on Pramudith's behalf; `sp_post_deposit` by Pramudith. Save `DEP_TXN`. `agent_id` will be NULL (F-10) |
| API-TXN-02 | POST /api/transactions/deposits | agent_c1 | API-TXN-01 done | Repeat exactly | **200**, same `transactionId`; balance moved once (SQL count of rows with that key = 1) | Postman/curl + SQL | Partially covered (DB level only: `tests/db/transaction-reference-idempotency.test.mjs`) | Pramudith | Vibodha | Not run | Implemented by Selith (route) on Pramudith's behalf |
| API-TXN-03 | POST /api/transactions/deposits | agent_c1 | | Same key `dep-acc3-0001`, amount `9999.00` | Should be 409/422 (key reused with different body) | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Known issue — likely Fail: returns 200 with old reference and new amount (F-04) |
| API-TXN-04 | POST /api/transactions/deposits | agent_c1 | | No key; amount `25`; amount `-5.00`; amount `0.00`; bad uuid account | 400 `MISSING_IDEMPOTENCY_KEY`; 400; 400; 400/409; 400 | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf |
| API-TXN-05 | POST /api/transactions/deposits | agent_k1; auditor; agent_c1 w/o CSRF | | Deposit to account 003 | 404 `ACCOUNT_NOT_FOUND`; 403; 403 — no balance change | Postman/curl + SQL | Manual only | Pramudith | Vibodha | Not run | Cross-branch blocked by account RLS |
| API-TXN-06 | POST /api/transactions/deposits | agent_c1 | ADMIN sets `BUSINESS_HOUR_END` to a time already past today (e.g. `00:01`) | New key deposit; then restore hours | 409 `OUTSIDE_BUSINESS_HOURS`; no ledger row | Postman/curl + SQL | Partially covered (DB level only: `tests/db/business-hours-limits.test.mjs`) | Pramudith | Vibodha | Not run | Restore hours immediately |
| API-TXN-07 | POST /api/transactions/withdrawals | agent_c1 | Account 003 balance ≥ 1100 | `-H 'Idempotency-Key: wd-acc3-0001' -d "{\"accountId\":\"…0801-000000000003\",\"amount\":\"100.00\",\"channelId\":\"$CH\",\"onBehalfOfCustomerId\":\"00000000-0000-0000-0501-000000000003\"}"` | 201; balance −100.00; SQL: WITHDRAWAL row with `agent_id` = agent_c1; `audit_log` `WITHDRAWAL` | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-post-withdrawal.test.mjs`; API test is a placeholder) | Pramudith | Nisith | Not run | **Known issue — expected Fail: 500 `UNEXPECTED_DB_ERROR` (F-01, reproduced 42725).** Implemented by Selith on Pramudith's behalf. If it fails, rows 08–13 are Blocked |
| API-TXN-08 | POST /api/transactions/withdrawals | agent_c1 | Same | Repeat API-TXN-07 exactly | 200 same `transactionId`, balance moved once | Postman/curl | Partially covered (DB level only) | Pramudith | Nisith | Not run | Blocked by F-01 |
| API-TXN-09 | POST /api/transactions/withdrawals | agent_c1 | Account 002 (Teen, min 500) balance B | Withdraw B − 400.00 (leaves 400) | 409 `BELOW_MINIMUM_BALANCE`; no ledger row; rejection audit row | Postman/curl + SQL | Partially covered (DB level only: `tests/db/fn-check-plan-minimum.test.mjs`, `sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01; rejection audit missing (F-06) |
| API-TXN-10 | POST /api/transactions/withdrawals | agent_c1 | Account 003 | Amount = balance + 1.00 | 409 `INSUFFICIENT_FUNDS`; balance unchanged | Postman/curl | Partially covered (DB level only) | Pramudith | Nisith | Not run | Blocked by F-01 |
| API-TXN-11 | POST /api/transactions/withdrawals | agent_c1 | Account with ≥ 101,000 (deposit first if needed) | Amount `100000.01` | 409 `LIMIT_EXCEEDED` | Postman/curl | Partially covered (DB level only: `tests/db/business-hours-limits.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01 |
| API-TXN-12 | POST /api/transactions/withdrawals | bm_kandy | Seed joint 006 ALL_HOLDERS (08, 09, 10) | Withdraw `100.00` on behalf of customer 08 | 409 `MANDATE_NOT_SATISFIED` (needs all holders) | Postman/curl | Partially covered (DB level only: `tests/db/fn-check-withdrawal-mandate.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01; API cannot send several signers (F-05) |
| API-TXN-13 | POST /api/transactions/withdrawals | customer_adult_one | Account 003 (own) | Withdraw `50.00` | 201 (customer self-service) | Postman/curl | Manual only | Pramudith | Nisith | Not run | Known issue — likely Fail (F-01, F-05) |
| API-TXN-14 | POST /api/transactions/withdrawals | agent_k1 | | Withdraw from account 003 | 404/409 not authorized; no change | Postman/curl | Partially covered (DB level only) | Pramudith | Nisith | Not run | Blocked by F-01 |
| API-TXN-15 | GET /api/accounts/{id}/transactions | agent_c1 | After API-TXN-01 | `curl -s -b agent.txt "$BASE/api/accounts/00000000-0000-0000-0801-000000000003/transactions?page=1&pageSize=5"` | 200 `{data:[…], meta:{page:1,pageSize:5,total:N}}`; newest first; includes `DEP_TXN` with its `balanceAfter` | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf |
| API-TXN-16 | GET /api/accounts/{id}/transactions | agent_k1; central_ops; agent_c1 | | 003 as agent_k1; as central_ops; agent_c1 with `?page=abc` | Should be 404; 403 or 200 by design; 400 | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Known issue — 400 for not-found and 500 for `page=abc` (F-15); CENTRAL_OPS is blocked by the service |
| API-TXN-17 | GET /api/transactions/{id} | agent_c1 | `DEP_TXN` | Call | 200; fields match the DB row; `isReversed:false` | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf |
| API-TXN-18 | GET /api/transactions/{id} | agent_k1; customer (Kandy txn) | `DEP_TXN` is a Colombo transaction | Call `DEP_TXN` as agent_k1 | Should be 404 (out of scope) | Postman/curl | Manual only | Pramudith | Vibodha | Not run | **Known issue — likely Fail: 200 with full data (F-03)** |
| API-TXN-19 | POST /api/transactions/{id}/reverse | agent_c1 | `DEP_TXN` | `-d '{"reason":"test"}'` with CSRF | 403 | Postman/curl | Covered by existing test (`tests/api/reversal.test.mjs`) | Pramudith | Vibodha | Not run | Route auth by Nadija |
| API-TXN-20 | POST /api/transactions/{id}/reverse | bm_colombo | `DEP_TXN` (2500.00 deposit), balance Bx | `curl -s -b bm.txt -H "x-csrf-token: $(csrf bm.txt)" -H 'Content-Type: application/json' -d '{"reason":"Posted to wrong account"}' $BASE/api/transactions/$DEP_TXN/reverse` | 201; `balanceAfter` = Bx − 2500.00. SQL: original row unchanged; new REVERSAL row; `transaction_reversal` link; `audit_log` `REVERSED` | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-reverse-transaction.test.mjs`) | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf. Reversal reference not returned (F-16) |
| API-TXN-21 | POST /api/transactions/{id}/reverse | bm_colombo | API-TXN-20 done | Reverse `DEP_TXN` again; reverse the REVERSAL row id | 409 `ALREADY_REVERSED`; 409 (cannot reverse a reversal) | Postman/curl | Partially covered (DB level only) | Pramudith | Vibodha | Not run | |
| API-TXN-22 | POST /api/transactions/{id}/reverse | bm_colombo | | Reason `""`; reason 300 chars; id `xyz` | 400; should be 400 (500 likely); should be 400 (500 likely) | Postman/curl | Partially covered (`tests/api/reversal.test.mjs`) | Pramudith | Vibodha | Not run | |
| API-TXN-23 | POST /api/transactions/{id}/reverse | bm_kandy | A **new** Colombo deposit `DEP_TXN2` (repeat API-TXN-01 with key `dep-acc3-0002`) | Reverse `DEP_TXN2` as bm_kandy; then SQL D-1 check on account 003 | Should be 403/404 and **no** ledger row | Postman/curl + SQL | Manual only | Pramudith | Vibodha | Not run | **Known issue — Critical F-02:** expect 201, a REVERSAL row with `balance_after` NULL and an unchanged balance. Run on a disposable DB or reset afterwards; reconciliation will show the mismatch |

### 3.8 Interest request

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-INT-01 | POST /api/interest-runs | central_ops | | `curl -s -b co.txt -H "x-csrf-token: $(csrf co.txt)" -H 'Content-Type: application/json' -d '{"cycleDate":"2026-10-09","dryRun":true}' $BASE/api/interest-runs` | 200 `{status:"STARTED"}`; SQL: 1 `audit_log` row `INTEREST_RUN_INITIATED`; **no** new `interest_run` row | Postman/curl + SQL | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Selith | Not run | Route does not run the cycle (by current design) |
| API-INT-02 | POST /api/interest-runs | worker | `INTEREST_WORKER_TOKEN` from your `.env` | No cookie jar; `-H "Authorization: Bearer $INTEREST_WORKER_TOKEN"` | 200; audit row with `actor_type` SYSTEM | Postman/curl | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Selith | Not run | |
| API-INT-03 | POST /api/interest-runs | agent_c1; worker bad token; central_ops | | agent_c1 valid body; Bearer `wrong`; CO body `{"cycleDate":"x"}` | 403; 401; 400 | Postman/curl | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Selith | Not run | |

### 3.9 Reports

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-RPT-01 | GET RPT-01 | central_ops | | `curl -s -b co.txt "$BASE/api/reports/agent-transactions?from=2026-01-01&to=2026-12-31"` | 200; rows per agent/branch; `grandTotal`; `exclusions`. SQL: `audit_log` `REPORT_ACCESSED` | Postman/curl + SQL | Covered by existing test (`tests/api/rpt01-report.test.mjs`) | Vibodha | Nisith | Not run | |
| API-RPT-02 | GET RPT-01 CSV | central_ops | | Same + `&format=csv -o rpt01.csv` | CSV with METADATA, DETAIL, PAGE_SUBTOTAL, GRAND_TOTAL rows; GRAND_TOTAL = JSON `grandTotal` | Postman/curl | Covered by existing test (`tests/api/rpt01-report.test.mjs`) | Vibodha | Nisith | Not run | |
| API-RPT-03 | GET RPT-01 | bm_colombo; agent_c1 | | BM with `&branchId=…0102` (Kandy); agent | 403; 403 | Postman/curl | Covered by existing test (`tests/api/rpt01-report.test.mjs`) | Vibodha | Nisith | Not run | |
| API-RPT-04 | GET RPT-02 | auditor | | `?from=2026-01-01&to=2026-12-31&status=ACTIVE` and `&format=csv` | 200; per-account opening/closing balance; CSV totals = JSON totals | Postman/curl | Covered by existing test (`tests/api/rpt02-report.test.mjs`) | Nisith | Pramudith | Not run | |
| API-RPT-05 | GET RPT-02 | bm_colombo | | No branch, then `branchId` Kandy | Only Colombo accounts; 403 | Postman/curl | Covered by existing test (`tests/api/rpt02-report.test.mjs`) | Nisith | Pramudith | Not run | |
| API-RPT-06 | GET RPT-03 | central_ops | Seed has 10 active FDs | `curl -s -b co.txt "$BASE/api/reports/active-fds"` | 200; ACTIVE FD rows with `next_interest_date`, `estimated_next_payout`; `REPORT_ACCESSED` audit | Postman/curl | Manual only | Selith | Nadija | Not run | |
| API-RPT-07 | GET RPT-03 | none; agent_c1 | | Call without cookie; as agent | Should be 401; 403 | Postman/curl | Manual only | Selith | Nadija | Not run | **Known issue — likely Fail: 500 (F-09)** |
| API-RPT-08 | GET RPT-03 | bm_colombo | | `?branchId=…0102` | Should be 403 (out of scope) | Postman/curl | Manual only | Selith | Nadija | Not run | Known issue — returns own branch silently (F-09) |
| API-RPT-09 | GET RPT-04 | central_ops | 3 seeded interest runs | `?from=2026-01-01&to=2026-12-31`; then `&planId=Adult` | 200 rows incl. ROLLUP subtotal rows (NULL keys); `total_interest` = SQL `SUM(interest_amount)` from `interest_payout` | Postman/curl + SQL | Manual only | Selith | Nadija | Not run | `planId` takes a plan name (F-09) |
| API-RPT-10 | GET RPT-04 CSV | central_ops | | `&format=csv` | CSV totals equal JSON totals | Postman/curl | Manual only | Selith | Nadija | Not run | Known issue — total rows may be blank (F-09) |
| API-RPT-11 | GET RPT-05 | central_ops | | `?from=2026-01-01&to=2026-12-31&sort=net` | 200; one row per customer; net = deposits + interest − withdrawals; joint activity counted per holder | Postman/curl | Covered by existing test (`tests/api/rpt05-report.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Nadija on Pramudith's behalf |
| API-RPT-12 | GET RPT-05 CSV | central_ops | More than 25 customers in result (seed has 15 — use `pageSize=5`) | `&pageSize=5&format=csv` | CSV should contain **all** filtered customers | Postman/curl | Manual only | Pramudith | Nisith | Not run | Known issue — exports current page only (F-14). Implemented by Nadija on Pramudith's behalf |
| API-RPT-13 | GET RPT-05 | bm_colombo; agent_c1 | | BM with `branchId` Kandy; agent | 403; 403 | Postman/curl | Covered by existing test (`tests/api/rpt05-report.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Nadija on Pramudith's behalf |

### 3.10 Cross-cutting backend checks

| Test ID | Endpoint | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-SEC-01 | all POST/PATCH/PUT | any | | For each state-changing endpoint in §1, send without `x-csrf-token`, and with a different 64-hex token | 403 `FORBIDDEN` every time; no DB change | Postman/curl | Partially covered (`tests/api/authorization.test.mjs` + per-feature tests) | Nadija | Selith | Not run | Use the Postman collection runner |
| API-SEC-02 | all GET with filters | various | | Put `' OR '1'='1`, `1;DROP TABLE x`, `%27` into every text/search/sort parameter | 400 or empty result; never 500 with SQL text; tables intact | Postman/curl | Manual only (P06-M01-T01 is TODO) | Nadija | Selith | Not run | Code review found no unsafe SQL (06 §8) |
| API-SEC-03 | all | various | | Trigger errors (bad uuid, missing fields, unknown ids) on each endpoint | Error body has only `code` + `message`; no stack, SQL, table names or hashes | Postman/curl | Partially covered | Nadija | Selith | Not run | P0001 raw text and NOT NULL column names may leak (07, F-20) |
| API-SEC-04 | role × route matrix | all 7 roles | | For each endpoint in §1, call with each role's jar | Response matches the "Auth / roles" column (403 otherwise) | Postman/curl | Manual only (P06-M01-T02 is TODO) | Nadija | Selith | Not run | Record as a matrix in the tracker Notes |
| API-SEC-05 | any | — | | `curl -I $BASE/sign-in` | Headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (HSTS only in production) | Postman/curl | Covered by existing test (`tests/security/deployment-security.test.mjs`) | Nadija | Selith | Not run | |
| API-SEC-06 | money endpoints | agent_c1 | | Two parallel deposits with **different** keys to the same account (`curl … & curl … & wait`) | Both 201; final balance = start + both amounts; `ledger_seq` consecutive | Postman/curl + SQL | Partially covered (DB level: `tests/db/concurrent-withdrawals.test.mjs` mixes deposits) | Pramudith | Vibodha | Not run | Deposit route by Selith on Pramudith's behalf; `sp_post_deposit` by Pramudith |
| API-SEC-07 | money endpoints | agent_c1 | | Two parallel deposits with the **same** key | Exactly one ledger row; both responses carry the same `transactionId` (one 201, one 200) or one 409 | Postman/curl + SQL | Partially covered (DB level: `tests/db/transaction-reference-idempotency.test.mjs`) | Pramudith | Vibodha | Not run | Unique index is the final guard. Deposit route by Selith on Pramudith's behalf |
