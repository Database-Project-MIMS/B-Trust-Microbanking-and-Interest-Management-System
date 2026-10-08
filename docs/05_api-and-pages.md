# 05 — API and Pages

Endpoint contracts and the page-to-API map.

## Database health — Member 4

`GET /api/health` validates the real `mims_session` before querying health. Missing,
forged, expired or revoked sessions receive `401` without database details. Any valid
role receives `{ data: { status: 'ok' } }`; ADMIN/CENTRAL_OPS additionally receive
`db: { connected, poolTotal, poolIdle, poolWaiting }`, numeric `migrationsApplied`,
`lastMigration` and `uptimeSeconds`. Database failures return a safe `503` error envelope.
The route calls `services/health-service.ts`; it contains no SQL.

`/admin/health` checks ADMIN/CENTRAL_OPS on the server before loading data. `/admin/parameters`
and its GET/PUT APIs are ADMIN-only; edits require a valid 64-character hex CSRF token.
Invalid values return `400`, unknown parameter keys `404`, and the update plus trigger
audit execute in one locked transaction.

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
- **CSRF protection** JSON requests only; a supplied Origin must match the request origin.
- **Body** `{ username, password }`
- **Validation** both present; username ≤ 100 chars
- **SQL** select the user and role from `app_user`/`role`, and `LEFT JOIN agent ON agent.agent_id = app_user.user_id` to obtain `branchId`; on success `INSERT INTO user_session`; always `INSERT INTO login_attempt`
- **Transaction** single transaction: session insert + attempt log + `last_login` update
- **Session lifetime** The cookie expires at the configured absolute limit. The server
  enforces and refreshes the configured inactivity deadline, capped by that absolute limit.
- **Success** `200 { data: { user: { id, username, role, branchId } } }` + `Secure`/`HttpOnly`/`SameSite=Lax` cookie
- **Errors** `401 INVALID_CREDENTIALS` — **identical message whether or not the username exists** (FR-AUTH-03); `429 TOO_MANY_ATTEMPTS`
- **Page** `/sign-in`

### `POST /api/auth/logout`
- **Roles** any authenticated · **SQL** `UPDATE user_session SET revoked_at = now() WHERE session_id = $1` · **Success** `204`
- Server-side invalidation, not just cookie clearing (FR-AUTH-04).

---

## Organisation — Member 2

`AGENT` and `BRANCH_MANAGER` users both have an `agent` branch-staff profile. The role
controls permissions; `agent.branch_id` supplies branch scope. Agent-management endpoints
below manage ordinary `AGENT` users only. A branch-manager login is created through the
admin identity workflow and must atomically receive its required `agent` profile.

| Method & path | Purpose | Roles | Notes |
|---|---|---|---|
| `GET /api/branches` | List branches | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | Branch managers see only their own branch |
| `POST /api/branches` | Create branch | ADMIN | `409 DUPLICATE_BRANCH_CODE` on `23505` |
| `PATCH /api/branches/{id}` | Update / deactivate | ADMIN | Never deletes (FR-ORG-05) |
| `GET /api/agents` | List ordinary agents | ADMIN, CENTRAL_OPS, BRANCH_MANAGER | Scoped by branch; joins `role` and returns `role_name = 'AGENT'` only |
| `POST /api/agents` | Create ordinary agent + linked user | ADMIN, BRANCH_MANAGER | **One transaction**: `app_user` with server-assigned `AGENT` role + `agent` + audit; the request cannot choose its role |
| `PATCH /api/agents/{id}` | Update / deactivate / transfer an ordinary agent | ADMIN, BRANCH_MANAGER | Restricted to `role_name = 'AGENT'`; transfer is effective-dated so history stays attributable (FR-ORG-04) |
| `GET /api/agents/{id}/activity` | Daily/range counts and amounts by type | ADMIN, CENTRAL_OPS, BRANCH_MANAGER (own branch), AGENT (self) | Live T02; manager totals also filter the captured posting branch |

### Branch API contract

- `GET /api/branches?status=ACTIVE|INACTIVE|SUSPENDED` applies the caller's branch scope
  in the SQL `WHERE` clause. The status filter is optional.
- `POST /api/branches` body is
  `{ branchCode, branchName, address, district, phone }`. `branchCode` is the stable
  business identifier and is not changed through `PATCH`.
- `PATCH /api/branches/{id}` accepts any non-empty subset of
  `{ branchName, address, district, phone, status }`. A branch with active staff cannot
  be deactivated (`409 BRANCH_HAS_ACTIVE_AGENTS`).
- Duplicate codes return `409 DUPLICATE_BRANCH_CODE`. No branch `DELETE` handler exists.

### Agent API contract

- `GET /api/agents?status=ACTIVE|INACTIVE|SUSPENDED` returns ordinary `AGENT` profiles
  only. `BRANCH_MANAGER` profiles are excluded by the joined role predicate, and manager
  branch scope is enforced in SQL.
- `POST /api/agents` accepts login fields `{ username, password }` and the profile fields
  `{ branchId?, employeeNo, nicPassportNo, fullName, dateOfBirth, gender, phone,
  address, email, hiredDate }`. `branchId` is required for `ADMIN`; for
  `BRANCH_MANAGER` it is forced to the caller's own branch. The service selects the
  `AGENT` role itself and never accepts a role from the request.
- `PATCH /api/agents/{id}` accepts profile fields plus `status`. Deactivation updates
  both `agent.status` and `app_user.status` in the same transaction so the login is also
  disabled. Only `ADMIN` may transfer an agent to another branch.
- Duplicate employee number, identity, email and username return specific `409` codes.
  Cross-branch mutation returns `403`; missing rows return `404`. No agent `DELETE`
  handler exists.
- Branch and agent inserts/updates are audited by database triggers in the caller
  transaction. A failed agent profile insert rolls back the linked `app_user` and all
  audit effects. Sensitive password/token/identity fields are excluded from audit JSON.

### Agent daily activity — P03-M02-T02

`GET /api/agents/{id}/activity?from=YYYY-MM-DD&to=YYYY-MM-DD` accepts only these
two optional, non-repeated query keys. Real calendar dates and UUIDs are validated.
Both omitted dates default to today in Asia/Colombo; one supplied date selects that
single day. Reversed ranges are rejected. Both dates are inclusive: parameterized
SQL uses Colombo midnight through, but excluding, midnight after `to`, so the indexed
`transaction_date` remains uncast and the connection timezone cannot change totals.

Success: `{ data: { agentId, from, to, timeZone: "Asia/Colombo", scope,
agent: { fullName, employeeNo, branchCode, branchName },
byType: [{ type, count, total }] } }`. `count` is an integer number; `total` is an exact
decimal string produced by PostgreSQL SUM, never JavaScript money arithmetic.
Types are the recorded DEPOSIT/WITHDRAWAL/INTEREST_CREDIT/REVERSAL values, ordered by
type; an empty period returns `byType: []`. Totals do not represent net balances.

`getAgentActivity` revalidates the stored active caller role/profile and uses a
read-only REPEATABLE READ transaction with transaction-local RLS identity. ADMIN and
CENTRAL_OPS have bankwide access; AGENT only itself, across its attributed history.
BRANCH_MANAGER must target a current own-branch ordinary agent and only receives
rows with `transaction.branch_id = caller.branchId`. NULL branch attribution is
excluded for managers; NULL agent attribution is excluded for everyone. A transfer
cannot expose old-branch amounts to the new manager. Inactive ordinary agents remain
reportable to authorized managers/bankwide users; inactive callers lose access.
AUDITOR/CUSTOMER are denied. No identifiers or branch scope are accepted from the query.
Malformed inputs return 400; absent/expired/revoked sessions 401; role/self/branch
violations 403; unknown/non-ordinary targets 404. Success uses `private, no-store`.

Live `/agents/{id}/activity` provides date filters, a Today action, loading, empty,
safe error and retry states. Agent names in `/agents` link to their activity; AGENT
has a My daily activity link in `/customers`. No prototype records or posting action.
Migration 0320 is reused; this task adds no migration. M4/M3 producer adoption is
still needed for previously unattributed postings; no historical backfill is inferred.
[Decision and review](../.agent/handoffs/p03-m02-agent-daily-activity.md).

### `POST /api/customers`
**Implemented in P02-M02-T05:** session-authenticated, role/branch scoped and CSRF-protected.

- **Purpose** Register a customer (FR-CUS-01…05).
- **Roles** AGENT, BRANCH_MANAGER
- **Body** `{ fullName, nicPassportNo, dateOfBirth, gender, phone, address, email, branchId, agentId, documents[] }`
- **Validation** NIC/passport format; `dateOfBirth` in the past; email format; `branchId` within the caller's scope
- **SQL / routine** one transaction: `INSERT customer` (M1's trigger inserts one sanitized audit) → `INSERT customer_document` (each) → `INSERT customer_agent (is_active = true)`
- **Transaction** all four, atomic (§4.3: "Customer, documents, assignment and audit event are inserted in one database transaction")
- **Success** `201 { data: { customerId, customerNumber } }`
- **Errors** `400` invalid JSON/strict fields; `401` invalid session; `403` role/branch/assignment/CSRF denied; `409 DUPLICATE_IDENTITY` (unique `nic_passport_no`), `409 DUPLICATE_EMAIL`; safe `500` for unexpected failures
- **Page** `/customers/new`

| `GET /api/customers` | Search by name, NIC, branch, agent | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | Trigram index on `full_name`; NIC/email masked for branch staff (FR-CUS-04); fixed sort-column allow-list |
| `GET /api/customers/{id}` | Profile with accounts and assignment history | as above; CUSTOMER for self only | RLS enforces self-access |

Search query keys: `q`, `name`, `nicPassportNo`, `branchId`, `agentId`, `status`,
`sortBy` (fullName/customerNumber/createdAt), `sortDirection` (asc/desc), `page` (1–100000)
and `pageSize` (1–100, default 25). Numeric query strings are parsed by the controller;
unknown/repeated keys and invalid identifiers return 400. Result: `{ data: { customers,
total, page, pageSize } }`. Missing and inaccessible profiles both return 404.

Live screens: `/customers` has scoped named branch/agent filters, sorting, pagination,
loading/error/empty states and profile links. `/customers/new` uses the session branch,
active agent options and zero to twenty document references, then navigates to the created
profile. `/customers/{id}` shows identity, all assignment history, safe document verification
metadata and real account-holder links. Registration does not upload files, verify documents
or provision customer logins. Page guards mirror route roles; server checks remain authoritative.

---

### Customer-document internal service (P02-M02-T03, implemented)

`verifyDocument(docId, verifierUserId)` in services/customer-document-service.ts is
server-only; no document verification endpoint is introduced in this schema task.
Future controllers must authenticate/authorize, verify CSRF and pass the session's
user ID as verifierUserId. Active AGENT/BRANCH_MANAGER staff can verify active
customers in their own branch; an AGENT also needs the current customer assignment.
The service rechecks these conditions in SQL and locks the relevant rows. Verification
and minimal audit commit/rollback together. A same-verifier retry returns the original
{ docId, customerId, verifiedBy, verifiedDate }; another verifier gets
DOCUMENT_ALREADY_VERIFIED (409). UUID validation, forbidden and not-found use typed
400/403/404 errors. No path/document content is returned. T05 adds scoped child SELECT/INSERT
in 0223, but no UPDATE grant or verification endpoint. Review also
found that this pre-existing verifier locks `role` with `FOR SHARE`, requiring a write
privilege absent from the runtime role. Resolve that lock scope before exposing it;
do not grant broad role-update access to work around the issue.

### Customer registration/read services (P02-M02-T04, implemented)

`services/customer-service.ts` exports `registerCustomer(input, actor)`,
`searchCustomers(input, actor)` and `getCustomerProfile(customerId, actor)`.
`actor` is authenticated `{ userId, roleName, branchId }` context, never body-selected.
Services recheck current active user/role/staff/branch state. Registration permits
AGENT self-assignment or a BRANCH_MANAGER selecting an active ordinary agent in its
branch. Customer, zero to twenty unverified document metadata rows, exactly one active
assignment and one sanitized customer-trigger audit commit together. Identity is uppercase;
email lowercase; numbers follow ADR-0014. Typed duplicate errors map to 409 responses.

Search accepts q/name/NIC/branch/agent/status, fixed sortBy/sortDirection, page and
pageSize (maximum 100). Controllers parse numeric query strings. SQL predicates
restrict AGENT to assigned customers and managers to their branch; CENTRAL_OPS/AUDITOR
are bank-wide. CUSTOMER reads only its optional-login-linked profile and cannot search.
Staff NIC/email are masked; documents omit paths. Profiles include all assignment
history. The merged M3 account_holder relation supplies account links (empty array when
none exist), with account branch scope and string balances. The null fallback is retained
for incomplete schemas. Reads use repeatable-read transactions; `setRlsContext` supplies
transaction-local user, role and branch from revalidated database state.

T04's historical 181-test service evidence: [T04 handoff](../.agent/handoffs/p02-m02-t04-customer-registration.md).
T05 route/runtime/screen integration and security handoff:
[T05 handoff](../.agent/handoffs/p02-m02-t05-customer-api-ui.md).

## Plans and accounts — Member 3

| Method & path | Purpose | Roles |
|---|---|---|
| `GET /api/plans` | Savings plans with rates, minimums, eligibility | any authenticated |
| `PATCH /api/plans/{id}` | Update plan rate/minimum/description/status/eligibility (in-place, not effective-dated — unlike `fd_plan`, `savings_plan` has no `effective_from`/`effective_to`) | ADMIN, CENTRAL_OPS |
| `GET /api/fd-products` | FD products (M5) | any authenticated |

### `POST /api/accounts`
- **Purpose** Open an individual or joint savings account (FR-ACC-01…04).
- **Roles** AGENT, BRANCH_MANAGER · CSRF required
- **Headers** `Idempotency-Key` (**required**, 8–80 chars of `A–Z a–z 0–9 _ -`)
- **Body** `{ planId, branchId, holders: [{ customerId, holderType: "PRIMARY"|"JOINT" }] (1–4, exactly one PRIMARY), mandate?: { type: "ANY_ONE"|"ALL_HOLDERS", requiredSignatories? }, initialDeposit?: "1500.50" }` — strict; `initialDeposit` is a **string** (a JSON number is rejected). `branchId` must equal the caller's branch (ADR-0008) or `403`. An AGENT may open only for customers actively assigned to them (otherwise `409 HOLDER_NOT_FOUND`, which also hides whether the customer exists). The deposit channel is chosen by the server (`BRANCH_COUNTER`), never by the client.
- **Validation** plan active; holder count within the plan's range; primary applicant eligible by age; every holder active with a verified document; joint plans need a mandate; `initialDeposit ≥ plan.min_balance`, positive, two decimals, business hours only
- **SQL routine** `CALL sp_open_savings_account(...)` (migration 0243); the service wraps it in one transaction and writes the `account_opening_request` row in the same transaction
- **Transaction** account + holders + mandate + optional initial deposit ledger row + balance + audit + idempotency record — **all atomic**
- **Idempotency** a repeated key from the same user with the same request returns **`200`** with the original `{ accountId, accountNumber, currentBalance }` and no second account or credit; the same key with a different request → `422 IDEMPOTENCY_KEY_REUSED`; a failed open stores no key
- **Success** `201 { data: { accountId, accountNumber, currentBalance } }` (money as a string)
- **Errors** `400 VALIDATION_FAILED` (body or header) · `401` · `403` (role, CSRF, other branch, `AGENT_NOT_ELIGIBLE`) · `409 PLAN_ELIGIBILITY_FAILED` · `409 BELOW_MINIMUM_BALANCE` · `409 INVALID_HOLDER_COUNT` · `409 MANDATE_REQUIRED` · `409 MANDATE_NOT_ALLOWED` · `409 INVALID_MANDATE_SIGNATORIES` · `409 DOCUMENTS_NOT_VERIFIED` · `409 HOLDER_NOT_FOUND` · `409 UNDERAGE_HOLDER` · `409 OUTSIDE_BUSINESS_HOURS` (deposit only) · `409 CHANNEL_UNAVAILABLE` · `409 DUPLICATE_HOLDER` · `422 PLAN_NOT_FOUND` · `422 INVALID_MANDATE_TYPE` · `422 INVALID_DEPOSIT_AMOUNT` · `422 INVALID_HOLDERS_PAYLOAD` · `422 IDEMPOTENCY_KEY_REUSED`. The routine raises `P0001` with a named constraint; the service translates it inside the transaction (`services/account-errors.ts`) so no ids or SQL text reach the client; an actor mismatch is a service bug → `500`
- **Page** `/accounts/new`

### `GET /api/accounts`
- **Roles** AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR. Branch roles are limited to their branch in the query and by RLS; an **AGENT sees only accounts with a holder actively assigned to them** (as in the customer API); a different `branchId` filter → `403`
- **Query** `q` (account number, holder name or customer number), `status`, `planId`, `branchId`, `sortBy` (`accountNumber|openedDate|currentBalance|status`), `sortDirection`, `page`, `pageSize` (≤ 100); repeated or unknown parameters → `400`
- **Success** `200 { data: { accounts: [{ accountId, accountNumber, status, currentBalance, openedDate, branchId, planId, planName, holderCount, primaryHolderName }], total, page, pageSize } }`

### `GET /api/accounts/{id}`
- **Roles** AGENT (assigned customers' accounts only), BRANCH_MANAGER, CENTRAL_OPS, AUDITOR; CUSTOMER only if a holder
- **Success** `200 { data: { ...summary, minBalance, minHolders, maxHolders, availableToWithdraw, lastTransaction: { transactionType, amount, transactionDate, referenceNumber } | null, holders: [{ accountHolderId, customerId, customerNumber, fullName, holderType, joinedDate }], mandate: { mandateType, requiredSignatories, effectiveFrom, effectiveTo, state: "EFFECTIVE"|"NOT_YET_EFFECTIVE"|"EXPIRED" } | null } }`. `availableToWithdraw` is `max(0, currentBalance − minBalance)` computed in SQL (string, `NUMERIC(15,2)`); `lastTransaction` is the newest ledger row (no user ids) or `null`; `mandate.state` compares the effective dates with the Asia/Colombo calendar date (P03-M03-T03). A CUSTOMER sees only their own holder entry (row-level security); `holderCount` still shows the true total. FD panel arrives in Phase 4.
- **Errors** an account outside the caller's scope → uniform `404 NOT_FOUND`

### `POST /api/accounts/{id}/holders`
- **Purpose** Add a joint holder to an existing account (`CALL sp_add_account_holder`, migration 0245).
- **Roles** BRANCH_MANAGER of the owning branch · CSRF required · **Body** `{ customerId }` (strict)
- **Rules** account ACTIVE; customer active with a verified document; the 0242 trigger enforces holder count and adult holders and sets an `ALL_HOLDERS` mandate's signatories to the new holder count (changing a mandate's type is not supported)
- **Success** `201 { data: { accountHolderId, holderCount, mandate: { mandateType, requiredSignatories } | null } }`
- **Errors** `404` (account outside scope) · `409 ACCOUNT_NOT_ACTIVE` · `409 INVALID_HOLDER_COUNT` · `409 UNDERAGE_HOLDER` · `409 DOCUMENTS_NOT_VERIFIED` · `409 HOLDER_NOT_FOUND` · `409 DUPLICATE_HOLDER`

### `POST /api/accounts/{id}/close`
- **Roles** BRANCH_MANAGER · CSRF required · **Currently `501 NOT_IMPLEMENTED`** (stub). The rule (zero balance, no active FD, BR-18) is Phase 4 (`sp_close_account`).

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
- **SQL routine** Future service uses `CALL sp_try_post_withdrawal(...)` (0363), with trusted signer IDs as `uuid[]`; its core `sp_post_withdrawal` takes `FOR UPDATE`, then re-validates status, calendar/hours, mandate, configured Colombo-day limits and post-withdrawal minimum **inside** the transaction. The legacy single-customer overload is retained.
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter } }`
- **Errors** `409 INSUFFICIENT_FUNDS` · `409 BELOW_MINIMUM_BALANCE` · `409 MANDATE_NOT_SATISFIED` · `409 LIMIT_EXCEEDED` · `409 ACCOUNT_NOT_ACTIVE`
- **Note** A known financial rejection returns `p_rejection_code` and writes one audit event with **no ledger row** (FR-WD-05). Commit the audit-only result through withTransaction, then map the allow-listed error outside the transaction. An exception inside that transaction would roll back its audit too. Unexpected errors roll back every effect. T05 API/CSRF/service/signer-evidence integration remains planned; no live withdrawal route is added by this correction.
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

**RPT-01 live delivery (2026-10-08, ADR-0022):**
`GET /api/reports/agent-transactions` and `/reports/agent-transactions` consume I-7.
Allowed roles: BRANCH_MANAGER (current own branch), ADMIN, CENTRAL_OPS, AUDITOR.
Strict query keys: `from`, `to` (real ordered inclusive Colombo dates; one implies a
single day, absent defaults today), `branchId`, `agentId` (UUIDs), `format=json|csv`,
`page` (1–1,000,000), `pageSize` (1–100, default25), `sort=employeeNo|agentName|netTotal`,
`direction=asc|desc`. Unknown/repeated keys are rejected. Explicit foreign manager
branch returns403. Stored active identity and role/profile/branch are revalidated
inside the service transaction and guarded again by 0521 SQL readers.

JSON `{data}` contains `reportName`, `rows`, `subtotals` (current page), `grandTotal`
(all applied filters), effective `filters`, `generatedAt`, `requestedBy`, `totalRows`,
`page`, `pageSize`, `timeZone`, `scopeLabel`, `exclusions` and `notes`. Detail/count/
money fields are exact strings; detail net is NULL and aggregate net `UNRESOLVED`
when any legacy reversal lacks a valid original link. Rows preserve captured
posting branch and inactive/transferred history. NULL-agent exclusions cover the
selected branch/date scope independently of agent selection, never inferred attribution.

CSV uses the same materialized aggregate snapshot/order and SQL totals, exports all
filtered detail rows, and records fixed-width HEADER/METADATA/DETAIL/PAGE_SUBTOTAL/
GRAND_TOTAL records. Metadata contains applied filters, UTC generation time, user and
notes/exclusions. Signed decimal strings remain exact; quotes/CRLF/formula prefixes
are escaped. Batches spool privately to disk within REPEATABLE READ preparation;
the access audit commits before backpressure-aware delivery. Completion, failure
and cancellation close/remove the spool; network delivery holds no DB transaction.
JSON/CSV and errors are private/no-store. Safe errors:400 validation,401 missing
session,403 role/scope/stale actor,500 unexpected preparation/audit failure.
The page shows named scoped selectors, applied metadata, exact LKR values, explicit
zeros/empty/loading/error/retry states and pagination. Export uses applied filters.
Other report endpoints below remain their owners' contracts.

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
| `/admin/health` | `GET /api/health` | ADMIN, CENTRAL_OPS | M4 |
| `/branches` | `/api/branches` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | M2 |
| `/agents` | `/api/agents` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER | M2 |
| `/agents/{id}/activity` | `GET /api/agents/{id}/activity` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER (own branch), AGENT (self) | M2 (live T02) |
| `/customers`, `/customers/new`, `/customers/{id}` | `/api/customers` | AGENT, BRANCH_MANAGER | M2 |
| `/plans` | `GET /api/plans`, `PATCH /api/plans/{id}` (edit: ADMIN, CENTRAL_OPS) | all staff; read-only except ADMIN/CENTRAL_OPS | M3 (live, T06; no nav link yet — shell is M1's) |
| `/accounts` (list/search), `/accounts/new` (wizard with review step), `/accounts/{id}` (detail, holders, mandate, add holder) | `/api/accounts`, `/api/accounts/{id}`, `/api/accounts/{id}/holders`, `/api/customers` (picker) | list/detail: AGENT (assigned), BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER (detail, own); open: AGENT, BRANCH_MANAGER; add holder: BRANCH_MANAGER | M3 (live, T06) |
| `/transactions/deposit` | `POST /api/transactions/deposits` | AGENT, BRANCH_MANAGER | M4 |
| `/transactions/withdraw` | `POST /api/transactions/withdrawals` | AGENT, BRANCH_MANAGER | M4 |
| `/transactions/{id}` | `GET`, `POST .../reverse` | staff; manager to reverse | M4 |
| `/accounts/{id}/statement` | `GET /api/accounts/{id}/transactions` | staff; CUSTOMER own | M4 |
| `/reconciliation` | `GET /api/reports/reconciliation` | CENTRAL_OPS, AUDITOR | M4 |

The branch and agent pages default to active records and offer an all-records filter.
`ADMIN` can create and deactivate branches. `ADMIN` and `BRANCH_MANAGER` can create and
deactivate ordinary agents; a manager's active-branch selector contains only their scoped
branch. Every mutation sends the login-issued CSRF token and asks for confirmation before
deactivation. Deactivation preserves the record and its history.
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

## Customer fixed deposits — M2 (P04-M02-T01)

GET /api/customers/{id}/fixed-deposits lists all ACTIVE/MATURED/CLOSED FDs linked
through the customer's account_holder rows. Roles: AGENT, BRANCH_MANAGER, CENTRAL_OPS,
AUDITOR, CUSTOMER; ADMIN is outside this customer-profile contract. No query parameters.
Success: { data: { customerId, fixedDeposits: [{ fdId, accountId, accountNumber,
fdPlanId, planName, principalAmount, interestRateAtOpening, startDate, maturityDate,
nextInterestDate, status }] } }. Money/rates are exact decimal strings; dates are
YYYY-MM-DD. Sort: startDate descending, fdId ascending. Empty list is a valid 200.
No co-holder name, identity, branch or document data is returned.

Stored active user/role/profile/branch are revalidated in one read-only REPEATABLE READ
transaction; local RLS context and SQL predicates enforce scope. AGENT: currently
assigned customer and both customer/account in its branch. Manager: both branches
match. CENTRAL_OPS/AUDITOR: bankwide. CUSTOMER: optional-login-linked self. Unknown
and out-of-scope customers use identical 404 NOT_FOUND; invalid UUID/any query→400,
invalid session→401, unsupported role/stale service actor→403; unexpected errors→safe500.
Response Cache-Control: private, no-store. This GET requires no CSRF or idempotency key.

The existing /customers/{id} profile embeds a Fixed Deposits panel with exact principal
and snapshot-rate formatting, dates/status, loading, empty and retry states. It is
independently loaded after an authorized profile; superseded reads are aborted.
No account/FD opening action is added. M5 opening remains a separate integration
dependency; ADR-0018 authorizes this read-side early start using disposable FD fixtures.

P04-M02-T02 completes the M2 customer FD access review (ADR-0019). The endpoint/DTO,
UI and allowed roles are unchanged. 0421 adds a restrictive stored-actor check below
the invoker view, complementing the service's existing identity/SQL scope checks.
Live session reads follow role, branch, assignment and self-link changes on subsequent
requests; session revocation/inactive identity fails closed. COMMIT/ROLLBACK clears
local context on borrowed connections. No JavaScript filtering or broadened FD API.
M5's global FD/report interfaces and M3's account panel retain their own ownership.
