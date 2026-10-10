# 03 — UI Inventory

Every page in `app/**` on `dev`, what it does, who can open it, what it calls and how to
test it. Source of truth: the code (file paths and line numbers given). The test IDs refer
to `04-WORKFLOW-TEST-PLAN.md`.

**Page types**

- **REAL** — calls APIs or server services and changes or reads real data.
- **MOCKUP** — renders `components/mims/workflow-screen.tsx` (or the "Not available yet"
  placeholder) with **hard-coded sample data**. Buttons do nothing. Tested only for
  "loads, navigates, shows the sample data". Marked *Mockup — no backend* in 04.
- **REDIRECT** — immediately sends you to another route.

**Owner** = the member whose slice the feature belongs to (`.agent/ownership-map.md`). The
UI scaffold for most folders, and every mockup screen, was first created by **Nadija**.
Where a different member built the real page, that is shown. Pramudith owns RPT-05 and
reconciliation; both were implemented by Nadija on his behalf (Pramudith unavailable).

---

## 0. How access works (read first)

| Mechanism | File | Behaviour |
|---|---|---|
| No `middleware.ts` | — | Every check happens in a layout or page |
| `workspace-layout` | `components/mims/workspace-layout.tsx:8-12` | Used as `layout.tsx` by `accounts`, `admin`, `customers`, `fixed-deposits`, `interest-runs`, `plans`, `reconciliation`, `reports`, `transactions`. **Only checks that a session exists**; no session → `/sign-in` (no `?next=`). **No role check.** |
| `requirePageRole(...)` | `lib/auth/page-access.ts:7-14` | No session → `/sign-in`; wrong role → `/dashboard`; branch staff without a profile → unhandled error |
| Inline page checks | `app/branches`, `app/agents`, `app/agents/[id]/activity`, `app/fd-products`, `app/reconciliation` | Each page checks the session itself (and sometimes the role) |
| Dashboard layout | `app/dashboard/layout.tsx:7-15` | Session only; no session → `/sign-in?next=/dashboard` |
| Error pages | — | **No** `error.tsx`, `loading.tsx` or `not-found.tsx` anywhere. A server error shows the Next.js default error page; an unknown URL shows the default 404 |

Because `workspace-layout` checks only for a session, **every mockup page, and
`/admin/audit`, opens for any signed-in role, including CUSTOMER** (WF-SEC-09).

### Navigation bar per role (`components/app-shell/top-bar.tsx:12-23`)

| Link → target | ADMIN | CENTRAL_OPS | BRANCH_MANAGER | AGENT | AUDITOR | CUSTOMER |
|---|---|---|---|---|---|---|
| Dashboard → `/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Customers → `/customers` | – | ✓ | ✓ | ✓ | ✓ | – |
| Accounts → `/accounts` | – | ✓ | ✓ | ✓ | ✓ | – |
| Transactions → `/transactions/deposit` *(mockup)* | – | – | ✓ | ✓ | – | – |
| Fixed deposits → `/fixed-deposits` *(mockup)* | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Reports → `/reports/agent-transactions` | ✓ | ✓ | ✓ | – | ✓ | – |
| Branches → `/branches` | ✓ | ✓ | ✓ | – | ✓ | – |
| Agents → `/agents` | ✓ | ✓ | ✓ | – | – | – |
| Controls → `/admin/parameters` | ✓ | – | – | – | – | – |
| Health → `/admin/health` | ✓ | ✓ | – | – | – | – |

The shell also shows the username and role, a brand link to `/dashboard` and **Sign out**
(`POST /api/auth/logout` with `x-csrf-token`, then `/sign-in`). CUSTOMER sees **no links**.

**Orphan routes** (no link anywhere; type the URL): `/plans`, `/interest-runs`,
`/transactions/withdraw`, `/accounts/[id]/statement`, `/reports/account-summary`,
`/reports/customer-activity`, `/reports/active-fds`, `/reports/interest-distribution`,
`/admin/users`, `/admin/roles`, all `/dashboard/*` sub-pages, all `/sign-in/*` sub-pages.

---

## 1. Summary table — every route

| # | Route | Type | Roles that can open it | Owner | Built by | Test IDs |
|---|---|---|---|---|---|---|
| 1 | `/` | REDIRECT → `/sign-in` | anyone | Nadija | Nadija & Selith (scaffold) | WF-AUTH-08 |
| 2 | `/sign-in` | REAL | anyone (public) | Nadija | Nadija | WF-AUTH-01…07 |
| 3 | `/sign-in/{enclave-access, established, hardware, mfa, onboarding, recovery, sso}` (7) | REDIRECT → `/sign-in` | anyone | Nadija | Nadija | WF-AUTH-09 |
| 4 | `/dashboard` | REAL (session only) | any signed-in role | Nadija | Nadija | WF-DASH-01, WF-NAV-01 |
| 5 | `/dashboard/{cards, compliance, concierge, fx-desks, insights, liquidity, security, transactions}` (8) | MOCKUP (placeholder) | any signed-in role | Nadija | Nadija | UI-MOCK-12…19 |
| 6 | `/dashboard/fixed-deposits` | REDIRECT → `/fd-products` | any signed-in role | Nadija | Nadija | UI-MOCK-20 |
| 7 | `/admin/parameters` | REAL | ADMIN | Nadija | Nadija (page), Vibodha (client extraction) | WF-ADM-01…04 |
| 8 | `/admin/health` | REAL | ADMIN, CENTRAL_OPS | Pramudith | Pramudith (P01-M04-T04) on Nadija's scaffold | WF-ADM-05, 06 |
| 9 | `/admin/audit` | REAL (weak) | page: any signed-in; data: ADMIN, AUDITOR | Nadija | Nadija | WF-ADM-07…09 |
| 10 | `/admin/users` | MOCKUP | any signed-in role | Nadija | Nadija | UI-MOCK-10 |
| 11 | `/admin/roles` | MOCKUP (same as users) | any signed-in role | Nadija | Nadija | UI-MOCK-11 |
| 12 | `/branches` | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | Vibodha | Vibodha | WF-ORG-01…04 |
| 13 | `/agents` | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER | Vibodha | Vibodha | WF-ORG-05…08 |
| 14 | `/agents/[id]/activity` | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT (self) | Vibodha | Vibodha | WF-ORG-09…11 |
| 15 | `/customers` | REAL | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | Vibodha | Vibodha | WF-CUS-01, 06 |
| 16 | `/customers/new` | REAL | AGENT, BRANCH_MANAGER | Vibodha | Vibodha | WF-CUS-02…04, 09 |
| 17 | `/customers/[id]` | REAL | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | Vibodha | Vibodha | WF-CUS-05…08 |
| 18 | `/plans` | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR | Nisith | Nisith | WF-PLAN-01…04 |
| 19 | `/accounts` | REAL | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | Nisith | Nisith | WF-ACC-01 |
| 20 | `/accounts/new` | REAL | AGENT, BRANCH_MANAGER | Nisith | Nisith | WF-ACC-02…07 |
| 21 | `/accounts/[id]` | REAL | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | Nisith | Nisith | WF-ACC-08…12, 14 |
| 22 | `/accounts/[id]/statement` | MOCKUP | any signed-in role | Pramudith (statement) | Nadija (mockup) | UI-MOCK-01 |
| 23 | `/transactions/deposit` | MOCKUP | any signed-in role | Pramudith | Nadija (mockup) | UI-MOCK-02 |
| 24 | `/transactions/withdraw` | MOCKUP | any signed-in role | Pramudith | Nadija (mockup) | UI-MOCK-03 |
| 25 | `/transactions/[id]` | MOCKUP | any signed-in role | Pramudith | Nadija (mockup) | UI-MOCK-04 |
| 26 | `/fd-products` | REAL | any signed-in role (edit: ADMIN) | Selith | Selith | WF-FDP-01…04 |
| 27 | `/fixed-deposits` | MOCKUP | any signed-in role | Selith | Nadija (mockup) | UI-MOCK-05 |
| 28 | `/fixed-deposits/new` | MOCKUP | any signed-in role | Selith | Nadija (mockup) | UI-MOCK-06 |
| 29 | `/interest-runs` | MOCKUP | any signed-in role | Selith | Nadija (mockup) | UI-MOCK-07 |
| 30 | `/reports/agent-transactions` (RPT-01) | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | Vibodha | Vibodha (screen), Nadija (report shell) | WF-RPT-01…03 |
| 31 | `/reports/account-summary` (RPT-02) | REAL | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | Nisith | Nisith | WF-RPT-04, 05 |
| 32 | `/reports/customer-activity` (RPT-05) | REAL | BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, ADMIN | Pramudith | **Nadija on Pramudith's behalf** | WF-RPT-06, 07 |
| 33 | `/reports/active-fds` (RPT-03) | MOCKUP | any signed-in role | Selith | Nadija (mockup) | UI-MOCK-08 |
| 34 | `/reports/interest-distribution` (RPT-04) | MOCKUP | any signed-in role | Selith | Nadija (mockup) | UI-MOCK-09 |
| 35 | `/reconciliation` | REAL (server-rendered) | CENTRAL_OPS, AUDITOR, ADMIN | Pramudith | **Nadija on Pramudith's behalf** | WF-REC-01…03 |

Totals: 22 distinct REAL routes, 11 MOCKUP routes plus 8 placeholder sub-pages, and 9
REDIRECT routes. Each placeholder group is tested once.

---

## 2. Authentication and dashboard

### `/` — `app/page.tsx`
- **Type:** REDIRECT to `/sign-in` (`:7`). It does not check for a session, so a
  signed-in user also lands on the sign-in form.
- **Test:** WF-AUTH-08.

### `/sign-in` — `app/sign-in/page.tsx` (client) · Owner Nadija
- **Purpose:** staff sign-in.
- **Access:** public. A user who is already signed in still sees the form.
- **Form:**
  - **Username** — `required`, autocomplete username.
  - **Password** — `required`, with a **Show/Hide** toggle (`aria-pressed`).
  - **Sign in to workspace →** — disabled while submitting; shows "Signing in…".
  - No client length rules. The server rejects a username over 100 characters or a
    password over 4096 characters.
- **API:** `POST /api/auth/login`. The route checks the Origin is same-origin and the
  body is JSON, then calls `services/auth-service.ts login()`.
- **DB:** `app_user`, `role`, `agent`, `login_attempt` (throttle: 5 failures in 15 minutes
  per username), `user_session` INSERT, `app_user.last_login`.
- **Messages:**
  - "Username and password are required." (400)
  - "Invalid username or password" (401) — the same whether or not the user exists
  - "Account temporarily locked due to too many failed login attempts. Try again later."
    (429)
  - "Account is not active" (403)
  - "We could not sign you in. Please try again." / "We could not reach the service.
    Please try again."
- **Navigation out:** to the `?next=` path if it is same-site, otherwise `/dashboard`
  (`:35-37`).
- **Known gap:** an AGENT or BRANCH_MANAGER with an inactive `agent` profile gets 200 from
  login, then is silently sent back to `/sign-in` by the session check.
- **Tests:** WF-AUTH-01…07.

### `/sign-in/*` (7 sub-routes) — one-line redirects to `/sign-in`
- Leftovers from the earlier "Spatial UI" design. Nothing links to them.
- **Test:** WF-AUTH-09.

### `/dashboard` — `app/dashboard/page.tsx` · Owner Nadija
- **Purpose:** landing page with role-filtered "workspace" cards.
- **Access:** any signed-in role. No session → `/sign-in?next=/dashboard`.
- **Content:**
  - "Welcome back, {username}."
  - Hero text "A clear view. A confident next step."
  - "Your workspaces" cards, each ending "Explore workspace ↗".

| Card → target | Shown to |
|---|---|
| Customers → `/customers` | CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR |
| Savings accounts → `/accounts` | same |
| Transactions → `/transactions/deposit` *(mockup)* | BRANCH_MANAGER, AGENT |
| Fixed deposits → `/fixed-deposits` *(mockup)* | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR |
| Reports → `/reports/agent-transactions` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR |
| Reconciliation → `/reconciliation` | CENTRAL_OPS, AUDITOR (ADMIN is also allowed by the page but gets no card) |
| Branch administration → `/branches` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR |
| Agent administration → `/agents` | ADMIN, CENTRAL_OPS, BRANCH_MANAGER |
| FD products → `/fd-products` | all five staff roles |
| Audit trail → `/admin/audit` | ADMIN, AUDITOR |

- **Empty state:** none. CUSTOMER sees an empty grid.
- **Tests:** WF-DASH-01, WF-NAV-01.

### `/dashboard/*` placeholders (8) — MOCKUP
- Each shows the `FeaturePlaceholder` card: "Not available yet", a title, a sentence
  (e.g. "Deposits, withdrawals, and reversals are scheduled for Phase 3."), and **Return
  to dashboard**.
- The text is **stale**: transactions and reports exist now.
- **Tests:** UI-MOCK-12…19 (one per page).

### `/dashboard/fixed-deposits` — REDIRECT to `/fd-products`
- **Test:** UI-MOCK-20.

---

## 3. Administration (M1 Nadija)

### `/admin/parameters` — `page.tsx` → `parameter-admin.tsx`
- **Purpose:** view and edit business parameters stored in `system_parameter`.
- **Access:** `requirePageRole("ADMIN")`. Others → `/dashboard`. Nav: **Controls**.
- **UI:**
  - h1 "System Parameters".
  - Table: Key / Value / Type / Description / Actions.
  - **Edit** opens an inline text box; then **Save** or **Cancel**.
  - **No client validation by data type.**
- **API:**
  - `GET /api/admin/parameters` (ADMIN).
  - `PUT /api/admin/parameters/{key}` (ADMIN, CSRF, body `{ "value": "…" }`) →
    `services/parameter-service.ts updateParameter` → `UPDATE system_parameter` (row
    locked) → `trg_audit_system_parameter` writes `audit_log`.
- **States:**
  - Loading: "Loading…".
  - Load error: always "Failed to load parameters" (the server reason is dropped).
  - Save error: the API message.
  - Success: "Saved {key}".
- **Keys seeded:** `BUSINESS_HOUR_START` 08:30, `BUSINESS_HOUR_END` 17:00,
  `WITHDRAWAL_SINGLE_LIMIT` 100000.00, `WITHDRAWAL_DAILY_LIMIT` 200000.00,
  `SESSION_IDLE_TIMEOUT_MINUTES` 20, `SESSION_ABSOLUTE_TIMEOUT_HOURS` 8,
  `INTEREST_CYCLE_DAYS` 30, `MIN_FD_PRINCIPAL` 10000.00, `REVERSAL_REASON_REQUIRED` true.
- **Tests:** WF-ADM-01…04.

### `/admin/health` — `app/admin/health/page.tsx` (server component)
- **Owner:** Pramudith.
- **Purpose:** database connectivity, pool and migration status.
- **Access:** `requirePageRole(ADMIN, CENTRAL_OPS)` (`services/health-service.ts:5`).
- **Content:**
  - Connection (Connected / Unavailable).
  - Total / Idle connections, Waiting requests.
  - Applied migrations, Last migration.
  - Process uptime.
- **Error:** "Database health is temporarily unavailable."
- **No refresh button.**
- **DB:** `schema_migration` (count and max filename), pool metrics.
- **Tests:** WF-ADM-05, 06.

### `/admin/audit` — `app/admin/audit/page.tsx` (client)
- **Purpose:** search the immutable `audit_log`.
- **Access:** **page opens for any signed-in role**. The API `GET /api/audit` allows only
  AUDITOR and ADMIN; other roles see "No audit logs found." with no error.
- **Filters:** Actor ID (UUID), Entity Type, Entity ID (UUID), Action, From / To
  (`datetime-local`), **Search**.
- **Table:** Time (browser local time, not Colombo) / Actor (type + first 8 characters of
  the user id) / Action / Entity / Changes (truncated JSON).
- **Known gaps** (07):
  - The `datetime-local` value (`2026-10-09T10:00`) fails the API's date schema, so the
    page silently keeps the old rows.
  - No loading, error or pagination (first 20 rows only).
  - Labels are not linked to inputs.
- **Tests:** WF-ADM-07…09.

### `/admin/users` and `/admin/roles` — MOCKUP (identical content)
- **Header:** "System administration" / "Users and roles".
- **Controls:**
  - Buttons **Create staff user**, **Search**, **Manage** ×2 — all do nothing.
  - Search box (no label).
  - Role select: All roles / ADMIN / CENTRAL_OPS / BRANCH_MANAGER / AGENT / AUDITOR.
- **Table headers:** Username / Role / Branch scope / Status / Last sign-in.
- **Sample rows:**
  - `a.fernando | AGENT | Colombo Main | Active | 27 Sep 2026 10:12`
  - `central.ops | CENTRAL_OPS | Bank-wide | Active | 27 Sep 2026 09:15`
- **Tests:** UI-MOCK-10, UI-MOCK-11.

---

## 4. Organisation (M2 Vibodha)

### `/branches` — `app/branches/page.tsx` → `components/organization/organization-table.tsx`
- **Purpose:** list branches; ADMIN creates and deactivates them.
- **Access:** inline check. No session → `/sign-in?next=/branches`. AGENT and CUSTOMER →
  `/dashboard`.
- **UI:**
  - Status filter: Active only (default) / All records.
  - **Create branch** form (ADMIN only), all fields required:
    - Branch code — max 20
    - Branch name — max 100
    - District — max 100
    - Phone — max 20
    - Address — max 255
  - Table: Code / Branch / District / Phone / Status / Actions (**Deactivate**, ADMIN).
  - Deactivate opens a confirmation dialog: "Deactivate {name}? The record will remain in
    history and will not be deleted."
- **API:**
  - `GET /api/branches[?status=ACTIVE]`
  - `POST /api/branches` (ADMIN, CSRF)
  - `PATCH /api/branches/{id}` `{status:"INACTIVE"}` (ADMIN, CSRF)
- **DB:** `branch`, `trg_audit_branch`, `trg_branch_prevent_deactivation_with_active_agents`.
- **States:**
  - "Loading branches…"
  - "No branches match this status filter."
  - Success: "Branch {code} was created." / "…was deactivated."
  - Error: API message (`aria-live="assertive"`).
- **Tests:** WF-ORG-01…04.

### `/agents` — `app/agents/page.tsx` → `OrganizationTable resource="agents"`
- **Purpose:** list ordinary agents; ADMIN and BM create and deactivate them.
- **Access:** inline check — ADMIN, CENTRAL_OPS, BRANCH_MANAGER; others → `/dashboard`.
- **Create ordinary agent** form (ADMIN, BM), all required:

  | Field | Rules |
  |---|---|
  | Branch | select; locked for BM |
  | Username | 3–100 characters, `[A-Za-z0-9._-]+` |
  | Temporary password | 12–128 characters |
  | Employee number | max 30 |
  | NIC/passport | max 50 |
  | Full name | max 150 |
  | Gender | FEMALE / MALE / OTHER |
  | Date of birth | ≤ today |
  | Hired date | ≤ today |
  | Email | max 150 |
  | Phone | max 20 |
  | Address | max 255 |

- **Table:** Employee no. / Agent (name links to `/agents/{id}/activity`) / Branch / Phone /
  Status / Actions.
- **API:**
  - `GET /api/agents[?status=ACTIVE]` (ADMIN, CENTRAL_OPS, BM)
  - `POST /api/agents` (ADMIN, BM, CSRF) — `app_user` + `agent` in one transaction
  - `PATCH /api/agents/{id}` (ADMIN, BM, CSRF)
- **DB:** `app_user`, `agent`, `role`, `branch`; triggers `trg_audit_agent`,
  `trg_audit_app_user`, `trg_validate_agent_active_branch`.
- **Tests:** WF-ORG-05…08.

### `/agents/[id]/activity` — `agent-activity-screen.tsx`
- **Purpose:** count and total of an agent's transactions by type for a date range
  (Asia/Colombo, inclusive).
- **Access:**
  - Page: ADMIN, CENTRAL_OPS, BM, AGENT.
  - Service: AGENT may view only themselves; BM only agents of their branch → 403 message.
- **Form:** From / To (date, required, default today), **Show activity**, **Today**.
- **Result table:** Deposits / Withdrawals / Interest credits / Reversals × Count / Total
  amount.
- **Empty:** "No attributed transactions in this date range."
- **API:** `GET /api/agents/{id}/activity?from&to`.
- **DB:** `transaction` (`agent_id`, `branch_id`), `agent`, `app_user`, `role`, `branch`.
- **Navigation:**
  - In: agent names on `/agents`; AGENT's **My daily activity** button on `/customers`.
  - Out: "Back to agents" or "Back to customers".
- **Tests:** WF-ORG-09…11.

---

## 5. Customers (M2 Vibodha)

### `/customers` — `customer-list.tsx`
- **Purpose:** search customers in your scope.
- **Access:** AGENT, BM, CENTRAL_OPS, AUDITOR (ADMIN → `/dashboard`).
- **Search form:**
  - Text search (max 150)
  - Status (All / ACTIVE / INACTIVE)
  - Branch
  - Agent (an AGENT sees only themselves)
  - Sort by (fullName / customerNumber / createdAt)
  - Direction
  - **Search customers**
- **Buttons:**
  - **Register customer** (AGENT, BM) → `/customers/new`.
  - **My daily activity** (AGENT) → `/agents/{you}/activity`.
- **Table:** Name (→ `/customers/{id}`) / Customer number / Identity / Email / Status.
  **Previous** / **Next**.
- **API:** `GET /api/customers?q&status&branchId&agentId&sortBy&sortDirection&page`.
- **DB:** `customer`, `customer_agent`, `agent`, `app_user`, `branch`, `account_holder`,
  `account` — under RLS.
- **States:**
  - "Loading customers…"
  - "{n} customers found"
  - "No customers match your search."
  - Error + **Retry search**
- **Known gap:** the client helper has an unguarded `response.json()`, so a non-JSON error
  shows a raw `SyntaxError` text.
- **Tests:** WF-CUS-01, WF-CUS-06.

### `/customers/new` — `customer-registration.tsx`
- **Purpose:** register a customer in the user's own branch.
- **Access:** AGENT, BM.
- **Fields:**

  | Field | Rules |
  |---|---|
  | Full name* | max 150 |
  | NIC or passport* | 5–50 |
  | Date of birth* | date |
  | Email* | email, max 150 |
  | Gender | free text, max 20 |
  | Phone | max 20 |
  | Address | max 255 |
  | Assigned agent* | AGENT: "You (current agent)"; BM: active agents of the branch |
  | Document references | 0–20 rows; each needs Document type* (max 50) + Stored document reference* (max 500) |

- **Submit:** **Register customer** ("Registering customer…").
- **API:** `POST /api/customers` (AGENT, BM, CSRF) → `registerCustomer`.
- **DB:** one transaction inserting `customer`, `customer_document` (unverified),
  `customer_agent`; `trg_audit_customer` writes `audit_log`.
- **Out:** success → `/customers/{id}`; **Back to search** → `/customers`.
- **Known gap:** documents are always stored **unverified**, and no page or API can verify
  them. Account opening needs verified documents, so **a customer registered here can
  never be given an account** (WF-CUS-09, `.agent/open-questions.md`).
- **Tests:** WF-CUS-02…04, WF-CUS-09.

### `/customers/[id]` — `customer-profile.tsx`, `customer-fixed-deposits.tsx`
- **Purpose:** profile, assignment history, documents, accounts and FDs.
- **Access:** AGENT, BM, CENTRAL_OPS, AUDITOR, CUSTOMER (own profile only); ADMIN →
  `/dashboard`.
- **Sections:**
  - **Details:** customer number, identity, email, DOB, phone, address, status.
  - **Assignment history:** Agent / Assigned / Ended / Current-Previous.
  - **Documents:** "Verified {date}" / "Unverified".
  - **Savings accounts:** → `/accounts/{id}`, with status and balance.
  - **Fixed deposits:** Savings account / Product / Principal / Rate at opening / Opened /
    Maturity / Next interest / Status.
- **API:**
  - `GET /api/customers/{id}`
  - `GET /api/customers/{id}/fixed-deposits` (view `vw_customer_fd_summary`)
- **States:**
  - "Loading customer…"
  - "Customer ID must be a UUID." (for `/customers/demo`)
  - "No assignment history." / "No documents recorded." / "No linked accounts."
  - "Account information is unavailable."
  - "No fixed deposits linked to this customer."
  - Retry buttons
- **Tests:** WF-CUS-05…08.

---

## 6. Plans and accounts (M3 Nisith)

### `/plans` — `SavingsPlanClient.tsx`
- **Purpose:** savings-plan catalogue; ADMIN and CENTRAL_OPS edit it.
- **Access:** all five staff roles; CUSTOMER → `/dashboard`. **No nav link.**
- **Table:** Plan / Interest rate / Minimum balance / Eligibility / Status / **Edit**
  (editors only).
- **Edit dialog** (focus trap, Esc closes):

  | Field | Rules |
  |---|---|
  | Interest rate | fraction 0 < r ≤ 1, ≤ 4 decimals |
  | Minimum balance | `^\d{1,13}(\.\d{1,2})?$` |
  | Description | max 255 |
  | Status | ACTIVE / INACTIVE |
  | Min / max age | 0–120, max ≥ min |
  | Min / max holders | 1–20, max ≥ min |
  | Every holder must be an adult | checkbox |

- **API:** `PATCH /api/plans/{id}` (ADMIN, CENTRAL_OPS, CSRF) — changed fields only.
- **DB:** `UPDATE savings_plan`; audit row written by the service; DB `CHECK`s reject bad
  ranges.
- **Tests:** WF-PLAN-01…04.

### `/accounts` — `account-list.tsx`
- **Purpose:** search savings accounts.
- **Access:** AGENT, BM, CENTRAL_OPS, AUDITOR.
- **Form:**
  - Text (max 100)
  - Status (All / ACTIVE / FROZEN / CLOSED)
  - Plan
  - Sort (accountNumber / openedDate / currentBalance / status)
  - Direction
  - **Search accounts**
- **Button:** **Open account** (AGENT, BM).
- **Table:** Account (→ `/accounts/{id}`) / Primary holder ("+ N joint") / Plan / Opened /
  Balance / Status. Previous / Next.
- **API:** `GET /api/accounts?…`.
- **DB:** `account`, `account_holder`, `customer`, `savings_plan`, `customer_agent`,
  `branch`.
- **States:**
  - "Loading accounts…"
  - "{n} account(s) found"
  - "No accounts match your search."
  - Error + Retry
- **Test:** WF-ACC-01.

### `/accounts/new` — `account-opening.tsx`, `account-opening-model.ts`, `customer-picker.tsx`
- **Purpose:** two-step wizard (edit → review) to open an individual or joint account.
- **Access:** AGENT, BM.
- **Steps:**
  1. **Plan*** — "{name} · {rate} · minimum {LKR}"; its description and eligibility
     appear when chosen.
  2. **Holders:**
     - Customer picker (`GET /api/customers?q=…&pageSize=10&status=ACTIVE`) with **Add**,
       **Make primary**, **Remove**.
     - Duplicate pick: "{name} is already a holder on this application."
     - Too many holders: "The {plan} plan allows at most N holder(s)."
  3. **Operating mandate*** (only when the plan allows more than 1 holder) — ANY_ONE "Any
     one holder" / ALL_HOLDERS "All holders together".
  4. **Initial deposit** — optional; `^\d{1,13}(\.\d{1,2})?$`; "Deposits are only accepted
     during business hours."
- **Review gate:** **Review account opening** stays disabled until there are no problems:
  - "Choose a savings plan."
  - "Add the account holder."
  - "Add at least N holders…"
  - "Choose how withdrawals are authorised."
  - Amount format message
- **Review step:**
  - Shows plan, minimum, holders, withdrawals rule, initial deposit and opening balance.
  - Buttons: **Edit application** / **Confirm and open account**.
- **API:** `POST /api/accounts` (AGENT, BM, CSRF, `Idempotency-Key: acct-<uuid>`, reused
  while the form is unchanged) → `openAccount` → `sp_open_savings_account` +
  `account_opening_request`.
- **DB:**
  - Writes: `account`, `account_holder`, `joint_mandate`, `transaction` (initial deposit),
    `audit_log`.
  - Checks: `fn_check_plan_eligibility`, `trg_validate_joint_mandate`, business hours,
    verified documents.
- **Field errors:** e.g. `BELOW_MINIMUM_BALANCE`, `OUTSIDE_BUSINESS_HOURS` (under deposit),
  `DOCUMENTS_NOT_VERIFIED`, `IDEMPOTENCY_KEY_REUSED` ("This application changed after an
  earlier attempt…").
- **Navigation out:**
  - 201 → `/accounts/{id}?notice=opened`.
  - 200 replay → `?notice=existing` ("…already opened by an earlier submission. Nothing was
    changed.").
- **Tests:** WF-ACC-02…07.

### `/accounts/[id]` — `account-detail.tsx`, `account-fixed-deposits.tsx`
- **Purpose:** balance, plan, mandate, holders, FDs; BM adds joint holders.
- **Access:** AGENT, BM, CENTRAL_OPS, AUDITOR, CUSTOMER (own accounts only).
- **Cards:**
  - **Balance:** current balance / status / **Available to withdraw** / last transaction /
    plan minimum note.
  - **Plan:** plan, minimum, opened, holders "N of M allowed".
  - **Who can authorise withdrawals:** state Effective / Not yet effective / Expired.
  - **Holders:** Name (→ `/customers/{id}`) / Customer number / Role / Authority / Joined.
  - **Fixed deposits:** Product / Principal / Rate at opening / Opened / Maturity / Next
    interest / Status. **Open a fixed deposit** (AGENT, BM, CENTRAL_OPS) →
    `/fixed-deposits/new?accountId=…` — a **mockup that ignores the account**.
  - **Add a joint holder** (BM only): picker → confirmation "Add {name} ({no}) as a joint
    holder? The account will have N holders." → **Confirm and add holder**.
- **API:**
  - `GET /api/accounts/{id}`
  - `POST /api/accounts/{id}/holders` (BM, CSRF) → `sp_add_account_holder`
- **States and notices:**
  - "Account opened." / "already opened…"
  - "This account is {status}. Withdrawals are not allowed."
  - "No holders are visible to you."
  - "No fixed deposits on this account."
  - "Holders can only be added to an active account." / "This is a single-holder plan." /
    "…already has the maximum of N holders."
  - "Account ID must be a UUID."
- **Not present:** no link to the statement page, no **Close account** button (the API
  exists).
- **Tests:** WF-ACC-08…12, WF-ACC-14 (and WF-ACC-13 via API).

### `/accounts/[id]/statement` — MOCKUP
- **Header:** "Statement", title **SAV-100284**, "Nadeesha Perera · Current balance LKR
  42,500.00".
- **Controls:** **Download statement** and **Apply date range** do nothing.
- **Table** Posted at / Reference / Type / Amount / Balance after:
  - `27 Sep 2026 10:12 | DEP-20260927-00128 | Deposit | + LKR 10,000.00 | LKR 42,500.00`
  - `16 Sep 2026 14:03 | WDL-20260916-00082 | Withdrawal | − LKR 2,500.00 | LKR 32,500.00`
  - `30 Aug 2026 09:00 | INT-20260830-00018 | Interest credit | + LKR 120.00 | LKR 35,000.00`
- Every reference links to `/transactions/demo`. The `[id]` in the URL is ignored.
- **Real API not used:** `GET /api/accounts/{id}/transactions`.
- **Test:** UI-MOCK-01.

---

## 7. Transactions (M4 Pramudith) — all MOCKUP

The real APIs exist and are tested through curl/Postman in 04 (WF-TXN-…) and 05:
`POST /api/transactions/deposits`, `POST /api/transactions/withdrawals`,
`GET /api/transactions/{id}`, `POST /api/transactions/{id}/reverse`. The withdrawal,
reversal and transaction APIs were implemented by Selith on Pramudith's behalf.

### `/transactions/deposit` — MOCKUP
- **Header:** "Financial posting" / "Post a deposit".
- **Form:**
  - Account select: `SAV-100284 · Nadeesha Perera · LKR 42,500.00` /
    `SAV-100301 · Kamal Jayasinghe · LKR 18,220.00`.
  - Amount (LKR) — no pattern.
  - Channel: Cash counter / Mobile agent / Bank transfer.
  - Narration.
  - **Review deposit**.
- **Confirmation card** (always the same values):
  - Account `SAV-100284 · Nadeesha Perera`
  - Posting amount **+ LKR 10,000.00**
  - Projected balance **LKR 52,500.00**
  - **Back to edit**
  - **Confirm when service is connected** (does nothing)
  - Notice "Frontend prototype only…"
- **Test:** UI-MOCK-02.

### `/transactions/withdraw` — MOCKUP
- Same form, titled "Post a withdrawal", plus **On behalf of holder**:
  "Nadeesha Perera — primary holder" / "Kamal Jayasinghe — authorised holder".
- Notice about mandate/limits verified after lock.
- **Confirmation:** **− LKR 10,000.00**, projected **LKR 32,500.00**.
- No nav link.
- **Test:** UI-MOCK-03.

### `/transactions/[id]` — MOCKUP (any id, including `demo`)
- **Title:** **DEP-20260927-00128**, "Immutable posted entry · 27 Sep 2026 10:12 · Colombo
  Main".
- **Posting details:** Account SAV-100284 / Type Deposit / Amount + LKR 10,000.00 / Balance
  after LKR 42,500.00 / Channel Cash counter.
- **Reversal card:** reason input and **Request manager reversal** (does nothing).
- **Test:** UI-MOCK-04.

---

## 8. Fixed deposits and interest (M5 Selith)

### `/fd-products` — `FdProductClient.tsx` (REAL)
- **Purpose:** FD products and effective-dated rate history; ADMIN changes rates or
  deactivates.
- **Access:** inline session check only — **every signed-in role, including CUSTOMER, can
  view**. Edit controls: ADMIN.
- **Tables:**
  - "Active products" and "Rate history and inactive products".
  - Columns: Plan name / Tenure / Interest rate (%) / Status / Effective from / Effective to.
  - ADMIN actions: **Edit rate**, **Deactivate**.
- **Edit rate:**
  - Fraction input; client rule
    `^0\.(?=.*[1-9])\d{1,4}$|^1(?:\.0{1,4})?$` — "Interest rate must be greater than 0 and
    no more than 1, with up to four decimal places."
  - **Review change** → confirm dialog "Create a new rate of X% for {plan}. The current
    rate will move to history." → **Confirm**.
- **API:** `PATCH /api/fd-products/{id}` (ADMIN, CSRF).
- **DB:** `UPDATE fd_plan` (close current row) + `INSERT fd_plan` (new row) in one
  transaction. **No audit_log entry** (07).
- **Success:** "The new rate was saved with its effective-date history." / "The product was
  deactivated."
- **Tests:** WF-FDP-01…04.

### `/fixed-deposits` — MOCKUP
- **Header:** "Fixed deposits"; button **Open fixed deposit** → `/fixed-deposits/new`.
- **Table** FD ID / Account / Product / Principal / Rate at opening / Maturity / Status:
  - `FD-00082 | SAV-100284 | 12 month Growth | LKR 100,000.00 | 12.50% | 14 Jan 2027 | Active`
  - `FD-00091 | SAV-100301 | 6 month Flex | LKR 75,000.00 | 10.00% | 12 Dec 2026 | Active`
- The sample products ("12 month Growth", "6 month Flex") do **not** match the real
  FD-6M/1Y/3Y products.
- **Test:** UI-MOCK-05.

### `/fixed-deposits/new` — MOCKUP
- **Header:** "Open a fixed deposit".
- **Form:**
  - Savings account: `SAV-100284 · LKR 42,500.00 available` /
    `SAV-100301 · LKR 18,220.00 available`.
  - FD product: `6 month Flex · 10.00%` / `12 month Growth · 12.50%`.
  - Principal.
- **Expected terms:** "Snapshot at opening", "Calculated from product tenure", "Calculated
  by the interest cycle".
- **Review fixed deposit** does nothing.
- The `?accountId=` from the account page is ignored.
- **Real logic:** `sp_open_fixed_deposit` (SQL only, WF-FD-…).
- **Test:** UI-MOCK-06.

### `/interest-runs` — MOCKUP
- **Header:** "Interest operations" / "Interest runs".
- **Controls:** **Start interest run** and **Review run** do nothing; Cycle date; "Dry run…"
  checkbox.
- **Table** Cycle date / Status / FDs processed / Total interest / Exceptions / Initiated by:
  - `30 Aug 2026 | Completed | 21 | LKR 42,560.00 | 0 | system worker`
  - `30 Jul 2026 | Completed | 19 | LKR 38,140.00 | 1 | central.ops`
- **Real logic:** `sp_run_interest_cycle` (SQL only). `POST /api/interest-runs` only
  records an audit row.
- **Test:** UI-MOCK-07.

---

## 9. Reports

All REAL reports use the report framework by Nadija (`components/report/*`,
`lib/report/report-handler.ts`, `lib/report/csv-export.ts`). It provides filters,
generation metadata, page subtotal + grand total, CSV with the same totals, and a
`REPORT_ACCESSED` audit row. The only nav entry is **Reports →
`/reports/agent-transactions`**.

### `/reports/agent-transactions` — RPT-01 (Vibodha)
- **Access:** ADMIN, CENTRAL_OPS, AUDITOR, BM (BM is locked to own branch). AGENT and
  CUSTOMER → `/dashboard`.
- **Filters:**
  - From* / To* (Colombo, inclusive)
  - Posting branch
  - Agent (includes historical profiles)
  - Sort (Employee number / Agent name / Net movement)
  - Order
  - Rows per page (25 / 50 / 100)
  - **Apply filters**
- **Export:** **Export CSV · all filtered rows**.
- **Columns:** Employee / Agent / Profile status / Posting branch / Count / Deposits /
  Withdrawals / Interest / Reversal credits / Reversal debits / Unlinked reversals / Net
  movement. Rows "Page subtotal" and "Grand total · all applied filters"; excluded
  unattributed transactions note.
- **API:** `GET /api/reports/agent-transactions[?format=csv]`.
- **DB:** `fn_rpt01_rows`, `fn_rpt01_exclusions` (0521), `vw_rpt01_*` (0520), `transaction`,
  `audit_log`.
- **Error:** always "The report could not be loaded. Check your filters and access, then
  retry."
- **Tests:** WF-RPT-01…03.

### `/reports/account-summary` — RPT-02 (Nisith)
- **Access:** ADMIN, CENTRAL_OPS, AUDITOR, BM. **No inbound link.**
- **Filters:**
  - From* / To*
  - Branch (locked for BM)
  - Savings plan
  - Account status
  - Sort (Account number / Opening balance / Closing balance / Net movement)
  - Order
  - Rows per page
- **Columns:** Account / Branch / Plan / Status / Opening balance / Deposits (count, value) /
  Withdrawals (count, value) / Interest (count, value) / Reversals (count) / Closing
  balance / Net movement.
- **API:** `GET /api/reports/account-summary[?format=csv]`.
- **DB:** `vw_rpt02_account_summary` (0543), `transaction.ledger_seq`.
- **Tests:** WF-RPT-04, 05.

### `/reports/customer-activity` — RPT-05 (Owner Pramudith; implemented by Nadija)
- **Access:** BM, CENTRAL_OPS, AUDITOR, ADMIN. **No inbound link.**
- **Filters:**
  - From / To (optional)
  - **Branch ID, Account ID, Plan ID as free-text UUID boxes** (no pickers)
  - Account status
  - **Apply filters**
- **Export:** **Export CSV** link.
- **Columns:** Customer / Accounts / Deposits / Withdrawals / Interest / Net. Page subtotal +
  Grand total. "Totals count joint activity once per holder."
- **API:** `GET /api/reports/customer-activity[?format=csv]`.
- **DB:** `vw_rpt05_customer_activity` (0560).
- **Known gap:** CSV exports only the current page (`.agent/open-questions.md`; 07).
- **Tests:** WF-RPT-06, 07.

### `/reports/active-fds` — RPT-03 — MOCKUP
- **Header:** "Management reports" / "RPT-03 · Active fixed deposits".
- **Controls:** **Export CSV** and **Apply filters** do nothing; From/To; Branch (All
  permitted branches / Colombo Main / Kandy); Status (All / ACTIVE / MATURED / CLOSED).
- **Metadata:** "Filters: All permitted branches · 01 Sep 2026—27 Sep 2026"; "Generated
  27 Sep 2026 10:30 · requested by current user".
- **Table** FD ID / Account / Product / Principal / Next payout:
  - `FD-00082 | SAV-100284 | 12 month Growth | LKR 100,000.00 | 27 Oct 2026`
  - `FD-00091 | SAV-100301 | 6 month Flex | LKR 75,000.00 | 12 Oct 2026`
  - **Grand total LKR 316,700.00** (hard-coded; does not equal the rows).
- **Real API:** `GET /api/reports/active-fds` (tested in WF-RPT-08 / 05).
- **Test:** UI-MOCK-08.

### `/reports/interest-distribution` — RPT-04 — MOCKUP
- Same shell, title "RPT-04 · Interest distribution".
- **Table** Branch / Cycle / Distributions / Total interest:
  - `Colombo Main | September 2026 | 18 | LKR 42,560.00`
  - `Kandy | September 2026 | 11 | LKR 28,340.00`
  - **Grand total LKR 316,700.00** (wrong; rows add to 70,900.00).
- **Real API:** `GET /api/reports/interest-distribution` (WF-RPT-09).
- **Test:** UI-MOCK-09.

---

## 10. Reconciliation (Owner Pramudith; implemented by Nadija)

### `/reconciliation` — `app/reconciliation/page.tsx` (server component)
- **Purpose:** prove the ledger matches the balances.
  - **D-1:** `account.current_balance` vs the sum of ledger rows.
  - **D-2:** each `transaction.balance_after` vs the computed running balance.
- **Access:**
  - Layout: no session → `/sign-in`.
  - Page: CENTRAL_OPS, AUDITOR, ADMIN. Other roles are redirected to **`/unauthorized`**,
    and a missing cookie to **`/login`**. **Neither route exists, so the user gets a 404**
    (07).
- **Content:**
  - "Ledger Reconciliation".
  - Status box: "{N} accounts and {M} transactions reconciled. {a} account discrepancies
    and {t} transaction discrepancies found." (green / red).
  - Tables "Account Balance Discrepancies (D-1)" and "Transaction Balance Discrepancies
    (D-2)", or "No discrepancies found."
- **Service:** `services/reconciliation-service.ts` reads `vw_reconciliation_balance` and
  `vw_reconciliation_running_balance` (0561).
- **No error handling:** a DB failure gives the default error page.
- **Tests:** WF-REC-01…03.

---

## 11. Shared UI behaviour to check on every REAL page

| Behaviour | Where | Expected |
|---|---|---|
| CSRF | All forms that POST/PATCH/PUT | Request carries `x-csrf-token` equal to the `mims_csrf` cookie |
| Session expiry | All | Organisation tables, FD products and agent activity redirect to `/sign-in?next=…` on 401. Accounts and customers show the message inline (no redirect). RPT-01/02 show a generic error |
| Sign-out | Top bar | `mims_session` revoked server-side; **`mims_csrf` cookie is not cleared** (07) |
| Responsive | All | At 375 px no page-level horizontal scroll; tables scroll inside their card |
| Accessibility | Dialogs | Plans dialog traps focus and returns it; organisation and FD-product dialogs do not trap focus (07) |
| Errors | All | No SQL text, stack traces or hashes in any message |
