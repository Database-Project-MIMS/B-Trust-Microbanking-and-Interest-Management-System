# 02 — Member Contributions

Who owns and who built each feature on `dev`. Each member gets their features, how each
works, the files, routes, endpoints and database objects, what they depend on, a demo
script, and the test IDs that cover their work.

---

## 0. How attribution was done

**Sources:** the member folders (`1_Nadija` … `5_Selith`), `docs/09_task-tracker.md`,
`.agent/ownership-map.md`, `.agent/handoffs/`, and git history across all branches
(`git log --all`, `git log --diff-filter=A`, `git show --stat`). Attribution is **by
feature and content, not by commit count or line count.** Large commits were broken down
by the folders and features they touch.

### Git identity → member

| Git author (email) | Member | Slice |
|---|---|---|
| Nadija Welihena Gamage, nadija-smwg (nadijasmwg@gmail.com) | **Nadija** — M1, Mansara W.G.N.S | Identity, Security, Audit & Reporting Framework |
| vibodhalakshan2004, Vibodha Lakshan (vibodhalakshan@gmail.com) | **Vibodha** — M2, Herath H.M.V.L | Organisation & Customers |
| Nisith Jayasuriya (nisithjayasuriya@gmail.com) | **Nisith** — M3, Jayasuriya D.G.N.C | Accounts, Plans & Joint Ownership |
| Pramudith, Pramudith Jayawardhana (pspeyanjayawardhana@gmail.com) | **Pramudith** — M4, Jayawardhana P.S.P | Transactions & Ledger Integrity |
| Selith, SelithRubasingha, Selith Rubasingha (selithrubasingha@gmail.com) | **Selith** — M5, Rubasingha S.T | Fixed Deposits, Interest & Product Reporting |
| MIMS Group 32 (group32@students.local) | **Nadija and Selith jointly** (Phase 0 scaffold, `16b17a6`); commit `114d5c4` is Nadija's identity/auth work (her name is in the message) | — |

### What the member folders contain

| Folder | Contents | Written by |
|---|---|---|
| `1_Nadija/` | `00_OVERVIEW.md` + 10 task briefs (P1–P6) | Nadija (`114d5c4`) |
| `2_Vibodha/`, `3_Nisith/`, `4_Pramudith/` | `00_OVERVIEW.md` + task briefs per phase (plans, not work logs) | Nisith (`427d1ec`, "Member Documentation") |
| `4_Pramudith/notes/` | Work notes for P03-M04-T03/T04/T05 | Selith (committed with that work) |
| `5_Selith/` | `00_OVERVIEW.md`, task briefs, `notes/` work logs, `things_i_am_blocked.md` | Selith |
| `UI-nadija/` | 18 static HTML design references + 2 logos (the "B-Trust Spatial" design) | Nadija |
| `*/temp.txt` | "Use this folder for your work" placeholders | Nadija |

The folders are **plans and notes**. The code lives in `app/`, `components/`, `lib/`,
`services/`, `database/`, `tests/`.

### Large commits broken down

| Commit | Author | What it actually contains |
|---|---|---|
| `16b17a6` P00 | MIMS Group 32 → Nadija & Selith | Project scaffold: `package.json`, configs, `lib/db` (pool, query, errors), migration `0000`, `scripts/migrate.mjs`, `db-create.sh`, `verify-setup.mjs`, `app/api/health`, all `docs/` and `.agent/` |
| `114d5c4` | MIMS Group 32 → Nadija | Migration `0100` (identity tables), `lib/auth/password.ts`, `session.ts`, `services/auth-service.ts`, login/logout routes, identity and auth tests |
| `17b3c9a` "Complete UI integration" | Nadija | Sign-in page and 7 sign-in sub-routes, dashboard + 8 placeholder pages, top bar, `globals.css` theme, `UI-nadija/` designs |
| `746e6a6` "save frontend progress" | Nadija | Page scaffolds for every feature folder (`app/accounts`, `customers`, `plans`, `transactions`, `fixed-deposits`, `interest-runs`, `reports`, `reconciliation`, `admin`), `components/mims/workflow-screen.tsx` (the mockups), `workspace-layout.tsx`, `app-shell` |
| `b8c4a3f` | Selith | FD products API tests, `database/roles/01_app_grants.sql` (first version), test runner setup |
| `ad5d459` | Vibodha | Branch and agent APIs, services, validation, `lib/http/error-response.ts`, organisation tests |
| `fad4f13` Phase 1 closeout | Vibodha | Cross-member fixes: `parameter-admin.tsx`, `lib/auth/page-access.ts`, `services/health-service.ts`, `scripts/migration-ledger.mjs`, `verify-phase-01.mjs`, sign-in e2e test |
| `3643de8`, `635c691`, `c1da301`, `3f78ee1` | Vibodha (GitHub web uploads) | Re-uploads of Nadija's report framework, interest-run route, worker auth and `0300`/`0401` files about an hour after Nadija committed them (PR #69 "restores I-7"). **Credited to Nadija**, with Vibodha as restorer |
| `5b03e78`, `b314847` | Vibodha | P06-M02-T01: seed files 14/15 (FDs, interest runs), `seed-validation.mjs`, migration `0620`, and repairs to other members' test fixtures and the audit/interest routes |

---

## 1. Nadija — Member 1: Identity, Security, Audit & Reporting Framework

### Features

| Feature | Tasks | How it works | Files | Pages / endpoints | DB objects | State |
|---|---|---|---|---|---|---|
| Identity schema | P01-M01-T01 | Roles, users, server-side sessions, login attempts | `database/migrations/0100_p01_m01_identity.sql` | — | `role`, `app_user`, `user_session`, `login_attempt` | Working |
| Authentication | P01-M01-T02 | argon2id hashing; login checks throttle (5 failures / 15 min / username), password, status; creates a session row and `mims_session` cookie; logout revokes | `lib/auth/password.ts`, `lib/auth/session.ts`, `services/auth-service.ts`, `app/api/auth/login/route.ts`, `logout/route.ts` | `POST /api/auth/login`, `POST /api/auth/logout` | `user_session`, `login_attempt` | Working (F-17, F-19) |
| RBAC, branch scope, CSRF (I-1) | P01-M01-T03 | `requireUser`, `requireRole`, `branchScope`, `assertBranchProfile`; double-submit CSRF (`mims_csrf` cookie + `x-csrf-token`) | `lib/auth/rbac.ts`, `lib/auth/csrf.ts` | used by every route | — | Working |
| Sign-in page and app shell | P01-M01-T04 | Sign-in form; role-aware top bar; dashboard cards; GSAP motion | `app/sign-in/page.tsx`, `components/app-shell/*`, `app/dashboard/*`, `app/layout.tsx`, `app/globals.css` | `/sign-in`, `/dashboard` | — | Working (F-37) |
| Parameters, calendar, audit log | P01-M01-T05 | Business rules as data; audit trigger on master data; immutable audit log | `0104_p01_m01_parameters_audit.sql`, `services/parameter-service.ts`, `services/audit-service.ts`, `app/admin/parameters/*` | `/admin/parameters`, `GET/PUT /api/admin/parameters…` | `system_parameter`, `business_calendar`, `audit_log`, `fn_is_business_hour`, `fn_audit_master_changes`, `trg_audit_log_immutable`, `trg_audit_*` | Working (F-11) |
| RLS and audit coverage | P02-M01-T01…T03 | RLS policies on `customer` and `account`, RLS helper functions, masked audit, transaction-local context setter | `0200_p02_m01_audit_coverage.sql`, `0201_p02_m01_rls_policies.sql`, `0261_p02_m01_rls_audit_bind.sql`, `lib/db/rls-context.ts` | — | `fn_rls_*`, `fn_mask_audit_values`, 7 policies | Working; **no RLS on `transaction`** (F-03) |
| Business hours, reversal auth, financial audit | P03-M01-T01…T03 | Parameter/limit SQL helpers; manager-only reversal route; audit writer helpers | `0300_p03_m01_business_rules_helpers.sql`, `0300_p03_m01_business_rules_config.sql`, `services/business-rules-service.ts`, `app/api/transactions/[id]/reverse/route.ts` (auth part), `services/audit-service.ts` | `POST /api/transactions/{id}/reverse` (role check) | `fn_get_parameter`, `fn_check_business_hours`, `fn_check_withdrawal_*_limit` | Helpers used only by tests (F-41) |
| Worker auth and cycle config | P04-M01-T01, T02 | Bearer token for the worker; `INTEREST_CYCLE_DAYS` parameter | `lib/auth/worker-auth.ts`, `services/interest-config-service.ts`, `services/interest-request-service.ts`, `app/api/interest-runs/route.ts`, `0401_p04_m01_cycle_config.sql` | `POST /api/interest-runs` | `MIN_FD_PRINCIPAL`, `INTEREST_CYCLE_DAYS` | Route only writes an audit row (F-25) |
| Report framework (I-7), CSV, report audit, audit search | P05-M01-T01…T04 | Shared report shell, filters, totals, CSV streaming with identical totals, `REPORT_ACCESSED` audit; audit search page/API | `components/report/*`, `lib/report/report-handler.ts`, `lib/report/csv-export.ts`, `app/admin/audit/page.tsx`, `app/api/audit/route.ts` | `/admin/audit`, `GET /api/audit` | `audit_log` | Working; audit page has gaps (F-13) |
| Deployment security | P06-M01-T04 (IN_PROGRESS) | Environment checker and security headers | `scripts/check-deployment-security.mjs`, `next.config.ts` headers, `tests/security/deployment-security.test.mjs` | — | — | Config only |
| UI scaffold and mockups | (UI work) | Built the scaffold pages for every folder and the static `WorkflowScreen` mockups | `components/mims/*`, scaffold `page.tsx`/`layout.tsx` files, `UI-nadija/` | 11 mockup routes + 8 placeholders | — | Mockups (F-08) |
| Phase 0 scaffold (jointly with Selith) | P00 | Project skeleton, `lib/db` first version, migration runner, docs | see §0 | `GET /api/health` (first version) | `0000_p00_shared_foundation.sql` (domains, `schema_migration`, `set_updated_at`) | Working |

**Built for Member 4 (Pramudith's slice, Pramudith unavailable):** RPT-05 customer activity
report and the reconciliation views and page. They are listed in full under §4. Files:
`0560_p05_m04_rpt05_view.sql`, `0561_p05_m04_reconciliation_views.sql`,
`services/customer-activity-report-service.ts`, `services/reconciliation-service.ts`,
`app/api/reports/customer-activity/route.ts`, `app/reports/customer-activity/*`,
`app/reconciliation/page.tsx`, `tests/db/rpt05-view.test.mjs`,
`tests/db/reconciliation.test.mjs`, `tests/api/rpt05-report.test.mjs` (commit `d279288`).

**Depends on:**
- Pramudith's `lib/db` (I-2).
- Every member's tables for the RLS policies.

**Others depend on:**
- I-1 (every route).
- I-7 (Vibodha's RPT-01, Nisith's RPT-02, RPT-05).
- The shell (every page).

### Demo walkthrough (about 6 minutes)

1. Sign in as `agent_c2` with a wrong password: generic message. Then show the lockout on
   `agent_g2` (WF-AUTH-02, 03).
2. Sign in as `admin`; show the top bar and the dashboard cards by role. Sign in as
   `agent_c1` in another window to compare (WF-NAV-01, WF-DASH-01).
3. **Controls:** change `BUSINESS_HOUR_END`; show the audit row in `psql` and the immutable
   audit log (`UPDATE audit_log …` rejected) (WF-ADM-03, DB-ID-04).
4. Show RLS in `psql` as `mims_app`: no context gives 0 customers; Kandy context gives only
   Kandy (DB-ORG-07).
5. Show CSRF: a curl request without `x-csrf-token` gets 403 (WF-SEC-02).
6. Report framework: run RPT-01 and export CSV; totals match; `REPORT_ACCESSED` appears in
   audit search (WF-RPT-01, WF-RPT-10).

### Test IDs covering Nadija's work

- **Workflow:** WF-SETUP-02, WF-AUTH-01…10, WF-NAV-01, WF-DASH-01, WF-ADM-01…04,
  WF-ADM-07…09, WF-INT-04…06, WF-RPT-10, WF-SEC-01, 02, 05, 07…09, WF-END-01,
  UI-MOCK-10…20.
- **API:** API-AUTH-01…10, API-ADM-01…06, API-AUD-01…04, API-INT-01…03, API-SEC-01…05.
- **DB:** DB-SETUP-03, DB-ID-01…09, DB-SEC-01, 02, 05, 06; RLS parts of DB-ORG-07,
  DB-ACC-16.
- **As builder for Pramudith:** WF-RPT-06, 07, WF-REC-01…03, API-RPT-11…13, DB-RPT-05,
  DB-REC-01…03.

---

## 2. Vibodha — Member 2: Organisation & Customers

### Features

| Feature | Tasks | How it works | Files | Pages / endpoints | DB objects | State |
|---|---|---|---|---|---|---|
| Branch schema | P01-M02-T01 | Branch master with unique code | `0120_p01_m02_branch.sql` | — | `branch`, `uq_branch_branch_code` | Working |
| Agent schema | P01-M02-T02 | Agent = staff profile sharing `app_user` PK; active agent needs active branch | `0121_p01_m02_agent.sql` | — | `agent`, `trg_validate_agent_active_branch`, `trg_branch_prevent_deactivation_with_active_agents` | Working |
| Branch & agent APIs + audit | P01-M02-T03 | Create/list/update; deactivate instead of delete; same-transaction audit | `services/branch-service.ts`, `services/agent-service.ts`, `lib/validation/organization.ts`, `0122_p01_m02_organization_audit.sql`, `app/api/branches/*`, `app/api/agents/*` | `GET/POST /api/branches`, `PATCH /api/branches/{id}`, `GET/POST /api/agents`, `PATCH /api/agents/{id}` | `trg_audit_branch`, `trg_audit_agent` | Working |
| Branch & agent admin UI | P01-M02-T04 | Role-aware lists, create forms, confirmed deactivation | `app/branches/page.tsx`, `app/agents/page.tsx`, `components/organization/organization-table.tsx` | `/branches`, `/agents` | — | Working |
| Customer schema | P02-M02-T01 | Customer with unique NIC/email/number, past DOB, trigram search | `0220_p02_m02_customer.sql` | — | `customer`, `ix_customer_full_name_trgm` | Working |
| Assignment and documents | P02-M02-T02, T03 | One active agent per customer (partial unique index); document verification pairing | `0221_…customer_agent.sql`, `0222_…customer_document.sql`, `services/customer-document-service.ts` | — | `customer_agent`, `ux_customer_agent_one_active`, `customer_document` | Schema working; **verification service has no route** (F-07) |
| Customer registration | P02-M02-T04, T05 | One transaction: customer + documents + assignment + audit; scoped search; masked identity; profile | `services/customer-service.ts`, `lib/validation/customer.ts`, `0223_…child_access.sql`, `app/api/customers/*`, `app/customers/*` | `/customers`, `/customers/new`, `/customers/[id]`; `GET/POST /api/customers`, `GET /api/customers/{id}` | child-table RLS policies | Working |
| Transaction attribution | P03-M02-T01 | `agent_id` / `branch_id` columns on the ledger + reporting indexes | `0320_p03_m02_transaction_attribution.sql` | — | `transaction.agent_id`, `branch_id`, `ix_txn_agent_date`, `ix_transaction_branch_date` | Working; deposits don't fill them (F-10) |
| Agent daily activity | P03-M02-T02 | Counts and totals by type for Colombo calendar dates; agent self, manager branch, bank-wide | `services/agent-service.ts` (activity), `lib/validation/agent-activity.ts`, `app/agents/[id]/activity/*`, `app/api/agents/[id]/activity/route.ts` | `/agents/[id]/activity`, `GET /api/agents/{id}/activity` | `transaction` | Working |
| Customer ↔ FD linkage and scope | P04-M02-T01, T02 | Caller-security view; FD panel on the profile; restrictive actor guard policy | `0420_…customer_fd_view.sql`, `0421_…customer_fd_scope_guard.sql`, `database/views/customer-fd-summary.sql`, `app/customers/[id]/customer-fixed-deposits.tsx`, `app/api/customers/[id]/fixed-deposits/route.ts` | `GET /api/customers/{id}/fixed-deposits` | `vw_customer_fd_summary`, `fixed_deposit` RLS policies, `fn_customer_fd_actor_is_current` | Working |
| RPT-01 agent-wise totals | P05-M02-T01, T02 | Owner-only view read through scoped definer functions; JSON + CSV with identical totals; access audit | `0520_p05_m02_rpt01_view.sql`, `0521_p05_m02_rpt01_runtime.sql`, `services/rpt01-report-service.ts`, `lib/validation/rpt01-report.ts`, `app/reports/agent-transactions/*`, `app/api/reports/agent-transactions/route.ts` | `/reports/agent-transactions`, `GET /api/reports/agent-transactions` | `vw_rpt01_agent_transactions`, `fn_rpt01_scope`, `fn_rpt01_rows`, `fn_rpt01_exclusions` | Working |
| Seed validation and integrity tests | P06-M02-T01, T02 (REVIEW) | Seed metrics checker; FD and interest seed completion; 100 DB + 16 API integrity cases | `scripts/seed-validation.mjs`, `verify-seed-validation.mjs`, `database/seed/14_fixed_deposits.sql`, `15_interest_runs.sql`, `0620_p06_m02_interest_reference.sql`, `tests/db/master-data-integrity.test.mjs`, `tests/api/master-data-integrity.test.mjs` | — | seed data, `sp_post_interest_credit` reference format | Working |

**Cross-owner contributions** (with team authorization, recorded in ADR-0021/0024/0025):

- **`0363_p03_m04_withdrawal_contract_repair.sql`:** the withdrawal routine repair in
  Pramudith's slice.
- **Phase 1 closeout fixes (`fad4f13`):** `parameter-admin.tsx`, `page-access.ts`,
  `health-service.ts`, verification scripts.
- **Re-upload of Nadija's report framework (PR #69):** restored I-7.
- **Integration repairs (`b314847`):** other members' test fixtures and audit/interest route
  denials.

**Depends on:**
- Nadija's I-1, RLS and audit trigger.
- Pramudith's `lib/db`.
- Selith's seed framework.

**Others depend on:**
- Customers (needed by Nisith's account opening).
- Attribution columns (RPT-01).
- `vw_customer_fd_summary` (customer FD panel).

### Demo walkthrough (about 6 minutes)

1. Admin creates branch BR-MAT; tries a duplicate code; deactivates it and shows it
   under All records. Colombo refuses deactivation because it has active agents
   (WF-ORG-02…04).
2. `bm_colombo` creates agent agent_c3 (branch locked) and deactivates it; agent_c3 can no
   longer sign in (WF-ORG-06, 08).
3. `agent_c1` registers a customer; then the same NIC again → duplicate error; show in SQL
   that no partial row exists (WF-CUS-02, 03).
4. `agent_c1` search shows only assigned customers with masked identity; `central_ops`
   sees all (WF-CUS-01).
5. `agent_k1` cannot open a Colombo customer (WF-CUS-06).
6. Customer FD panel (WF-CUS-08).
7. RPT-01 as `bm_colombo`: branch locked, CSV totals equal the screen (WF-RPT-01, 03).
8. Agent daily activity (WF-ORG-09…11).

### Test IDs covering Vibodha's work

- **Workflow:** WF-ORG-01…11, WF-CUS-01…08, WF-CUS-09 (shared with Nisith), WF-RPT-01…03,
  WF-FD-04 (shared), WF-SEC-03 (shared), WF-SEC-06 (shared).
- **API:** API-ORG-01…15, API-CUS-01…12, API-RPT-01…03.
- **DB:** DB-ORG-01…10, DB-FD-06, DB-RPT-01, DB-RPT-06, DB-SEED-01/02 (seed completion),
  DB-INT-01 (seed).
- **As builder for Pramudith:** withdrawal repair rows WF-TXN-05…11, DB-TXN-06…09 (tested by
  Nisith).

---

## 3. Nisith — Member 3: Accounts, Plans & Joint Ownership

### Features

| Feature | Tasks | How it works | Files | Pages / endpoints | DB objects | State |
|---|---|---|---|---|---|---|
| Savings plan schema | P01-M03-T01 | 5 plans with rates as fractions, minimums, age and holder limits as data | `0140_p01_m03_savings_plan.sql` | — | `savings_plan` + 3 CHECKs | Working |
| Plan eligibility | P01-M03-T02 | Data-driven age/holder check (no plan names in code) | `database/routines/fn_check_plan_eligibility.sql` | — | `fn_check_plan_eligibility` | Working |
| Plan API and page | P01-M03-T03 | List for all staff; ADMIN/CENTRAL_OPS edit with focus-trapped dialog | `services/savings-plan-service.ts`, `lib/validation/savings-plan.ts`, `app/plans/*`, `app/api/plans/*` | `/plans`, `GET /api/plans`, `PATCH /api/plans/{id}` | `savings_plan` | Working; edits not audited (F-11) |
| Account, holder, mandate schema | P02-M03-T01…T03 | Account with owning branch and non-negative balance; holders; joint mandate; statement-level trigger for 2–4 adult holders | `0240_…account.sql`, `0241_…account_holder.sql`, `0242_…joint_mandate.sql` | — | `account`, `account_holder`, `joint_mandate`, `trg_validate_joint_mandate`, `trg_joint_mandate_fit`, `trg_account_prevent_branch_change` | Working |
| Atomic account opening | P02-M03-T04 | One routine: account + holders + mandate + optional deposit; checks eligibility, verified documents, hours, minimum | `0243_…sp_open_savings_account.sql`, `0541_…balance_after.sql`, `0246_…account_number_skip_existing.sql` | — | `sp_open_savings_account`, `fn_next_account_number` | Working |
| Accounts API and screens | P02-M03-T05, T06 | List/open/detail/add holder; idempotent opening (`account_opening_request`); two-step wizard | `services/account-service.ts`, `services/account-errors.ts`, `lib/validation/account.ts`, `0244_…account_opening_request.sql`, `0245_…sp_add_account_holder.sql`, `app/accounts/*`, `app/api/accounts/*` | `/accounts`, `/accounts/new`, `/accounts/[id]`; `GET/POST /api/accounts`, `GET /api/accounts/{id}`, `POST /api/accounts/{id}/holders` | `account_opening_request`, `sp_add_account_holder` | Working |
| Withdrawal checks (I-4) | P03-M03-T01, T02 | Post-withdrawal minimum check and mandate verdict, called inside the withdrawal routine | `database/routines/fn_check_plan_minimum.sql`, `fn_check_withdrawal_mandate.sql` | — | `fn_check_plan_minimum`, `fn_check_withdrawal_mandate`, `fn_withdrawal_mandate_verdict` | Working |
| Balance and authority panel | P03-M03-T03 | Available to withdraw, last transaction, mandate state | `account-detail.tsx`, `account-format.ts` | `/accounts/[id]` | — | Working |
| FD eligibility (I-6), closure, FD panel | P04-M03-T01…T03 | Eligibility and funding verdict; close only with zero balance and no active FD (routine + guard trigger); FD panel on account page | `0440_…fn_check_account_fd_eligible.sql`, `0441_…sp_close_account.sql`, `account-fixed-deposits.tsx` | `POST /api/accounts/{id}/close` | `fn_check_account_fd_eligible`, `fn_fd_funding_verdict`, `sp_close_account`, `trg_account_close_guard` | Working; no Close button |
| RPT-02 account summary | P05-M03-T01, T02 | View with opening/closing balance per account; posting order `ledger_seq`; JSON + CSV | `0540_…rpt02_view.sql`, `0542_…transaction_ledger_seq.sql`, `0543_…rpt02_view_v2.sql`, `services/account-summary-report-service.ts`, `app/reports/account-summary/*`, `app/api/reports/account-summary/route.ts` | `/reports/account-summary`, `GET /api/reports/account-summary` | `vw_rpt02_account_summary`, `transaction.ledger_seq` | Working |
| Concurrency and constraint suites | P06-M03-T01, T02 | 2–5 parallel withdrawals prove `FOR UPDATE` works; every CHECK/UNIQUE/FK on plan/account tables | `tests/db/concurrent-withdrawals.test.mjs`, `tests/db/constraint-suite-plans-accounts.test.mjs` | — | — | Passing (last recorded run) |
| Member planning docs | — | Wrote the task briefs in `2_Vibodha/`, `3_Nisith/`, `4_Pramudith/` | `427d1ec` | — | — | Docs |

**Cross-owner contribution:** `transaction.ledger_seq` (`0542`) on Pramudith's table,
with a handoff to M4.

**Depends on:**
- Nadija's I-1 and RLS.
- Vibodha's customers.
- Pramudith's `lib/db` and transaction table (opening deposit).

**Others depend on:**
- I-3 (account row), I-4 (withdrawal checks): Pramudith's slice.
- I-6 (FD eligibility): Selith.

### Demo walkthrough (about 6 minutes)

1. `/plans`: rates and minimums are data; central_ops edits a description (WF-PLAN-01, 02).
2. `agent_c1` opens an Adult account for Adult Two with 1,500.00 (WF-ACC-02).
3. Child into Adult is rejected; 500.00 is below minimum (WF-ACC-03, 04).
4. `bm_colombo` opens a joint account with ALL_HOLDERS; one holder is refused; a child
   holder is refused by the trigger (WF-ACC-05, 06).
5. Double-submit shows "already opened" (WF-ACC-07).
6. Account page: available to withdraw, mandate, FD panel; the manager adds a joint
   holder (WF-ACC-08, 09).
7. RPT-02: closing balance equals the account balance; CSV (WF-RPT-04).
8. Run the concurrency test output (WF-TXN-18).

### Test IDs covering Nisith's work

- **Workflow:** WF-PLAN-01…04, WF-ACC-01…14, WF-CUS-09 (shared), WF-RPT-04, 05,
  WF-TXN-18 (tests), WF-FD-04 (panel).
- **API:** API-PLAN-01…04, API-ACC-01…18, API-RPT-04, 05.
- **DB:** DB-ACC-01…16, DB-TXN-12, DB-RPT-02.

---

## 4. Pramudith — Member 4: Transactions & Ledger Integrity

Pramudith is the **owner** of this slice. Some of its features were built by other
members, as shown in the "Implemented by" column. Where that column names another
member, the line **"Implemented by Selith/Nadija on Pramudith's behalf (Pramudith
unavailable)"** applies.

### Features

| Feature | Tasks | How it works | Files | Pages / endpoints | DB objects | Implemented by | State |
|---|---|---|---|---|---|---|---|
| Hardened data-access layer (I-2) | P01-M04-T01 | Retry on serialization/deadlock, SQLSTATE → domain error mapping, redacted query logging, pool metrics, `withTransaction` | `lib/db/with-transaction.ts`, `lib/db/logger.ts`, `lib/db/errors.ts`, `lib/db/pool.ts`, `lib/db/query.ts`, `tests/db/lib-db-hardening.test.mjs` | used by every service | — | Pramudith | Working |
| Transaction channel schema | P01-M04-T02 | BRANCH_COUNTER / ONLINE / SYSTEM | `0160_p01_m04_transaction_channel.sql`, `tests/db/transaction-channel-constraints.test.mjs` | — | `transaction_channel` | Pramudith | Working |
| Migration runner tests | P01-M04-T03 | Rebuild proof, checksum rejection, failed migration rollback | `tests/db/migration-runner.test.mjs`, edits to `scripts/migrate.mjs` | — | `schema_migration` | Pramudith | Working |
| Database health | P01-M04-T04 | Health route and page with pool/migration details for ADMIN/CENTRAL_OPS | `app/api/health/route.ts`, `app/admin/health/page.tsx`, `tests/api/health.test.mjs` (service later extracted by Vibodha) | `/admin/health`, `GET /api/health` | `schema_migration` | Pramudith | Working |
| Ledger table and immutability | P02-M04-T01 | Immutable ledger; UPDATE/DELETE rejected by trigger and grants | `0260_p02_m04_transaction.sql`, `tests/db/transaction-immutability.test.mjs` | — | `transaction`, `trg_financial_transaction_immutable` | Pramudith | Working |
| Reference numbers and idempotency index | P03-M04-T01 | Unique reference sequence; partial unique index on `idempotency_key` | `0360_p03_m04_transaction_reference_idempotency.sql`, `tests/db/transaction-reference-idempotency.test.mjs` | — | `transaction_reference_seq`, `fn_next_transaction_reference`, `ux_transaction_reference`, `ux_transaction_idempotency` | Pramudith | Working |
| Deposit routine | P03-M04-T02 | Lock account → validate → ledger row with `balance_after` → balance → audit; idempotent by key | `0361_p03_m04_sp_post_deposit.sql`, `database/routines/sp_post_deposit.sql`, `tests/db/sp-post-deposit.test.mjs` | — | `sp_post_deposit` | Pramudith | Working; key not bound to body (F-04); no attribution (F-10) |
| Withdrawal routine | P03-M04-T03 | Lock → re-validate status, hours, mandate (I-4), limits, balance, minimum (I-4) → debit → audit; `sp_try_…` records rejections | `0362_p03_m04_sp_post_withdrawal.sql`, `tests/db/sp-post-withdrawal.test.mjs`, `4_Pramudith/notes/notesP3T3.md`; repair `0363_p03_m04_withdrawal_contract_repair.sql` | — | `sp_post_withdrawal` (×2), `sp_try_post_withdrawal`, `sp_write_rejection_audit` | **Implemented by Selith on Pramudith's behalf (Pramudith unavailable)**; repaired by Vibodha | Routine works in SQL; API call broken (F-01) |
| Reversal | P03-M04-T04 | Compensating REVERSAL row, link table, balance restored, reversible once | `0363_p03_m04_transaction_reversal.sql`, `tests/db/sp-reverse-transaction.test.mjs`, `4_Pramudith/notes/08_P3-T04_transaction-reversal.md` | — | `transaction_reversal`, `sp_reverse_transaction` | **Implemented by Selith on Pramudith's behalf (Pramudith unavailable)** | Works in branch; cross-branch bug (F-02) |
| Transaction APIs | P03-M04-T05 | Deposit/withdrawal with `Idempotency-Key`; statement; transaction detail; reversal | `services/transaction-service.ts`, `services/transaction-errors.ts`, `lib/api/idempotency.ts`, `lib/validation/transaction.ts`, `app/api/transactions/*`, `app/api/accounts/[id]/transactions/route.ts`, `4_Pramudith/notes/09_P3-T05_…` | `POST /api/transactions/deposits`, `…/withdrawals`, `POST /api/transactions/{id}/reverse`, `GET /api/transactions/{id}`, `GET /api/accounts/{id}/transactions` | — | **Implemented by Selith on Pramudith's behalf (Pramudith unavailable)** | APIs exist; pages are mockups (built by Nadija); F-01, F-03, F-15 |
| Interest credit posting (I-5) | P04-M04-T01, T02 | Interest credited through a ledger routine with running balance | `0460_p04_m04_sp_post_interest_credit.sql`, `0483_p04_m05_interest_credit_fix.sql`, `tests/db/sp-post-interest-credit.test.mjs`, `tests/db/transaction-running-balance.test.mjs` (reference format later changed by Vibodha in `0620`) | — | `sp_post_interest_credit` | **Implemented by Selith on Pramudith's behalf (Pramudith unavailable)** | Working |
| RPT-05 customer activity | P05-M04-T01, T02 | Holder-attributed view (joint activity per holder); report with totals and CSV; access audit | `0560_p05_m04_rpt05_view.sql`, `services/customer-activity-report-service.ts`, `app/reports/customer-activity/*`, `app/api/reports/customer-activity/route.ts`, tests | `/reports/customer-activity`, `GET /api/reports/customer-activity` | `vw_rpt05_customer_activity` | **Implemented by Nadija on Pramudith's behalf (Pramudith unavailable)** | Working; CSV current page only (F-14) |
| Reconciliation | P05-M04-T03 | D-1 balance vs ledger, D-2 running balance; server-rendered page | `0561_p05_m04_reconciliation_views.sql`, `services/reconciliation-service.ts`, `app/reconciliation/page.tsx`, `tests/db/reconciliation.test.mjs` | `/reconciliation` | `vw_reconciliation_balance`, `vw_reconciliation_running_balance` | **Implemented by Nadija on Pramudith's behalf (Pramudith unavailable)** | Page likely fails (F-12) |
| Rollback / idempotency / performance tests | P06-M04-T01, T02 | — | — | — | — | Not started (TODO) | — |

**Depends on:**
- Nisith's account row (I-3) and withdrawal checks (I-4).
- Nadija's I-1 and audit.
- Vibodha's attribution columns.

**Others depend on:**
- I-2 (`lib/db`, every service).
- I-5 (Selith's interest cycle).
- The ledger (all reports).

### Demo walkthrough (about 6 minutes)

1. Show in `psql` that ledger rows cannot be updated or deleted (WF-TXN-17).
2. Post a deposit with curl and an `Idempotency-Key`; replay it; the balance moves once
   (WF-TXN-01, 02).
3. Show the deposit on the account page and in the statement API (WF-TXN-12).
4. Withdrawal rules in SQL while F-01 stands: the success case, then rejection at minimum
   balance with no ledger row and an audit row (DB-TXN-06, 07).
5. A manager reverses the deposit; the original is unchanged; a second reversal is
   rejected (WF-TXN-14, 16).
6. Concurrency test output (WF-TXN-18).
7. RPT-05 and reconciliation (WF-RPT-06, WF-REC-03).

### Test IDs covering this slice

- **Workflow:** WF-ADM-05, 06, WF-TXN-01…18, WF-INT-03, WF-RPT-06, 07, WF-REC-01…03,
  WF-SEC-04, UI-MOCK-01…04.
- **API:** API-HLT-01, 02, API-TXN-01…23, API-RPT-11…13, API-SEC-06, 07.
- **DB:** DB-SETUP-01, 02, DB-TXN-01…15, DB-RPT-05, DB-REC-01…03, DB-SEC-03, 04.

Testers for features built by Selith or Nadija are neither Pramudith nor the implementer
(Vibodha or Nisith).

---

## 5. Selith — Member 5: Fixed Deposits, Interest & Product Reporting

### Features

| Feature | Tasks | How it works | Files | Pages / endpoints | DB objects | State |
|---|---|---|---|---|---|---|
| FD product schema | P01-M05-T01 | 3 products with effective dating | `0180_p01_m05_fd_plan.sql` | — | `fd_plan` | Working |
| FD product API and page | P01-M05-T02 | List with rate history; ADMIN changes a rate by closing the old row and inserting a new one | `services/fd-product-service.ts`, `app/fd-products/*`, `app/api/fd-products/*` | `/fd-products`, `GET /api/fd-products`, `PATCH /api/fd-products/{id}` | `fd_plan` | Working; F-23, no audit (F-11) |
| Seed framework (I-8) and seed sets 1–4 | P01-M05-T03, P02-M05-T01, P03-M05-T01 | Fixed-UUID scheme, ordered load in one transaction, idempotent files, 100+ transactions through the real routines | `database/seed/00…13_*.sql`, `_load-order.txt`, `_uuids.sql`, `scripts/seed.mjs`, `scripts/seed-check.mjs` | — | all tables (data) | Working (FD/interest seed files 14/15 completed by Vibodha) |
| Fixed deposit schema | P04-M05-T01 | One ACTIVE FD per account (partial unique index); maturity; rate snapshot | `0480_p04_m05_fixed_deposit.sql` | — | `fixed_deposit`, `uq_one_active_fd_per_account`, `ix_fd_due_interest` | Working |
| FD opening routine | P04-M05-T02 | Lock account → eligibility (I-6) → balance → debit + ledger row → FD → audit | `database/routines/sp_open_fixed_deposit.sql` | **no route** | `sp_open_fixed_deposit` | SQL only (F-25, F-30) |
| Interest formula | P04-M05-T03 | `round(P × r × 30 / 365, 2)` | `database/routines/fn_calculate_fd_interest.sql` | — | `fn_calculate_fd_interest` | Working |
| Interest cycle | P04-M05-T04 | Run row per cycle date (unique); per-FD credit through I-5; payout row; next date +30 | `0482_p04_m05_interest_run.sql`, `database/routines/sp_run_interest_cycle.sql` | **no route runs it** | `interest_run`, `interest_payout`, `uq_payout_fd_cycle`, `sp_run_interest_cycle` | SQL only (F-25, F-29) |
| RPT-03 and RPT-04 | P05-M05-T01…T03 | Active FDs with next payout; monthly interest by plan/branch with ROLLUP; JSON + CSV | `database/views/vw_rpt03_active_fds.sql`, `vw_rpt04_interest_distribution.sql`, `services/report-service.ts`, `app/api/reports/active-fds/route.ts`, `interest-distribution/route.ts` | `GET /api/reports/active-fds`, `GET /api/reports/interest-distribution` (pages are mockups by Nadija) | the two views | API works with defects (F-09) |
| Index review | P05-M05-T04 | `EXPLAIN ANALYZE` before/after; extra indexes | `0580_p05_m05_performance_indexes.sql`, `database/indexes/explain-analyze-evidence.md`, root `before_indexes.txt`, `after_indexes.txt` | — | `ix_payout_cycle`, index renames | Evidence doc |
| Interest idempotency tests; ops scripts | P06-M05-T01, T02 | Re-run rejection and report totals; backup/restore script | `tests/db/interest-idempotency.test.mjs`, `scripts/backup-restore-test.sh` | — | — | Tests destructive outside harness (F-26); script hard-codes a password (F-33) |
| Phase 0 scaffold (jointly with Nadija) | P00 | see §0 | | | | |

**Built for Member 4 (Pramudith's slice, Pramudith unavailable):**
- `sp_post_withdrawal` (`0362`)
- `sp_reverse_transaction` (`0363`)
- The transaction APIs and services (`app/api/transactions/*`,
  `app/api/accounts/[id]/transactions`, `services/transaction-service.ts`,
  `services/transaction-errors.ts`, `lib/api/idempotency.ts`, `lib/validation/transaction.ts`)
- Interest credit posting (`0460`, `0483`)
- Related tests and notes in `4_Pramudith/notes/`

Full details under §4 (commits `7994f7f`, `640ea94`, `df89884`, `a9c3b64`).

**Depends on:**
- Nisith's I-6.
- The ledger routines (I-5).
- Nadija's I-1 and I-7.

**Others depend on:**
- Seed data (everyone).
- `fixed_deposit` (Vibodha's FD view, Nisith's FD panel and closure).

### Demo walkthrough (about 6 minutes)

1. `/fd-products`: three products; admin changes the 1-year rate and the old rate moves to
   history (WF-FDP-01, 02).
2. In `psql`: open an FD on a fresh account; the principal is debited; the rate snapshot
   and maturity are set; a second FD is rejected by the partial unique index (WF-FD-01, 02).
3. `fn_calculate_fd_interest(100000, 0.14)` = 1150.68 (DB-FD-03).
4. Run an interest cycle; one INTEREST_CREDIT per FD; re-run the same date → rejected,
   nothing new (WF-INT-01, 02).
5. RPT-03 / RPT-04 JSON through curl (WF-RPT-08, 09).
6. Seed determinism: `npm run db:seed-check` (DB-SEED-02).

### Test IDs covering Selith's work

- **Workflow:** WF-SETUP-01, WF-FDP-01…04, WF-FD-01…05, WF-INT-01, 02, WF-RPT-08, 09,
  UI-MOCK-05…09 (pages built by Nadija).
- **API:** API-FDP-01…04, API-RPT-06…10.
- **DB:** DB-SEED-01, 02, DB-FD-01…06, DB-INT-01…05, DB-RPT-03, 04, DB-OPS-01.
- **As builder for Pramudith:** WF-TXN-05…16, API-TXN-07…23, DB-TXN-06…11, 14 (tested by
  Vibodha or Nisith).

---

## 6. Where members' work meets (integration points)

| Point | Producer → consumer | Status | Risk found |
|---|---|---|---|
| I-1 RBAC/CSRF | Nadija → all | Working | Page layouts check only for a session (F-08) |
| I-2 `lib/db` | Pramudith → all | Working | Overloaded procedure call fails through node-pg (F-01) |
| I-3/I-4 account row and withdrawal checks | Nisith → withdrawal routine (Selith on Pramudith's behalf) | Working in SQL | API signer handling (F-05) |
| I-5 interest credit | Selith (on Pramudith's behalf) → Selith's interest cycle | Working | No maturity handling (F-29) |
| I-6 FD eligibility | Nisith → Selith | Partly used | `sp_open_fixed_deposit` ignores `fn_fd_funding_verdict` (F-30) |
| I-7 report framework | Nadija → Vibodha, Nisith, Nadija (RPT-05) | Used by RPT-01/02/05 | RPT-03/04 don't use it (F-09) |
| I-8 seed | Selith (+ Vibodha completion) → all | Working | — |
| Customer registration → account opening | Vibodha → Nisith | **Broken for new customers** | No document verification path (F-07) |
| Ledger attribution | Vibodha (columns) → deposit/reversal routines | Not filled | RPT-01 misses deposits (F-10) |
| Reconciliation views → app | Nadija (on Pramudith's behalf) → page | **Missing grant** | F-12 |
| Mockup pages ↔ real APIs | Nadija (UI) ↔ Pramudith/Selith slices | Not connected | F-08, F-25 |

---

## 7. Work not yet merged into `dev`

Checked with `git branch -a` and `git log dev..<branch>` for every local and remote
branch. Remote refs are as of the last `git fetch` on this machine; `origin/dev` = local
`dev` (2026-10-09 09:17).

| Branch | Author | Commits not in dev | Content | Status |
|---|---|---|---|---|
| `origin/feat/p01-m01-parameters-audit` | Nadija | 4 (`8702cb5`, `1a24207`, `06aba00`, `fc2038f`) | Sign-in e2e, P2 RLS/audit migrations `0200`, `0201`, `0261`, `lib/db/rls-context.ts`, `tests/db/rls-audit.test.mjs` | The code files are **identical** to dev (merged through `b6f7cd0`). Only old docs/tracker edits differ. **Nothing to test**; the branch can be deleted after the team confirms |
| `origin/revert-31-feat/p01-m04-lib-db-hardening` | Vibodha | 1 (`df343db`) | GitHub "Revert" of the `lib/db` hardening PR #31 | **Should not be merged** (it would remove I-2). Can be deleted |

All local `feat/*` branches and the other remote branches are fully merged into `dev`. No
feature is marked "Pending merge" in the test plan.
