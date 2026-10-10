# 04 — End-to-End Workflow Test Plan

The main test plan. It lists every workflow each role can perform, then the test cases in
**one table per area, in the order to run them**. Run top to bottom in one session; later
rows reuse data created by earlier rows. The API-level and SQL-level details are in 05 and
06. The tracker for recording results is `08-TEST-TRACKER.csv`.

**Columns**

| Column | Meaning |
|---|---|
| Test ID | `WF-…` workflow test; `UI-MOCK-…` mockup page check |
| Tool | **Manual (browser)**, **Playwright** (candidate for automation — not set up yet), **Postman/curl**, or **SQL** (psql/pgAdmin) |
| Automated? | *Covered by existing test (file)*, *Partially covered (file)*, or *Manual only* |
| Owner | Member whose slice it is. For Member 4 features built by someone else, the owner is **Pramudith** and the Notes column names the implementer |
| Tester | Always someone other than the owner (and other than the implementer) |
| Status | `Not run` / `Pass` / `Fail` / `Blocked` |
| Notes | **"Known issue — likely Fail (F-xx)"** points to 07. **"Mockup — no backend"** marks static screens |

**Before you start** (see 09):

- `npm run db:rebuild -- --reset` (fresh seed), then `npm run dev`.
- One browser profile/window per role.
- curl or Postman set up as in 05 §0.
- `psql` connected as owner and as app.
- If the session runs outside 08:30–17:00 Asia/Colombo, run WF-ADM-03 early to open
  business hours, and restore them at the end (WF-END-01).

**Key fixtures** (05 §0 has the UUIDs):

- **Colombo:** `agent_c1` (assigned to customers 01 Child One, 02 Teen One, 03 Adult One,
  04 Adult Two) and `bm_colombo`.
- **Kandy:** `agent_k1` and `bm_kandy`.
- **Accounts:**
  - BR-COL-00000003 — Adult, customer 03 (the `customer_adult_one` login).
  - BR-COL-00000002 — Teen, min 500.
  - BR-COL-00000005 — Joint ANY_ONE, customers 03 + 04.
  - BR-KAN-00000001 — Joint ALL_HOLDERS, customers 08/09/10.

---

## 1. Workflows by role

| Role | Workflows (test IDs) |
|---|---|
| **Any visitor** | Sign in, wrong password, lockout, redirect to sign-in when signed out (WF-AUTH-01…09) |
| **ADMIN** (`admin`) | Dashboard & nav (WF-NAV-01, WF-DASH-01); edit parameters / business hours (WF-ADM-01…04); health (WF-ADM-05); audit search (WF-ADM-07, 08); create/deactivate branches (WF-ORG-01…04); create/deactivate agents (WF-ORG-05…08); edit savings plans (WF-PLAN-02); change FD product rates (WF-FDP-02, 03); reports RPT-01/02/05 (WF-RPT-01, 04, 06); reconciliation (WF-REC-01); reverse a transaction (API, WF-TXN-14) |
| **CENTRAL_OPS** (`central_ops`) | Read all customers/accounts (WF-CUS-01, WF-ACC-01); edit plans (WF-PLAN-02); health (WF-ADM-05); all reports (WF-RPT-01…10); reconciliation (WF-REC-01); request an interest run (WF-INT-04) |
| **BRANCH_MANAGER** (`bm_colombo`) | Branch-scoped customers, accounts, agents (WF-CUS-01, WF-ACC-01, WF-ORG-05); register customer (WF-CUS-02); open individual and joint accounts (WF-ACC-02…07); add joint holder (WF-ACC-09); close account (API, WF-ACC-13); create/deactivate agents (WF-ORG-06…08); agent activity (WF-ORG-10); deposits/withdrawals (API, WF-TXN-…); **reversals** (WF-TXN-14…16); branch reports (WF-RPT-03, 05) |
| **AGENT** (`agent_c1`) | Search assigned customers (WF-CUS-01); register customer (WF-CUS-02…04); open accounts (WF-ACC-02…07); view account (WF-ACC-08); deposits/withdrawals (API, WF-TXN-01…11); own daily activity (WF-ORG-09) |
| **AUDITOR** (`auditor`) | Read-only customers/accounts; audit search (WF-ADM-07); reports (WF-RPT-04); reconciliation (WF-REC-01) |
| **CUSTOMER** (`customer_adult_one`) | Own profile, accounts, FDs only (WF-CUS-07, 08, WF-ACC-12); self-service withdrawal (API, WF-TXN-09) |
| **Interest worker** (Bearer token) | Request an interest run (WF-INT-05) |
| **Cross-member flows** | Customer → account → deposit → FD → interest → reports → reconciliation (WF-ACC-02 → WF-TXN-01 → WF-FD-01 → WF-INT-01 → WF-RPT-… → WF-REC-03) |

Cross-member integration points tested (the places bugs hide):

| Point | What it is | Tests |
|---|---|---|
| I-1 | Nadija's RBAC/CSRF used by every route | WF-SEC-01…03 |
| I-2 | Pramudith's `lib/db` used by every service | All `WF-` rows (any 500) |
| I-3 / I-4 | Nisith's account row, `fn_check_plan_minimum` and mandate check used by the withdrawal routine | WF-TXN-05…09 |
| I-5 | Interest credit through the ledger routine | WF-INT-01, 03 |
| I-6 | FD eligibility | WF-FD-01…03 |
| I-7 | Nadija's report framework used by RPT-01/02/05 | WF-RPT-01…07 |
| I-8 | Seed | WF-SETUP-01 |
| — | Account opening document check vs customer registration | WF-CUS-09 |

---

## 2. Test cases (run in this order)

### 2.1 Setup and authentication

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-SETUP-01 | Rebuild and seed the database | — | PostgreSQL running, `.env` filled | `npm run db:rebuild -- --reset`; `npm run db:verify`; run the count query in 06 §1 | Rebuild succeeds; verify passes; counts match 06 §1 (3 branches, 15 customers, 10 accounts, 12 FDs, 3 interest runs, 30 payouts) | SQL | Covered by existing test (`tests/db/migration-runner.test.mjs`, `tests/db/seed-validation.test.mjs`) | Selith | Nadija | Not run | Seed steward Selith; FD/interest seed completed by Vibodha. `db:migrate` alone is not enough (F-31) |
| WF-SETUP-02 | App starts | — | WF-SETUP-01 done | `npm run dev`; open <http://localhost:3000> | Redirects to `/sign-in`; no errors in terminal or browser console | Manual (browser) | Manual only | Nadija | Vibodha | Not run | |
| WF-AUTH-01 | Sign in (valid) | agent_c1 | Seeded user | `/sign-in` → username `agent_c1`, seed password → **Sign in to workspace** | Lands on `/dashboard` "Welcome back, agent_c1."; DevTools → Cookies: `mims_session` (HttpOnly) and `mims_csrf`; top bar shows agent_c1 · AGENT | Manual (browser) / Playwright | Covered by existing test (`tests/e2e/sign-in.test.mjs` — route level) | Nadija | Vibodha | Not run | |
| WF-AUTH-02 | Wrong credentials are generic | — | — | Sign in as `agent_c2` with a wrong password; then as `nobody_x` | Both show "Invalid username or password"; no hint whether the user exists | Manual (browser) / Playwright | Covered by existing test (`tests/api/auth.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-AUTH-03 | Lockout after 5 failures | — | Use `agent_g2` only here | 5 wrong passwords, then the correct one | 6th attempt: "Account temporarily locked due to too many failed login attempts. Try again later." | Manual (browser) | Covered by existing test (`tests/api/auth.test.mjs`) | Nadija | Vibodha | Not run | agent_g2 is locked for 15 min. Per-username lockout means anyone can lock anyone (F-17) |
| WF-AUTH-04 | Show/Hide password, required fields | — | — | Click **Show**/**Hide**; submit with empty fields | Password toggles visible/hidden (`aria-pressed` changes); browser blocks empty submit | Manual (browser) | Manual only | Nadija | Vibodha | Not run | |
| WF-AUTH-05 | Protected page when signed out | none | New incognito window | Open `/accounts`, `/dashboard`, `/branches` | Each redirects to `/sign-in` (`/dashboard` and `/branches` add `?next=…`) | Manual (browser) / Playwright | Partially covered (`tests/api/authorization.test.mjs`) | Nadija | Vibodha | Not run | `workspace-layout` drops `?next` (F-38) |
| WF-AUTH-06 | Return to the page you asked for | agent_c1 | Signed out | Open `/sign-in?next=/customers`, sign in; then try `/sign-in?next=//evil.example` | First: lands on `/customers`. Second: lands on `/dashboard` (no off-site redirect) | Manual (browser) | Manual only | Nadija | Vibodha | Not run | |
| WF-AUTH-07 | Session expiry | admin + agent_c1 | As admin, set `SESSION_IDLE_TIMEOUT_MINUTES` = 1 (Controls) | Sign agent_c1 in, open `/accounts`, wait 70 s, click **Search accounts**; then `/branches` as a BM in another window after expiry | Should send the user to sign-in. Accounts page shows "Session expired or invalid." inline with Retry (no redirect); organisation pages redirect to `/sign-in?next=…` | Manual (browser) | Partially covered (`tests/e2e/sign-in.test.mjs`) | Nadija | Vibodha | Not run | Restore the value to 20 afterwards. Inconsistent expiry handling (F-38) |
| WF-AUTH-08 | Root URL | any | Signed in or not | Open `/` | Redirects to `/sign-in` (even when signed in) | Manual (browser) | Manual only | Nadija | Vibodha | Not run | |
| WF-AUTH-09 | Old sign-in sub-routes | any | — | Open `/sign-in/mfa`, `/sso`, `/hardware`, `/recovery`, `/onboarding`, `/enclave-access`, `/established` | Each redirects to `/sign-in`, no error | Manual (browser) | Manual only | Nadija | Vibodha | Not run | Leftover stubs (F-44) |
| WF-AUTH-10 | Sign out | agent_c1 | Signed in | **Sign out** in the top bar; then browser Back | Lands on `/sign-in`; Back shows sign-in again; DevTools: `mims_session` gone; `POST /api/auth/logout` 204 with `x-csrf-token` header | Manual (browser) / Playwright | Covered by existing test (`tests/e2e/sign-in.test.mjs`) | Nadija | Vibodha | Not run | `mims_csrf` not cleared (F-19) |
| WF-NAV-01 | Navigation per role | all 7 roles | Sign in as each | Compare the top bar with 03 §0 table | Links match exactly: e.g. ADMIN has Dashboard, Fixed deposits, Reports, Branches, Agents, Controls, Health (no Customers/Accounts); AGENT has Dashboard, Customers, Accounts, Transactions, Fixed deposits; CUSTOMER has none | Manual (browser) / Playwright | Manual only | Nadija | Vibodha | Not run | No links to RPT-02/03/04/05, `/plans`, `/interest-runs` (F-37) |
| WF-DASH-01 | Dashboard cards per role | all 7 roles | Signed in | Open `/dashboard`, click each card | Cards match 03 §2 table; each card opens its page without error | Manual (browser) / Playwright | Manual only | Nadija | Vibodha | Not run | CUSTOMER sees an empty grid; ADMIN has no Reconciliation card although allowed (F-37) |

### 2.2 Administration (ADMIN)

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-ADM-01 | View parameters | admin | | **Controls** → `/admin/parameters` | Table with 9 keys incl. `BUSINESS_HOUR_START` 08:30, `BUSINESS_HOUR_END` 17:00, `WITHDRAWAL_SINGLE_LIMIT` 100000.00, `WITHDRAWAL_DAILY_LIMIT` 200000.00 | Manual (browser) | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-ADM-02 | Parameters page denied to others | central_ops, agent_c1 | | Type `/admin/parameters` | Redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/parameters.test.mjs` — API) | Nadija | Vibodha | Not run | |
| WF-ADM-03 | Change business hours (data-driven rule) | admin | **Do this now if testing outside 08:30–17:00** | Edit `BUSINESS_HOUR_START` → `00:00`, **Save**; `BUSINESS_HOUR_END` → `23:59`, **Save** | "Saved BUSINESS_HOUR_START" etc.; values updated. SQL (owner): `SELECT actor_type, action FROM audit_log WHERE entity_type='system_parameter' ORDER BY logged_at DESC LIMIT 2;` → 2 UPDATE rows | Manual (browser) + SQL | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Vibodha | Not run | Audit `actor_type` is SYSTEM, should be the admin (F-11). Restore in WF-END-01 |
| WF-ADM-04 | Invalid parameter value | admin | | Edit `BUSINESS_HOUR_END` → `25:99`; edit `WITHDRAWAL_DAILY_LIMIT` → `abc` | Error message shown; value unchanged | Manual (browser) | Covered by existing test (`tests/api/parameters.test.mjs`) | Nadija | Vibodha | Not run | No client-side type check; `MIN_FD_PRINCIPAL` accepts any text (F-21) |
| WF-ADM-05 | Database health | admin, central_ops | | **Health** → `/admin/health` | Connection "Connected"; pool numbers; Applied migrations 51; Last migration `0620_p06_m02_interest_reference.sql`; uptime | Manual (browser) | Covered by existing test (`tests/api/health.test.mjs`) | Pramudith | Selith | Not run | |
| WF-ADM-06 | Health denied to others | agent_c1, auditor | | Type `/admin/health` | Redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/health.test.mjs`) | Pramudith | Selith | Not run | |
| WF-ADM-07 | Audit search | auditor | WF-ADM-03 wrote audit rows | Dashboard → **Audit trail**; Entity Type `system_parameter` → **Search**; then Action `UPDATE` | Rows with Time, Actor, Action, Entity, Changes; filtered correctly | Manual (browser) | Covered by existing test (`tests/api/audit.test.mjs` — API) | Nadija | Vibodha | Not run | No loading state, no paging beyond 20 rows (F-13) |
| WF-ADM-08 | Audit date filter | auditor | | Set **From** (date-time picker) to today 00:00 → **Search** | Rows from today only | Manual (browser) | Manual only | Nadija | Vibodha | Not run | **Known issue — likely Fail:** API rejects the value (400) and the page silently keeps old rows (F-13). Confirm in DevTools → Network |
| WF-ADM-09 | Audit page for non-auditors | agent_c1 | | Type `/admin/audit` | Should redirect to `/dashboard` (or show access denied) | Manual (browser) | Manual only | Nadija | Vibodha | Not run | **Known issue:** page opens and shows "No audit logs found." (data is safe; page gate missing, F-08) |

### 2.3 Organisation (branches and agents)

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-ORG-01 | Branch list by role | admin, bm_colombo, auditor, agent_c1 | | Open **Branches** as each | admin/auditor: 3 branches; bm_colombo: only Colombo Main; **Create branch** button only for admin; agent_c1: redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/organization.test.mjs`, `tests/e2e/branches-agents.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-02 | Create branch | admin | | **Create branch**: code `BR-MAT`, name `Matara`, district `Matara`, phone `0412222222`, address `1 Beach Rd` → **Create branch** | "Branch BR-MAT was created."; row appears. SQL: `SELECT * FROM branch WHERE branch_code='BR-MAT';` and an `audit_log` row (entity branch, INSERT) | Manual (browser) + SQL | Covered by existing test (`tests/e2e/branches-agents.test.mjs`) | Vibodha | Nisith | Not run | Audit actor is SYSTEM (F-11) |
| WF-ORG-03 | Duplicate branch code | admin | BR-MAT exists | Create again with code `BR-MAT` | Error message (duplicate code); no second row | Manual (browser) | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-04 | Deactivate branch (history kept) | admin | | **Deactivate** Colombo Main → confirm; then **Deactivate** BR-MAT → confirm; switch filter to **All records** | Colombo: error "branch with active agents cannot be deactivated" and stays ACTIVE. BR-MAT: "Branch BR-MAT was deactivated."; visible as INACTIVE under All records (not deleted) | Manual (browser) | Covered by existing test (`tests/e2e/branches-agents.test.mjs`, `tests/db/agent-constraints.test.mjs`) | Vibodha | Nisith | Not run | Dialog has no focus trap (F-56) |
| WF-ORG-05 | Agent list by role | admin, bm_colombo, central_ops, agent_c1 | | Open **Agents** | admin/CO: 6 seeded agents (managers not listed); bm_colombo: agent_c1, agent_c2 only; agent_c1: redirected | Manual (browser) | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-06 | Create agent (manager) | bm_colombo | | **Create ordinary agent**: username `agent_c3`, password `TempPassword123`, employee `EMP-C3`, NIC `199912345678`, name `Test Agent`, gender FEMALE, DOB 1999-01-01, hired 2026-01-01, email `agent.c3@example.com`, phone `0770000099`, address `Colombo` | Branch field locked to Colombo Main; "Agent EMP-C3 was created."; can now sign in as agent_c3 | Manual (browser) | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-07 | Agent validation and duplicates | bm_colombo | agent_c3 exists | Try password `short`; then same employee no `EMP-C3` with new username `agent_c4` | Browser blocks the short password ("Use at least 12 characters."); duplicate shows an error and no agent is created | Manual (browser) | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-08 | Deactivate agent | bm_colombo | agent_c3 | **Deactivate** agent_c3 → confirm; then try to sign in as agent_c3 | "Agent EMP-C3 was deactivated."; sign-in shows "Account is not active" | Manual (browser) | Covered by existing test (`tests/api/organization.test.mjs`) | Vibodha | Nisith | Not run | |

### 2.4 Products (savings plans and FD products)

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-PLAN-01 | View savings plans | agent_c1 | | Type `/plans` | 5 plans: Children 12% / 0.00, Teen 11% / 500.00, Adult 10% / 1,000.00, Senior 13% / 1,000.00, Joint 7% / 5,000.00 with eligibility text; **no Edit** buttons | Manual (browser) | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | No nav link (F-37) |
| WF-PLAN-02 | Edit a plan | central_ops | | `/plans` → **Edit** Adult → Description `Adult savings (tested)` → **Save changes** | Page reloads with the new description | Manual (browser) | Covered by existing test (`tests/api/plans.test.mjs`, `tests/e2e/plan-edit-ui-model.test.mjs`) | Nisith | Pramudith | Not run | No audit row is written (F-11) |
| WF-PLAN-03 | Plan validation and dialog behaviour | central_ops | | Edit Adult: Min age 60, Max age 18 → Save; Rate `1.5` → Save; press **Esc** | Inline errors; nothing saved; Esc closes; focus returns to the Edit button; Tab stays inside the dialog | Manual (browser) | Covered by existing test (`tests/e2e/plan-edit-ui-model.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-PLAN-04 | Read-only roles | auditor, bm_colombo | | Open `/plans` | No Edit buttons; customer_adult_one is redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/plans.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-FDP-01 | View FD products | auditor | | Dashboard → **FD products** | "Active products": 3 rows — 6/12/36 months at 13.00% / 14.00% / 15.00%; history table; no edit controls | Manual (browser) | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | |
| WF-FDP-02 | Change an FD rate | admin | | **Edit rate** on the 12-month product → `0.1450` → **Review change** → **Confirm** | "The new rate was saved with its effective-date history."; Active shows 14.50%; the old 14.00% row moves to history with Effective to = today | Manual (browser) | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | No audit row (F-11); old row renamed "(expired …)" (F-23) |
| WF-FDP-03 | Invalid rate | admin | | Edit rate `1.5`, then `0`, then `0.145` vs the current `0.1450` | First two: "Interest rate must be greater than 0 and no more than 1, with up to four decimal places."; third should be "no change" | Manual (browser) | Covered by existing test (`tests/api/fd-products.test.mjs`) | Selith | Nadija | Not run | `0.145` vs `0.1450` creates another version (string compare, F-23) |
| WF-FDP-04 | FD products page access | customer_adult_one, agent_c1 | | Type `/fd-products` | Staff: read-only list. CUSTOMER: should be denied (docs: staff only) | Manual (browser) | Manual only | Selith | Nadija | Not run | Known issue — any signed-in role can view (F-23) |

### 2.5 Customers

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-CUS-01 | Search customers (scope) | agent_c1, bm_colombo, central_ops | | **Customers** → **Search customers** (blank); then `q` = `Adult`; sort by Customer number desc; Next page | agent_c1: only Child One, Teen One, Adult One, Adult Two; identity masked `***…`. bm_colombo: the 5 Colombo customers. central_ops: all 15, unmasked | Manual (browser) / Playwright | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | Count label has no singular ("1 customers found") |
| WF-CUS-02 | Register a customer | agent_c1 | | **Register customer**: Full name `Test Customer`, NIC `200012345678`, DOB `2000-05-05`, email `test.customer@example.com`, agent "You (current agent)", **Add document reference** → type `NIC`, ref `/docs/test.pdf` → **Register customer** | Redirects to the new profile; Documents shows "NIC · Unverified"; assignment history shows agent_c1 Current. SQL: 1 `customer`, 1 `customer_document` (`verified_by` NULL), 1 active `customer_agent`, 1 `audit_log` (entity customer, masked NIC) | Manual (browser) + SQL / Playwright | Covered by existing test (`tests/api/customers.test.mjs`, `tests/db/customer-registration-transaction.test.mjs`) | Vibodha | Nisith | Not run | Save the customer id as `NEW_CUS` |
| WF-CUS-03 | Duplicate identity (atomic rollback) | agent_c1 | WF-CUS-02 done | Register again with NIC `200012345678`, email `other@example.com` | Error "duplicate identity"-style message; SQL: customer count unchanged; no orphan documents/assignments | Manual (browser) + SQL | Covered by existing test (`tests/api/master-data-integrity.test.mjs`) | Vibodha | Nisith | Not run | Demo point: no partial row is left |
| WF-CUS-04 | Registration validation | agent_c1 | | NIC `ab`; DOB tomorrow; email `not-an-email`; 0 documents; full name 151 characters | Browser or server blocks each invalid field; 0 documents is allowed | Manual (browser) | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | Raw `SyntaxError` text can appear on non-JSON errors (F-38) |
| WF-CUS-05 | View a customer profile | agent_c1 | Seeded customer 03 | Search `Adult One` → click the name | Details; assignment history (agent_c1 Current); documents "Verified"; Savings accounts BR-COL-00000003 and BR-COL-00000005 with balances; Fixed deposits table filled | Manual (browser) | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-CUS-06 | Cross-branch customer access | agent_k1, bm_kandy | Customer 03 id `…0501-000000000003` | Type `/customers/00000000-0000-0000-0501-000000000003`; search `Adult One` | Profile shows a not-found error (no data); search returns no Colombo customers | Manual (browser) | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-CUS-07 | Customer self-service profile | customer_adult_one | | Sign in; type `/customers/00000000-0000-0000-0501-000000000003`; then `…0004`; then `/customers` | Own profile visible (no "Back to search"); `…0004` → not-found error; `/customers` → redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/customers.test.mjs`) | Vibodha | Nisith | Not run | CUSTOMER has no navigation (F-37) |
| WF-CUS-08 | Customer FD panel | customer_adult_one, central_ops | Seed FDs on 003/005 | On customer 03's profile, look at **Fixed deposits** | Rows with savings account, product, principal, rate at opening, opened, maturity, next interest, status | Manual (browser) | Covered by existing test (`tests/api/customer-fixed-deposits.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-CUS-09 | Open an account for a newly registered customer | agent_c1 | `NEW_CUS` from WF-CUS-02 | **Accounts → Open account** → plan Adult → add `Test Customer` → Review → **Confirm and open account** | Should open, or the UI should offer a document-verification step | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs` — asserts the rejection) | Vibodha / Nisith | Pramudith | Not run | **Known issue — Fail by design gap:** `DOCUMENTS_NOT_VERIFIED`; no page or API can verify documents (F-07) |

### 2.6 Accounts

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-ACC-01 | Account list (scope, filters, sort) | agent_c1, bm_colombo, auditor | | **Accounts** → **Search accounts**; filter Plan = Joint; sort by Balance desc | agent_c1: accounts of customers 01–04 (001, 002, 003, 005); bm_colombo: all 5 Colombo accounts; auditor: all 10; "+ 1 joint" on joint rows | Manual (browser) / Playwright | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-02 | Open an individual account | agent_c1 | Customer 04 Adult Two (verified doc); business hours open | **Open account** → Plan **Adult** → search `Adult Two` → **Add** → Initial deposit `1500.00` → **Review account opening** → **Confirm and open account** | Lands on `/accounts/{id}?notice=opened` "Account opened."; balance LKR 1,500.00; holder Adult Two. SQL: account row, holder row, OPEN- deposit with `balance_after` 1500.00, `account_opening_request` row | Manual (browser) + SQL / Playwright | Covered by existing test (`tests/api/accounts.test.mjs`, `tests/db/sp-open-savings-account.test.mjs`) | Nisith | Pramudith | Not run | Save as `ACC_NEW` (account number and id). Opening deposit has no agent attribution (F-10) |
| WF-ACC-03 | Eligibility rejection | agent_c1 | | Plan **Adult** + Child One (age 11) → Review → Confirm | Error "plan eligibility"-style message near the plan/holders; no account | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | `fn_check_plan_eligibility` reads ages from `savings_plan` |
| WF-ACC-04 | Below minimum deposit | agent_c1 | | Plan **Adult** + Adult Two, deposit `500.00` → Confirm | Error under the deposit field (`BELOW_MINIMUM_BALANCE`) | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-05 | Open a joint account | bm_colombo | Customers 04 + 05 | Plan **Joint** → add Adult Two and Senior One → mandate **All holders together** → deposit `6000.00` → Review → Confirm | "Account opened."; 2 holders; "Who can authorise withdrawals" = all holders, state Effective | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | Save as `JOINT_NEW` |
| WF-ACC-06 | Joint account rules | bm_colombo | | Plan Joint with 1 holder → look at the review button; then Joint with Child One + Adult Two → Confirm | "Add at least 2 holders…" and **Review** disabled; then `UNDERAGE_HOLDER` error | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`, `tests/db/joint-mandate-trigger.test.mjs`) | Nisith | Pramudith | Not run | Trigger `trg_validate_joint_mandate` |
| WF-ACC-07 | Double submit / replay is idempotent | agent_c1 | | Open an account for Teen One (Teen plan, deposit `600.00`); double-click **Confirm**; then browser Back and Confirm again without changes | One account only; second attempt lands on `?notice=existing` "This account was already opened by an earlier submission. Nothing was changed." SQL: one new account for customer 02 | Manual (browser) + SQL | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-08 | Account detail page | agent_c1 | BR-COL-00000003 | Open the account from the list | Current balance; Available to withdraw = balance − 1,000.00; last transaction; plan Adult, "1 of 1 allowed"; holders table; Fixed deposits table with the seed FD and the note that an active FD blocks closing | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`, `tests/e2e/accounts-ui-model.test.mjs`, `tests/e2e/account-fixed-deposits-panel.test.mjs`) | Nisith | Pramudith | Not run | No link to a statement; no Close button |
| WF-ACC-09 | Add a joint holder | bm_colombo | Seed joint BR-COL-00000005 (03 + 04) | Open it → **Find the customer to add** `Senior One` → **Select** → **Confirm and add holder** | "Senior One was added as a joint holder."; holders "3 of 4 allowed" | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`, `tests/db/sp-add-account-holder.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-10 | Add holder blocked | bm_colombo, agent_c1 | | Open BR-COL-00000003 as BM; open BR-COL-00000005 as agent_c1 | BM on 003: "This is a single-holder plan."; agent: no add-holder section | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-11 | Cross-branch account access | agent_k1 | | Type `/accounts/00000000-0000-0000-0801-000000000003` | Not-found error, no data | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-12 | Customer sees own accounts | customer_adult_one | | Type `/accounts/00000000-0000-0000-0801-000000000003`, then `…0005`, then `…0007` | 003 and 005 visible (no browse/add-holder controls); 007 not found | Manual (browser) | Covered by existing test (`tests/api/accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-ACC-13 | Close an account (API only) | bm_colombo | 003 has balance + FD | 05 API-ACC-16 and API-ACC-17 | 003 → `BALANCE_NOT_ZERO`; a fresh zero-balance account closes (200, `CLOSED`); closing again → `ACCOUNT_ALREADY_CLOSED` | Postman/curl | Covered by existing test (`tests/api/accounts.test.mjs`, `tests/db/sp-close-account.test.mjs`) | Nisith | Pramudith | Not run | No Close button in the UI |
| WF-ACC-14 | "Open a fixed deposit" link | agent_c1 | | On BR-COL-00000003 click **Open a fixed deposit** | Should open an FD form for that account | Manual (browser) | Manual only | Nisith / Selith | Pramudith | Not run | **Known issue:** goes to the mockup `/fixed-deposits/new`, which ignores `accountId` (F-08, F-25) |

### 2.7 Transactions (API — the transaction screens are mockups)

Owner of this slice is **Pramudith**. The Notes column names who implemented each part.

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-TXN-01 | Post a deposit | agent_c1 | Business hours open; `$CH` (05 §0); note balance B0 of BR-COL-00000003 | 05 API-TXN-01 (key `dep-acc3-0001`, 2500.00) | 201, `balanceAfter` = B0 + 2500.00. SQL: DEPOSIT row with `balance_after`, `account.current_balance` updated, audit `DEPOSIT`. UI: account page shows new balance and last transaction | Postman/curl + SQL + Manual (browser) | Partially covered (DB level only: `tests/db/sp-post-deposit.test.mjs`; API test is a placeholder) | Pramudith | Vibodha | Not run | Route by Selith on Pramudith's behalf; `sp_post_deposit` by Pramudith. `agent_id` NULL (F-10) |
| WF-TXN-02 | Deposit replay (same key) | agent_c1 | WF-TXN-01 | Repeat the exact request | 200, same `transactionId`; balance moved once | Postman/curl + SQL | Partially covered (DB level only: `tests/db/transaction-reference-idempotency.test.mjs`) | Pramudith | Vibodha | Not run | Implemented by Selith (route) on Pramudith's behalf |
| WF-TXN-03 | Deposit key reused with a different body | agent_c1 | | Same key, amount `9999.00` | Should be rejected (409/422) | Postman/curl | Manual only | Pramudith | Vibodha | Not run | **Known issue — likely Fail (F-04)** |
| WF-TXN-04 | Deposit scope | agent_k1, agent_c1 | | agent_k1 deposits to BR-COL-00000003; agent_c1 deposits to BR-COL-00000004 (customer 05, assigned to agent_c2) | agent_k1: 404 `ACCOUNT_NOT_FOUND`, no change. agent_c1 on 004: should match the accounts rule (not assigned → refused) | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Known issue — agent_c1 can deposit to non-assigned accounts in the branch (F-27). Implemented by Selith on Pramudith's behalf |
| WF-TXN-05 | Post a withdrawal | agent_c1 | Account 003 balance ≥ 1,100 | 05 API-TXN-07 (100.00, `onBehalfOfCustomerId` = customer 03) | 201; balance −100.00; WITHDRAWAL row has `agent_id` = agent_c1 | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-post-withdrawal.test.mjs`; API test is a placeholder) | Pramudith | Nisith | Not run | **Known issue — expected Fail: 500 (F-01).** Implemented by Selith on Pramudith's behalf; repaired by Vibodha. If it fails, mark WF-TXN-06…11 **Blocked** and run their SQL equivalents DB-TXN-06…09 instead |
| WF-TXN-06 | Withdrawal below plan minimum | agent_c1 | Teen BR-COL-00000002 | Withdraw (balance − 400.00) | 409 `BELOW_MINIMUM_BALANCE`; no ledger row; audit `WITHDRAWAL_REJECTED` | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01; rejection audit missing in the API path (F-06). Implemented by Selith on Pramudith's behalf |
| WF-TXN-07 | Withdrawal larger than balance (no overdraft) | agent_c1 | 003 | Amount = balance + 1.00 | 409 `INSUFFICIENT_FUNDS`; balance unchanged | Postman/curl | Partially covered (DB level only) | Pramudith | Nisith | Not run | Blocked by F-01. Implemented by Selith on Pramudith's behalf |
| WF-TXN-08 | Single withdrawal limit | agent_c1 | Account with > 100,000.01 (deposit first) | Withdraw `100000.01` | 409 `LIMIT_EXCEEDED` | Postman/curl | Partially covered (DB level only: `tests/db/sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01 |
| WF-TXN-09 | Joint mandate and customer self-service | bm_kandy, customer_adult_one | BR-KAN-00000001 (ALL_HOLDERS) | bm_kandy withdraws 100.00 on behalf of customer 08; customer_adult_one withdraws 50.00 from 003 | 409 `MANDATE_NOT_SATISFIED`; customer withdrawal 201 | Postman/curl | Partially covered (DB level only: `tests/db/fn-check-withdrawal-mandate.test.mjs`) | Pramudith | Nisith | Not run | Blocked by F-01; API cannot send several signers and customer path uses the wrong id (F-05) |
| WF-TXN-10 | Outside business hours | admin + agent_c1 | | Admin sets `BUSINESS_HOUR_END` to a past time today; agent posts a deposit (new key); admin restores | 409 `OUTSIDE_BUSINESS_HOURS`; no ledger row | Manual (browser) + Postman/curl | Partially covered (DB level only: `tests/db/business-hours-limits.test.mjs`) | Pramudith | Vibodha | Not run | Shows BR-08 is data-driven |
| WF-TXN-11 | Withdrawal replay | agent_c1 | WF-TXN-05 passed | Repeat API-TXN-07 | 200 same id; balance moved once | Postman/curl | Partially covered (DB level only) | Pramudith | Nisith | Not run | Blocked by F-01 |
| WF-TXN-12 | Statement (API) | agent_c1 | After WF-TXN-01 | 05 API-TXN-15 | Newest first; includes the deposit with correct `balanceAfter`; `meta.total` = ledger count for 003 | Postman/curl + SQL | Manual only | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf. Statement **page** is a mockup (UI-MOCK-01) |
| WF-TXN-13 | Transaction detail (API) | agent_c1 | `DEP_TXN` | 05 API-TXN-17 | Fields match the ledger row; `isReversed` false | Postman/curl | Manual only | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf |
| WF-TXN-14 | Reverse a transaction | agent_c1, bm_colombo | `DEP_TXN` | agent_c1 tries 05 API-TXN-19 (403); bm_colombo runs API-TXN-20 | 403 for the agent; 201 for the manager; balance −2500.00; original row unchanged; REVERSAL row + `transaction_reversal` link + audit `REVERSED` | Postman/curl + SQL | Partially covered (DB level only: `tests/db/sp-reverse-transaction.test.mjs`; route auth `tests/api/reversal.test.mjs`) | Pramudith | Vibodha | Not run | Reversal routine by Selith on Pramudith's behalf; manager-only route check by Nadija. Reversal reference not returned (F-16) |
| WF-TXN-15 | Cross-branch reversal must fail | bm_kandy | New Colombo deposit `DEP_TXN2` | 05 API-TXN-23; then `SELECT * FROM vw_reconciliation_balance WHERE discrepancy <> 0;` (owner) | 403/404; no ledger change; no discrepancy | Postman/curl + SQL | Manual only | Pramudith | Vibodha | Not run | **Known issue — Critical F-02.** A committed probe corrupts `mims_dev`: prefer DB-TXN-11 (rolled back), or reset after |
| WF-TXN-16 | Reverse twice | bm_colombo | WF-TXN-14 done | 05 API-TXN-21 | 409 `ALREADY_REVERSED`; reversing the REVERSAL row → 409 | Postman/curl | Partially covered (DB level only: `tests/db/sp-reverse-transaction.test.mjs`) | Pramudith | Vibodha | Not run | |
| WF-TXN-17 | Ledger is immutable | — | | 06 DB-TXN-02 (owner and app) | owner: `TRANSACTION_IMMUTABLE`; app: permission denied | SQL | Covered by existing test (`tests/db/transaction-immutability.test.mjs`) | Pramudith | Selith | Not run | |
| WF-TXN-18 | Concurrent withdrawals cannot overspend (AC-06) | — | | Run `LC_ALL=en_US.UTF-8 npm run test:db` and point at `concurrent-withdrawals.test.mjs` results, or do 06 DB-TXN-15 in two psql windows | Exactly one of two racing withdrawals succeeds; no negative or below-minimum balance | SQL / npm | Covered by existing test (`tests/db/concurrent-withdrawals.test.mjs`) | Pramudith / Nisith | Vibodha | Not run | Lock by Selith on Pramudith's behalf; tests by Nisith. Strongest demo item for examiners |

### 2.8 Fixed deposits and interest (SQL — no API/UI path exists)

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-FD-01 | Open an FD | owner (SQL) + agent_c1 (API) | `ACC_NEW` from WF-ACC-02 (no FD) | Deposit 120000.00 to `ACC_NEW` via 05 API-TXN-01 (new key). Then as owner: `SELECT sp_open_fixed_deposit('<ACC_NEW id>', (SELECT fd_plan_id FROM fd_plan WHERE tenure_months=12 AND status='ACTIVE'), 100000.00, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER'));` (**commits**) | Returns an `fd_id`; account balance −100,000.00; FD has rate snapshot 0.1450 (after WF-FDP-02), maturity +12 months, next interest +30 days; ledger WITHDRAWAL "Fixed Deposit Opening Principal Debit"; audit `FD_OPENED` | SQL + Postman/curl | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | No app path (F-25); debit typed as WITHDRAWAL (F-30) |
| WF-FD-02 | Second active FD rejected | owner | WF-FD-01 | Run the same SELECT again with 10000.00 | `23505 uq_one_active_fd_per_account`; balance unchanged | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | AC-08 |
| WF-FD-03 | FD on insufficient balance / inactive account | owner | | 06 DB-FD-05 b) and c) (rolled back) | "Insufficient balance…"; "Account is not active…" | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | Error text reveals balances (F-30) |
| WF-FD-04 | New FD visible across the app | agent_c1, customer, central_ops | WF-FD-01 | Open `ACC_NEW` detail page; customer Adult Two profile; `GET /api/reports/active-fds` | FD shown in the account FD panel and customer FD panel with rate at opening 14.50%; present in RPT-03 API rows | Manual (browser) + Postman/curl | Partially covered (`tests/e2e/account-fixed-deposits-panel.test.mjs`, `tests/api/customer-fixed-deposits.test.mjs`) | Selith / Nisith / Vibodha | Pramudith | Not run | Cross-member read paths |
| WF-FD-05 | App role cannot open FDs or run interest | app (SQL) | | 06 DB-FD-06 and DB-INT-05 | `42501` | SQL | Manual only | Selith | Nadija | Not run | Confirms F-25 |
| WF-INT-01 | Run an interest cycle | owner (SQL) | WF-FD-01 | `SELECT sp_run_interest_cycle(CURRENT_DATE, '00000000-0000-0000-0401-000000000021');` (**commits**), then 06 DB-INT-03 queries (without BEGIN/ROLLBACK) | Run COMPLETED; one payout per due ACTIVE FD; each = `fn_calculate_fd_interest(principal, rate_at_opening)`; one INTEREST_CREDIT per payout; `next_interest_date` +30 days | SQL | Covered by existing test (`tests/db/sp-run-interest-cycle.test.mjs`) | Selith | Nadija | Not run | All FDs in one call, no maturity handling (F-29). Interest credit routine by Selith/Vibodha on Pramudith's behalf |
| WF-INT-02 | Re-run is idempotent | owner (SQL) | WF-INT-01 | Run the same SELECT again | `23505 interest_run_cycle_date_key`; payout and ledger counts unchanged | SQL | Covered by existing test (`tests/db/interest-idempotency.test.mjs`) | Selith | Nadija | Not run | AC-08 / NFR-SAFE-03 |
| WF-INT-03 | Interest credit in the statement | agent_c1 | WF-INT-01 | `GET /api/accounts/<ACC_NEW>/transactions` | Top row INTEREST_CREDIT with `balanceAfter` = previous + interest; reference `INT-YYYYMMDD-…` | Postman/curl | Covered by existing test (`tests/db/transaction-running-balance.test.mjs`) | Pramudith / Selith | Vibodha | Not run | Statement by Selith on Pramudith's behalf; statement page is a mockup |
| WF-INT-04 | Request a run from the app | central_ops | | 05 API-INT-01 | 200 `{status:"STARTED"}`; 1 audit `INTEREST_RUN_INITIATED`; **no** new `interest_run` row | Postman/curl + SQL | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Vibodha | Not run | The request does not run the cycle (F-25) |
| WF-INT-05 | Worker token | worker | | 05 API-INT-02 | 200; audit actor SYSTEM | Postman/curl | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-INT-06 | Run request denied | agent_c1, bad token | | 05 API-INT-03 | 403; 401; 400 | Postman/curl | Covered by existing test (`tests/api/interest-runs.test.mjs`) | Nadija | Vibodha | Not run | |

### 2.9 After transactions: agent activity, reports, reconciliation

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-ORG-09 | Own daily activity | agent_c1 | WF-TXN-01 etc. done | **Customers** → **My daily activity** → **Today**; then From 2026-01-01 To today → **Show activity** | Table of Deposits / Withdrawals / Interest credits / Reversals with counts and totals for agent_c1; matches `SELECT transaction_type, count(*), sum(amount) FROM transaction WHERE agent_id='…0401-000000000011' GROUP BY 1;` | Manual (browser) + SQL | Covered by existing test (`tests/api/agent-activity.test.mjs`, `tests/e2e/agent-activity-dates.test.mjs`) | Vibodha | Nisith | Not run | API deposits are missing because they are unattributed (F-10) |
| WF-ORG-10 | Manager views an agent | bm_colombo, bm_kandy | | bm_colombo: **Agents** → click Kamal Perera. bm_kandy: type `/agents/00000000-0000-0000-0401-000000000011/activity` | bm_colombo: activity shown, scope note "recorded at your branch". bm_kandy: access error message | Manual (browser) | Covered by existing test (`tests/api/agent-activity.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-ORG-11 | Agent cannot view another agent | agent_c1 | | Type `/agents/00000000-0000-0000-0401-000000000012/activity` | Access error message (403) | Manual (browser) | Covered by existing test (`tests/api/agent-activity.test.mjs`) | Vibodha | Nisith | Not run | |
| WF-RPT-01 | RPT-01 agent-wise totals + CSV | central_ops | | **Reports** → From 2026-01-01, To today → **Apply filters**; **Export CSV · all filtered rows** | Rows per agent/branch with counts and LKR totals; Page subtotal and Grand total; metadata (generated at, requested by, scope). CSV GRAND_TOTAL equals the screen grand total exactly | Manual (browser) / Playwright | Covered by existing test (`tests/api/rpt01-report.test.mjs`, `tests/e2e/rpt01-report-model.test.mjs`) | Vibodha | Nisith | Not run | Report shell by Nadija (I-7) |
| WF-RPT-02 | RPT-01 totals vs ledger | central_ops | | Compare the grand total with 06 DB-RPT-01 cross-check query; read the "Excluded unattributed transactions" line | Grand total = attributed ledger sum; exclusions line shows the unattributed count | Manual (browser) + SQL | Covered by existing test (`tests/db/rpt01-runtime.test.mjs`) | Vibodha | Nisith | Not run | Most deposits are excluded because they are unattributed (F-10) |
| WF-RPT-03 | RPT-01 branch scope | bm_colombo, agent_c1 | | bm_colombo: open Reports; agent_c1: type `/reports/agent-transactions` | BM: branch selector locked to Colombo Main, only Colombo rows. Agent: redirected to `/dashboard` | Manual (browser) | Covered by existing test (`tests/api/rpt01-report.test.mjs`) | Vibodha | Nisith | Not run | Demo point: scope is in the SQL |
| WF-RPT-04 | RPT-02 account summary + CSV | auditor | | Type `/reports/account-summary`; From 2026-01-01 To today; Status Active → Apply; Export CSV | One row per account: opening balance, counts and totals by type, closing balance, net movement. Closing balance equals the account's current balance (BR-COL-00000003 etc.). CSV totals = screen totals | Manual (browser) | Covered by existing test (`tests/api/rpt02-report.test.mjs`, `tests/e2e/account-summary-report-screen.test.mjs`) | Nisith | Pramudith | Not run | No inbound link (F-37) |
| WF-RPT-05 | RPT-02 branch scope | bm_colombo | | Same page | Branch locked to Colombo; only Colombo accounts | Manual (browser) | Covered by existing test (`tests/api/rpt02-report.test.mjs`) | Nisith | Pramudith | Not run | |
| WF-RPT-06 | RPT-05 customer activity | central_ops | | Type `/reports/customer-activity`; From 2026-01-01, To today → Apply; sort by Net | One row per customer; Net = deposits + interest − withdrawals; Adult One and Adult Two both include joint account 005 activity; footer "Totals count joint activity once per holder." | Manual (browser) | Covered by existing test (`tests/api/rpt05-report.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Nadija on Pramudith's behalf. Branch/Account/Plan filters are free-text UUIDs |
| WF-RPT-07 | RPT-05 CSV covers all rows | central_ops | | Set page size 5 (API: `&pageSize=5`) and click **Export CSV** | CSV contains every filtered customer, totals match the screen | Manual (browser) + Postman/curl | Manual only | Pramudith | Nisith | Not run | **Known issue — CSV has only the current page (F-14).** Implemented by Nadija on Pramudith's behalf |
| WF-RPT-08 | RPT-03 active FDs (API) | central_ops, no session | | 05 API-RPT-06 and API-RPT-07 | JSON rows for each ACTIVE FD with next interest date and estimated payout; 401 without a session | Postman/curl | Manual only | Selith | Nadija | Not run | **Known issue — 500 instead of 401/403; totals as JS numbers (F-09).** Page is a mockup (UI-MOCK-08) |
| WF-RPT-09 | RPT-04 interest distribution (API) | central_ops | WF-INT-01 | 05 API-RPT-09 and API-RPT-10 | Rows by cycle / plan / branch with ROLLUP subtotals; grand total = `SUM(interest_payout.interest_amount)` | Postman/curl + SQL | Manual only | Selith | Nadija | Not run | `planId` filter compares names; CSV totals blank (F-09). Page is a mockup (UI-MOCK-09) |
| WF-RPT-10 | Report access is audited | auditor | WF-RPT-01…09 | Audit page: Action `REPORT_ACCESSED` → Search | One row per report request with the filters in Changes | Manual (browser) | Covered by existing test (`tests/api/rpt01-report.test.mjs`, `rpt02-report.test.mjs`, `rpt05-report.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-REC-01 | Reconciliation page | central_ops, auditor, admin | | Dashboard → **Reconciliation** (admin: type `/reconciliation`) | "Ledger Reconciliation"; green status "N accounts and M transactions reconciled. 0 account discrepancies and 0 transaction discrepancies found." | Manual (browser) | Covered by existing test (`tests/db/reconciliation.test.mjs` — views only, as owner) | Pramudith | Nisith | Not run | **Known issue — likely Fail: "permission denied" error page, the app role has no grant on the views (F-12).** Implemented by Nadija on Pramudith's behalf |
| WF-REC-02 | Reconciliation denied to others | agent_c1, bm_colombo | | Type `/reconciliation` | Should redirect to `/dashboard` | Manual (browser) | Manual only | Pramudith | Nisith | Not run | Known issue — redirects to `/unauthorized` (404) (F-12). Implemented by Nadija on Pramudith's behalf |
| WF-REC-03 | Ledger still reconciles after the session | owner (SQL) | All money tests done | 06 DB-REC-01 and DB-REC-02 | 0 discrepancies (unless the F-02 probe was committed) | SQL | Covered by existing test (`tests/db/reconciliation.test.mjs`) | Pramudith | Nisith | Not run | Data-consistency check for the whole session. Views by Nadija on Pramudith's behalf |

### 2.10 Security checks across the app

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-SEC-01 | Unauthenticated API calls | none | | `curl -i $BASE/api/customers`, `/api/accounts`, `/api/plans`, `/api/audit` | 401 each, JSON error body, no data | Postman/curl | Covered by existing test (`tests/api/authorization.test.mjs` and per-route tests) | Nadija | Vibodha | Not run | |
| WF-SEC-02 | CSRF required on every change | agent_c1 | | 05 API-SEC-01 | 403 `FORBIDDEN` without or with a wrong `x-csrf-token`; nothing changes | Postman/curl | Partially covered (`tests/api/authorization.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-SEC-03 | URL / body tampering across branches | bm_colombo | | 05 API-CUS-03, API-ACC-10 (Kandy `branchId`), API-RPT-03 | 403 every time | Postman/curl | Covered by existing test (`tests/api/customers.test.mjs`, `accounts.test.mjs`, `rpt01-report.test.mjs`) | Nadija / Vibodha / Nisith | Pramudith | Not run | AC-11 |
| WF-SEC-04 | Transaction read scope | agent_k1, customer_adult_one | `DEP_TXN` (Colombo) | 05 API-TXN-18; as customer, call it for a Kandy transaction id | 404 for both | Postman/curl | Manual only | Pramudith | Vibodha | Not run | **Known issue — likely Fail: full data returned (F-03).** Route by Selith on Pramudith's behalf; RLS is Nadija's slice |
| WF-SEC-05 | No internal details in errors | any | | 05 API-SEC-03; also watch DevTools Network responses during the whole session | Only `{error:{code,message}}`; no SQL, stack traces, table names or hashes | Postman/curl + Manual (browser) | Partially covered | Nadija | Vibodha | Not run | Raw RAISE text can leak in some paths (F-20) |
| WF-SEC-06 | SQL injection and XSS probes in the UI | agent_c1 | | Customer search `' OR 1=1 --`; account search `%27; DROP TABLE account; --`; register a customer named `<img src=x onerror=alert(1)>` (NIC `200099999999`, new email) | Search returns 0 rows or normal results, no error; the name is shown as plain text everywhere (profile, lists, reports); no script runs | Manual (browser) | Partially covered (`tests/api/customer-service.test.mjs` injection literals) | Vibodha / Nisith | Pramudith | Not run | Do not use `<script>`/`alert` payloads that open a dialog while browser automation is running |
| WF-SEC-07 | Security headers and cookie flags | any | | DevTools → Network → any document response; Application → Cookies | Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. `mims_session`: HttpOnly, SameSite=Lax (Secure only in production) | Manual (browser) | Covered by existing test (`tests/security/deployment-security.test.mjs`) | Nadija | Vibodha | Not run | No CSP (F-47) |
| WF-SEC-08 | Reused session after sign-out | agent_c1 | | Copy `mims_session` value from DevTools, sign out, then `curl -b "mims_session=<value>" $BASE/api/accounts` | 401 (session revoked on the server) | Postman/curl | Covered by existing test (`tests/e2e/sign-in.test.mjs`) | Nadija | Vibodha | Not run | |
| WF-SEC-09 | Pages open only to permitted roles | customer_adult_one, agent_c1 | | As CUSTOMER type: `/transactions/deposit`, `/interest-runs`, `/fixed-deposits`, `/admin/users`, `/admin/audit`, `/fd-products`, `/reports/active-fds` | Each should redirect to `/dashboard` | Manual (browser) | Manual only | Nadija | Vibodha | Not run | **Known issue — all open (session-only layout, F-08)**. They show mockups or empty data, not real data |
| WF-END-01 | Restore settings after the session | admin | | Set `BUSINESS_HOUR_START` 08:30, `BUSINESS_HOUR_END` 17:00, `SESSION_IDLE_TIMEOUT_MINUTES` 20, `MIN_FD_PRINCIPAL` 10000.00 (if changed); optionally `npm run db:rebuild -- --reset` | Values restored | Manual (browser) | Manual only | Nadija | Vibodha | Not run | |

### 2.11 Mockup pages (static screens, no backend)

Each mockup is checked for: **loads with no console errors**, **navigation in and out
works**, **sample data displays exactly as listed**, and **buttons do nothing harmful**.
These are **not** working features.

| Test ID | Workflow | Role | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| UI-MOCK-01 | Statement page `/accounts/[id]/statement` | agent_c1 | | Type `/accounts/00000000-0000-0000-0801-000000000003/statement`; click a reference; Back | Loads, no console errors. Title **SAV-100284**, "Nadeesha Perera · Current balance LKR 42,500.00"; table rows `DEP-20260927-00128 … + LKR 10,000.00 … LKR 42,500.00`, `WDL-20260916-00082 … − LKR 2,500.00 … LKR 32,500.00`, `INT-20260830-00018 … + LKR 120.00 … LKR 35,000.00`. Reference opens `/transactions/demo` (UI-MOCK-04); Back returns. **Download statement** / **Apply date range** do nothing | Manual (browser) / Playwright | Manual only | Pramudith | Vibodha | Not run | **Mockup — no backend.** Static screen built by Nadija. No inbound link; the account id is ignored |
| UI-MOCK-02 | Deposit page `/transactions/deposit` | agent_c1 | | Top bar **Transactions**; fill Amount `123`; **Review deposit**; **Back to edit**; **Review deposit**; **Confirm when service is connected** | Loads; header "Post a deposit"; account options `SAV-100284 · Nadeesha Perera · LKR 42,500.00`, `SAV-100301 · Kamal Jayasinghe · LKR 18,220.00`; channels Cash counter / Mobile agent / Bank transfer. Confirmation always shows **+ LKR 10,000.00** and projected **LKR 52,500.00** (not your input). Confirm does nothing; no network request in DevTools | Manual (browser) / Playwright | Manual only | Pramudith | Vibodha | Not run | **Mockup — no backend.** Built by Nadija. Real API: WF-TXN-01 |
| UI-MOCK-03 | Withdrawal page `/transactions/withdraw` | agent_c1 | | Type the URL; **Review withdrawal**; Back to edit | Loads; "Post a withdrawal"; On behalf of holder options "Nadeesha Perera — primary holder", "Kamal Jayasinghe — authorised holder"; confirmation **− LKR 10,000.00**, projected **LKR 32,500.00**; no network request | Manual (browser) / Playwright | Manual only | Pramudith | Vibodha | Not run | **Mockup — no backend.** Built by Nadija. No nav link |
| UI-MOCK-04 | Transaction detail `/transactions/[id]` | agent_c1 | | Type `/transactions/demo` and `/transactions/<DEP_TXN>` | Both show the same: **DEP-20260927-00128**, "Immutable posted entry · 27 Sep 2026 10:12 · Colombo Main", Account SAV-100284, Deposit, + LKR 10,000.00, Balance after LKR 42,500.00, Channel Cash counter; **Request manager reversal** does nothing | Manual (browser) / Playwright | Manual only | Pramudith | Vibodha | Not run | **Mockup — no backend.** Built by Nadija. Real API: WF-TXN-13/14 |
| UI-MOCK-05 | FD list `/fixed-deposits` | agent_c1 | | Top bar **Fixed deposits**; click **Open fixed deposit**; Back | Loads; rows `FD-00082 \| SAV-100284 \| 12 month Growth \| LKR 100,000.00 \| 12.50% \| 14 Jan 2027 \| Active` and `FD-00091 \| SAV-100301 \| 6 month Flex \| LKR 75,000.00 \| 10.00% \| 12 Dec 2026 \| Active`; button opens `/fixed-deposits/new` | Manual (browser) / Playwright | Manual only | Selith | Pramudith | Not run | **Mockup — no backend.** Built by Nadija. Sample products don't match real FD-6M/1Y/3Y (F-54) |
| UI-MOCK-06 | FD opening `/fixed-deposits/new` | agent_c1 | | Open from UI-MOCK-05 and from WF-ACC-14's link; click **Review fixed deposit** | Loads; savings account options `SAV-100284 · LKR 42,500.00 available`, `SAV-100301 · LKR 18,220.00 available`; products `6 month Flex · 10.00%`, `12 month Growth · 12.50%`; "Expected terms" text; Review does nothing; `?accountId=` ignored | Manual (browser) / Playwright | Manual only | Selith | Pramudith | Not run | **Mockup — no backend.** Built by Nadija. Real logic: WF-FD-01 |
| UI-MOCK-07 | Interest runs `/interest-runs` | central_ops | | Type the URL; click **Start interest run** and **Review run** | Loads; rows `30 Aug 2026 \| Completed \| 21 \| LKR 42,560.00 \| 0 \| system worker` and `30 Jul 2026 \| Completed \| 19 \| LKR 38,140.00 \| 1 \| central.ops`; buttons do nothing; no network request | Manual (browser) / Playwright | Manual only | Selith | Pramudith | Not run | **Mockup — no backend.** Built by Nadija. No inbound link. Real logic: WF-INT-01 |
| UI-MOCK-08 | RPT-03 page `/reports/active-fds` | central_ops | | Type the URL; click **Export CSV**, **Apply filters** | Loads; "RPT-03 · Active fixed deposits"; rows `FD-00082 … LKR 100,000.00 … 27 Oct 2026`, `FD-00091 … LKR 75,000.00 … 12 Oct 2026`; "Grand total LKR 316,700.00"; buttons do nothing | Manual (browser) / Playwright | Manual only | Selith | Pramudith | Not run | **Mockup — no backend.** Built by Nadija. Grand total does not match rows (F-54). Real API: WF-RPT-08 |
| UI-MOCK-09 | RPT-04 page `/reports/interest-distribution` | central_ops | | Type the URL | Loads; "RPT-04 · Interest distribution"; rows `Colombo Main \| September 2026 \| 18 \| LKR 42,560.00`, `Kandy \| September 2026 \| 11 \| LKR 28,340.00`; "Grand total LKR 316,700.00" | Manual (browser) / Playwright | Manual only | Selith | Pramudith | Not run | **Mockup — no backend.** Built by Nadija. Total wrong (F-54). Real API: WF-RPT-09 |
| UI-MOCK-10 | Users admin `/admin/users` | admin | | Type the URL; click **Create staff user**, **Search**, **Manage** | Loads; "Users and roles"; rows `a.fernando \| AGENT \| Colombo Main \| Active \| 27 Sep 2026 10:12`, `central.ops \| CENTRAL_OPS \| Bank-wide \| Active \| 27 Sep 2026 09:15`; buttons do nothing | Manual (browser) / Playwright | Manual only | Nadija | Vibodha | Not run | **Mockup — no backend.** No nav link; search box has no label (F-56) |
| UI-MOCK-11 | Roles admin `/admin/roles` | admin | | Type the URL | Identical content to UI-MOCK-10 | Manual (browser) / Playwright | Manual only | Nadija | Vibodha | Not run | **Mockup — no backend.** |
| UI-MOCK-12 | Placeholder `/dashboard/cards` | any staff | | Type the URL; click **Return to dashboard** | "Not available yet" card, title Cards, text "Card issuing and card controls are not part of the approved MIMS scope."; button returns to `/dashboard` | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend** (placeholder) |
| UI-MOCK-13 | Placeholder `/dashboard/compliance` | any staff | | Same | Text "Audit and compliance search will be provided by the Phase 5 report framework." | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend.** Text is stale (F-44) |
| UI-MOCK-14 | Placeholder `/dashboard/concierge` | any staff | | Same | "…not part of the approved MIMS scope." | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend** |
| UI-MOCK-15 | Placeholder `/dashboard/fx-desks` | any staff | | Same | "Foreign exchange dealing is not part of…" | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend** |
| UI-MOCK-16 | Placeholder `/dashboard/insights` | any staff | | Same | "Management reports will be available when the Phase 5 reporting work is implemented." | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend.** Stale text (F-44) |
| UI-MOCK-17 | Placeholder `/dashboard/liquidity` | any staff | | Same | "…not part of…" | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend** |
| UI-MOCK-18 | Placeholder `/dashboard/security` | any staff | | Same | "User and role administration will be available through the approved administration workflow." | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend** |
| UI-MOCK-19 | Placeholder `/dashboard/transactions` | any staff | | Same | "Deposits, withdrawals, and reversals are scheduled for Phase 3." | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | **Mockup — no backend.** Stale text (F-44) |
| UI-MOCK-20 | Redirect `/dashboard/fixed-deposits` | any staff | | Type the URL | Redirects to `/fd-products` | Manual (browser) / Playwright | Manual only | Nadija | Selith | Not run | Redirect only |

---

## 3. Coverage summary

### 3.1 Pages (35 routes)

| Route | Feature tests | Mockup check |
|---|---|---|
| `/`, `/sign-in`, `/sign-in/*` (7) | WF-AUTH-01…10 | — |
| `/dashboard` | WF-DASH-01, WF-NAV-01 | — |
| `/admin/parameters`, `/admin/health`, `/admin/audit` | WF-ADM-01…09 | — |
| `/branches`, `/agents`, `/agents/[id]/activity` | WF-ORG-01…11 | — |
| `/customers`, `/customers/new`, `/customers/[id]` | WF-CUS-01…09 | — |
| `/plans` | WF-PLAN-01…04 | — |
| `/accounts`, `/accounts/new`, `/accounts/[id]` | WF-ACC-01…14 | — |
| `/fd-products` | WF-FDP-01…04 | — |
| `/reports/agent-transactions`, `/reports/account-summary`, `/reports/customer-activity` | WF-RPT-01…07, 10 | — |
| `/reconciliation` | WF-REC-01…03 | — |
| `/accounts/[id]/statement`, `/transactions/deposit`, `/transactions/withdraw`, `/transactions/[id]`, `/fixed-deposits`, `/fixed-deposits/new`, `/interest-runs`, `/reports/active-fds`, `/reports/interest-distribution`, `/admin/users`, `/admin/roles` | (real logic via API/SQL: WF-TXN, WF-FD, WF-INT, WF-RPT-08/09) | UI-MOCK-01…11 |
| `/dashboard/{cards, compliance, concierge, fx-desks, insights, liquidity, security, transactions}`, `/dashboard/fixed-deposits` | — | UI-MOCK-12…20 |

**Every page has at least one test.**

### 3.2 API endpoints (37 handlers)

All 37 have at least one API test in 05 §3 (API-AUTH, HLT, ADM, AUD, ORG, PLAN, FDP, CUS,
ACC, TXN, INT, RPT, SEC). The workflow tests above use them through the UI where a real
UI exists, and directly through curl where it does not (transactions, statement,
transaction detail, account closure, interest request, RPT-03, RPT-04).

### 3.3 Database objects

All 25 tables, 4 domains, 3 sequences, every procedure and function, every trigger
function, 8 views and 13 RLS policies are mapped to tests in 06 §11.

### 3.4 Coverage line items

Total: **340 test cases** in `08-TEST-TRACKER.csv` (225 already covered by an existing automated test, 42 partially covered, 73 manual only).

| Item | Count | Status |
|---|---|---|
| Feature workflow tests (WF-…) | 117 | Cover every REAL page, every role, happy paths, invalid input, boundaries, permission violations, unauthenticated access, duplicates/idempotency, concurrency, DB consistency, cross-member flows |
| **Mockup page checks (UI-MOCK-…)** | **20** | **11 mockup screens + 8 placeholder pages + 1 redirect. Checked for loading, navigation and sample data only — these are not feature coverage** |
| API tests (05) | 121 | All 37 handlers |
| DB tests (06) | 82 | All schema objects (06 §11) |

### 3.5 Not covered, and why

| Item | Why not covered |
|---|---|
| Posting a deposit, withdrawal or reversal **through the UI** | No UI exists (mockups). Covered through the API instead |
| Opening an FD or running interest **through the app** | No API or UI path exists (F-25). Covered in SQL as `mims_owner` |
| Document verification | No page, route or API exposes `services/customer-document-service.ts`. Only its service tests exist (`tests/api/customer-document-service.test.mjs`). WF-CUS-09 records the gap |
| Users and roles administration | Only a mockup exists (UI-MOCK-10/11); no API |
| Interest run listing, FD listing APIs | Documented in docs/05 but not implemented (F-24) |
| Withdrawal-dependent API flows (WF-TXN-06…11, API-TXN-08…14) | Will be **Blocked** while F-01 stands; their SQL equivalents (DB-TXN-06…09) still run |
| `customer_agent` RLS policies as a separate SQL test | Exercised indirectly through customer registration (WF-CUS-02 as AGENT) and `tests/db/customer-child-access.test.mjs`; no extra manual SQL written |
| Performance under load (NFR-PERF-02/04, P06-M04-T02) | Task is TODO; no load-test tooling in the repo. Index evidence is in `database/indexes/explain-analyze-evidence.md` |
| Live HTTPS deployment (P06-M01-T04) | Local-only plan; `npm run verify:deployment` checks configuration only |
| `set_updated_at` triggers individually | Exercised by every UPDATE test; not asserted one by one |
| Business calendar admin | No UI or API manages `business_calendar`; tested only in SQL (DB-ID-08) |
