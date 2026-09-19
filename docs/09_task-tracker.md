# 09 — Task Tracker

**Task ID:** `P<phase>-M<member>-T<task>` — e.g. `P03-M04-T02`.
**Branch:** `feat/p03-m04-<slug>` (AGENTS.md §12).

**Statuses:** `TODO` (not ready) · `READY` (dependencies met, start now) · `IN_PROGRESS` ·
`BLOCKED` (say why) · `REVIEW` (PR open) · `DONE`.

**Update rules:** you update **only your own rows**. Change status in the same PR as the
work. A task is `DONE` only when every item in the AGENTS.md §16 Definition of Done is
satisfied.

---

## Status summary

| Phase | Total | TODO | READY | IN_PROGRESS | BLOCKED | REVIEW | DONE |
|---|---|---|---|---|---|---|---|
| P0 | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| P1 | 18 | 0 | 11 | 0 | 0 | 0 | 7 |
| P2 | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| P3 | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| P4 | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| P5 | 15 | 15 | 0 | 0 | 0 | 0 | 0 |
| P6 | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| **All** | **96** | **72** | **11** | 0 | 0 | 0 | **13** |

---

## Phase 0 — Initialization (DONE)

| ID | M | Title | Deliverable | Status |
|---|---|---|---|---|
| P00-M00-T01 | lead | Read and reconcile brief, SRS, ERD | Source analysis | DONE |
| P00-M00-T02 | lead | Install agent skills, verify each SKILL.md | `.claude/skills/`, `skills-lock.json` | DONE |
| P00-M00-T03 | lead | Agent contract and project state | `AGENTS.md`, `CLAUDE.md`, `memory.md`, `ui-registry.md`, `.agent/` | DONE |
| P00-M00-T04 | lead | Documentation system | `docs/` — 18 docs, 7 phases, 5 member prompts | DONE |
| P00-M00-T05 | lead | ERD gap analysis | `docs/17_erd-gap-analysis.md` — 20 findings | DONE |
| P00-M00-T06 | lead | Shared foundation scaffold | migration `0000`, `lib/db`, scripts, app shell | DONE |

---

## Phase 1 — Foundation, Master Data & Security

Phase 1 work is in progress. API and UI portions depend on the published integration
points where noted.

### Member 1 — Identity & Security

| Field | P01-M01-T01 |
|---|---|
| **Title** | Identity schema: roles, users, sessions, login attempts |
| **DB** | `0100_p01_m01_identity.sql` — `role`, `app_user`, `user_session`, `login_attempt`; unique `username`; index `(role_id, status)`, `(username_attempted, attempted_at DESC)` |
| **Backend** | — |
| **Frontend** | — |
| **Tests** | `tests/db/identity-constraints.test.mjs`: duplicate username rejected; `role` delete restricted while referenced |
| **Docs** | `04_database-schema.md` Part B rows for the 4 tables |
| **Depends on** | migration `0000` |
| **Files** | `database/migrations/0100_*.sql`, `tests/db/identity-constraints.test.mjs` |
| **Acceptance** | Migration applies to a clean DB; duplicate username raises `23505`; no plaintext password column exists |
| **Status / Branch** | DONE · `feat/p01-m01-identity-schema` · PR #— |

| Field | P01-M01-T02 |
|---|---|
| **Title** | Authentication, sessions and password hashing |
| **DB** | — |
| **Backend** | `lib/auth/password.ts` (argon2id), `lib/auth/session.ts`, `POST /api/auth/login`, `POST /api/auth/logout`; failed-attempt throttling; generic failure message that does not reveal whether a username exists |
| **Frontend** | — |
| **Tests** | `tests/api/auth.test.mjs`: valid login sets a `Secure`/`HttpOnly`/`SameSite` cookie; invalid login is generic; 5 failures throttle; logout invalidates server-side |
| **Docs** | `15_security-and-rbac.md` |
| **Depends on** | P01-M01-T01 |
| **Acceptance** | FR-AUTH-01, FR-AUTH-03 pass; hash is never returned by any endpoint or written to a log |
| **Status / Branch** | DONE · `feat/p01-m01-authentication` · PR #— |

| Field | P01-M01-T03 |
|---|---|
| **Title** | RBAC, branch scope and CSRF — **publishes integration point I-1** |
| **DB** | — |
| **Backend** | `lib/auth/rbac.ts`: `requireUser()`, `requireRole(...)`, `branchScope()` returning a scope object services apply **inside the SQL WHERE clause**; CSRF token issue and verify |
| **Frontend** | — |
| **Tests** | `tests/api/authorization.test.mjs`: role denied → 403; cross-branch access denied even when the URL or body is edited (AC-11); state change without a CSRF token → 403 |
| **Docs** | `15_security-and-rbac.md`; **handoff publishing the helper signatures** |
| **Depends on** | P01-M01-T02 |
| **Acceptance** | Scope is applied in SQL, never by filtering an already-fetched array |
| **Status / Branch** | DONE · `feat/p01-m01-rbac` · PR #— |

| Field | P01-M01-T04 |
|---|---|
| **Title** | Sign-in page and application shell — **shared file, M1 owns** |
| **DB** | — |
| **Backend** | — |
| **Frontend** | `app/(auth)/sign-in/page.tsx`; `app/layout.tsx` replaced with the authenticated shell: header, role-aware nav, session indicator, sign-out |
| **Tests** | `tests/e2e/sign-in.test.mjs` |
| **Docs** | `11_ui-rules.md`; **run `/imprint`** — first entries in `ui-registry.md` (App Shell, Sign-in Card, Button, Form Field) |
| **Depends on** | P01-M01-T02 |
| **Acceptance** | Nav shows only permitted sections **and** the server still authorizes every request; matches the tokens in `ui-registry.md` |
| **Status / Branch** | READY · `feat/p01-m01-app-shell` · PR #— |

| Field | P01-M01-T05 |
|---|---|
| **Title** | System parameters, business calendar and audit log |
| **DB** | `0104_p01_m01_parameters_audit.sql` — `system_parameter`, `business_calendar`, `audit_log` (nullable `user_id`, `actor_type`); `trg_audit_master_changes`; indexes `(user_id, logged_at DESC)`, `(entity_type, entity_id)` |
| **Backend** | `services/audit-service.ts`; parameter read helper |
| **Frontend** | Parameter administration page |
| **Tests** | `tests/db/audit-trigger.test.mjs`: a master-data update writes before/after values; `audit_log` rejects `UPDATE`/`DELETE` by the app role |
| **Docs** | `07_business-rules.md` — where BR-08 is enforced |
| **Depends on** | P01-M01-T01; ERD gap **G-15**, **G-22** approved |
| **Acceptance** | Business hours and withdrawal limits are readable as data, not constants in code |
| **Status / Branch** | READY · `feat/p01-m01-parameters-audit` · PR #— |

### Member 2 — Organisation

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M02-T01** | Branch schema | `0120_p01_m02_branch.sql` — `branch` + `branch_code UNIQUE`, status check | — | — | Duplicate `branch_code` rejected; delete restricted | `0000` | DONE |
| **P01-M02-T02** | Agent schema | `0121_p01_m02_agent.sql` — `agent` as a subtype of `app_user`; `employee_no UNIQUE`, `nic_passport_no UNIQUE`, `email UNIQUE`; index `(branch_id, status)` | — | — | FR-ORG-02: agent in exactly one active branch | T01, P01-M01-T01 | DONE |
| **P01-M02-T03** | Branch & agent APIs | — | `GET/POST/PATCH /api/branches`, `/api/agents`; deactivate-not-delete | — | Deleting a referenced agent → 409 | T02, **I-1** | READY |
| **P01-M02-T04** | Branch & agent admin UI | — | — | `app/branches/page.tsx`, `app/agents/page.tsx` — list, create, deactivate | e2e create + deactivate | T03 | READY |

Branch: `feat/p01-m02-<slug>`. Acceptance: ≥ 3 branches and ≥ 5 agents can be created and
listed (FR-ORG-01); no record referenced by history can be deleted (FR-ORG-05).

### Member 3 — Savings plans

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M03-T01** | Savings plan schema with eligibility data | `0140_p01_m03_savings_plan.sql` — `savings_plan` + `min_age_years`, `max_age_years`, `min_holders`, `max_holders`, `requires_all_adult`; age-range check | — | — | `tests/db/savings-plan-constraints.test.mjs` — 8/8 passing, five plans load with exactly the BR-03…BR-07 rates and minimums, all negative cases covered | `0000`; **G-13** approved | DONE (branch `feat/p01-m03-savings-plan-schema`) |
| **P01-M03-T02** | Eligibility function | `fn_check_plan_eligibility(plan_id, date_of_birth, holder_count)` in `database/routines/` | — | — | Child aged 15 rejected for Children; adult aged 30 accepted for Adult; 1 holder rejected for Joint | T01 | READY |
| **P01-M03-T03** | Plan API and administration page | — | `GET /api/plans`, `PATCH /api/plans/{id}` | `app/plans/page.tsx` — read-mostly product view | Non-admin role cannot edit a plan | T02, **I-1** | READY |

Acceptance: eligibility is a **data-driven join**, not `IF plan_name = 'Children'`
hardcoded in TypeScript.

### Member 4 — Data access layer & channels

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M04-T01** | Harden `lib/db` — **publishes I-2** | — | Retry on `40001`/`40P01`, SQLSTATE → domain error mapping, query timing log with value redaction, pool metrics | — | `withTransaction` rolls back on throw; no secret or SQL text appears in a mapped error | Phase 0 scaffold | READY |
| **P01-M04-T02** | Transaction channel schema | `0160_p01_m04_transaction_channel.sql` — `transaction_channel`; seeds `BRANCH_COUNTER`, `ONLINE`, `SYSTEM` | — | — | `channel_name` unique | `0000` | READY |
| **P01-M04-T03** | Migration runner tests & rebuild proof | — | Harden `scripts/migrate.mjs` | — | Rebuild from empty succeeds; **editing an applied migration is rejected**; `npm run db:verify` passes | T02 | READY |
| **P01-M04-T04** | Database health page | — | Extend `/api/health` with pool stats (authenticated) | `app/admin/health/page.tsx` | Unauthenticated request gets no internal detail | T01, **I-1** | READY |

### Member 5 — FD products & seed framework

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M05-T01** | FD product schema | `0180_p01_m05_fd_plan.sql` — `fd_plan`, `tenure_months > 0`, effective-dating columns | — | — | Exactly the three BR-13 products; rate stored as a fraction | `0000`; **G-11** approved | DONE |
| **P01-M05-T02** | FD product API and admin page | — | `GET/PATCH /api/fd-products` | `app/fd-products/page.tsx` — products with rate history | Non-privileged role cannot change a rate | T01, **I-1** | DONE |
| **P01-M05-T03** | Seed framework — **publishes I-8** | `database/seed/` layout, fixed-UUID scheme, ordered load, `scripts/seed-check.mjs` | — | — | Seeding twice produces identical row counts and identical totals | T01 | DONE |

---

## Phase 2 — Customers, Accounts & Joint Ownership (16 tasks, TODO)

**Gate:** OQ-05 (G-20 customer identity) must be resolved before `P02-M02-T01` starts.

| ID | M | Title | Layers | Depends on |
|---|---|---|---|---|
| P02-M01-T01 | 1 | RLS policies on `customer` and `account` | DB + tests | P01-M01-T03, P02-M02-T01, P02-M03-T01 |
| P02-M01-T02 | 1 | Audit coverage for customer and account creation | DB + BE | P01-M01-T05 |
| P02-M01-T03 | 1 | Branch-scope enforcement on customer and account routes | BE + tests | P02-M02-T02 |
| P02-M02-T01 | 2 | `customer` schema + identity uniqueness + trigram search index | DB | **OQ-05**, P01-M02-T02 |
| P02-M02-T02 | 2 | `customer_agent` + one-active-assignment partial index (G-10) | DB | P02-M02-T01 |
| P02-M02-T03 | 2 | `customer_document` schema and verification | DB + BE | P02-M02-T01 |
| P02-M02-T04 | 2 | Customer registration service — customer + document + assignment + audit in **one transaction** | BE | P02-M02-T03 |
| P02-M02-T05 | 2 | Customer registration form, search and profile pages | FE | P02-M02-T04 |
| P02-M03-T01 | 3 | `account` schema + `branch_id` (G-06) + non-negative balance check (G-18) | DB | P01-M03-T01, **G-06** |
| P02-M03-T02 | 3 | `account_holder` + `holder_type`; 2–4 adult holder rule | DB | P02-M03-T01, P02-M02-T01 |
| P02-M03-T03 | 3 | `joint_mandate` + `trg_validate_joint_mandate` (statement-level, transition tables) | DB | P02-M03-T02, **G-08** |
| P02-M03-T04 | 3 | `sp_open_savings_account` — account + holders + mandate + optional initial deposit, atomic | DB | P02-M03-T03, P02-M04-T01 |
| P02-M03-T05 | 3 | Accounts and holders APIs | BE | P02-M03-T04, **I-1** |
| P02-M03-T06 | 3 | Account opening wizard, account detail, holder management pages | FE | P02-M03-T05 |
| P02-M04-T01 | 4 | `transaction` schema + immutability trigger (`UPDATE`/`DELETE` rejected) | DB | P01-M04-T02, P02-M03-T01 |
| P02-M05-T01 | 5 | Seed sets 1–3: branches, agents, customers, accounts, 2 joint accounts | DB | P02-M03-T04, P01-M05-T03 |

## Phase 3 — Financial Transactions (14 tasks, TODO)

**Gate:** OQ-08 (G-05 reference-number uniqueness) resolved before `P03-M04-T01`.

| ID | M | Title | Layers | Depends on |
|---|---|---|---|---|
| P03-M01-T01 | 1 | Business-hours and withdrawal-limit enforcement from `system_parameter` | DB + BE | P01-M01-T05 |
| P03-M01-T02 | 1 | Manager-only authorization for reversals | BE + tests | P03-M04-T04 |
| P03-M01-T03 | 1 | Audit events for every financial operation | BE + tests | P03-M04-T02 |
| P03-M02-T01 | 2 | `agent_id` / `branch_id` attribution on `transaction` (G-07) + reporting indexes | DB | P02-M04-T01, **G-07** |
| P03-M02-T02 | 2 | Agent daily activity API and page | BE + FE | P03-M02-T01 |
| P03-M03-T01 | 3 | `fn_check_plan_minimum` — post-withdrawal minimum-balance rule (**publishes I-4**) | DB | P02-M03-T01 |
| P03-M03-T02 | 3 | Joint-mandate validation callable from the withdrawal path | DB | P02-M03-T03 |
| P03-M03-T03 | 3 | Account balance panel and holder authority display | FE | P03-M04-T02 |
| P03-M04-T01 | 4 | Reference-number generation + `UNIQUE`; `idempotency_key` partial unique index (G-04) | DB | **OQ-08** |
| P03-M04-T02 | 4 | `sp_post_deposit` — lock, insert ledger, update balance, `balance_after`, audit | DB | P03-M04-T01 |
| P03-M04-T03 | 4 | `sp_post_withdrawal` — lock, re-validate status/mandate/limits/minimum, debit | DB | P03-M04-T02, **I-4** |
| P03-M04-T04 | 4 | `transaction_reversal` + `sp_reverse_transaction`, reversible once (G-02) | DB | P03-M04-T03 |
| P03-M04-T05 | 4 | Transaction APIs with `Idempotency-Key`; deposit, withdrawal, receipt, statement, reversal pages | BE + FE | P03-M04-T04, **I-1** |
| P03-M05-T01 | 5 | Seed set 4: 100+ mixed transactions across dates, branches, agents and plans | DB | P03-M04-T02 |

## Phase 4 — Fixed Deposits & Interest (14 tasks, TODO)

**Gates:** OQ-01 (G-01 one active FD) and OQ-04 (G-12 savings interest) resolved first.

| ID | M | Title | Layers | Depends on |
|---|---|---|---|---|
| P04-M01-T01 | 1 | Worker authentication for interest runs; run authorization and audit | BE + tests | P04-M05-T04 |
| P04-M01-T02 | 1 | Cycle configuration via `system_parameter` | DB + BE | P01-M01-T05 |
| P04-M02-T01 | 2 | Customer↔FD linkage view; customer FD listing page | DB + FE | P04-M05-T02 |
| P04-M02-T02 | 2 | Branch-scoped FD access | BE + tests | P04-M02-T01 |
| P04-M03-T01 | 3 | Account-side FD eligibility: account `ACTIVE`, sufficient balance, read under lock (**I-6**) | DB | P04-M05-T02 |
| P04-M03-T02 | 3 | Account closure rule: zero balance and no active FD (BR-18) | DB + BE | P04-M03-T01 |
| P04-M03-T03 | 3 | FD panel on the account detail page | FE | P04-M05-T03 |
| P04-M04-T01 | 4 | `INTEREST_CREDIT` posting path through the ledger routine (**I-5**) | DB | P03-M04-T02 |
| P04-M04-T02 | 4 | Interest credits visible in the statement with correct running balance | BE + FE | P04-M04-T01 |
| P04-M05-T01 | 5 | `fixed_deposit` schema: partial unique active index (G-01), `maturity_date` (G-23), `interest_rate_at_opening` (G-11) | DB | **OQ-01** |
| P04-M05-T02 | 5 | `sp_open_fixed_deposit` — eligibility, debit principal, create FD, atomic | DB | P04-M05-T01, **I-6** |
| P04-M05-T03 | 5 | `fn_calculate_fd_interest` — exact `principal × rate × 30 / 365`, rounded to 2dp | DB | P04-M05-T01 |
| P04-M05-T04 | 5 | `interest_run` + `interest_payout` cycle key + `sp_run_interest_cycle`, one transaction per FD | DB | P04-M05-T03, **I-5** |
| P04-M05-T05 | 5 | FD opening page, FD list, interest run console | BE + FE | P04-M05-T04, **I-1** |

## Phase 5 — Reports, Audit & Reconciliation (15 tasks, TODO)

| ID | M | Title | Layers | Depends on |
|---|---|---|---|---|
| P05-M01-T01 | 1 | Report framework: filters, scope, generation metadata (**publishes I-7**) | BE + FE | P01-M01-T03 |
| P05-M01-T02 | 1 | CSV export utility — same query, same totals (REP-COM-04) | BE | P05-M01-T01 |
| P05-M01-T03 | 1 | Report access auditing (REP-COM-06) | BE + DB | P05-M01-T01 |
| P05-M01-T04 | 1 | Audit search API and page | BE + FE | P01-M01-T05 |
| P05-M02-T01 | 2 | **RPT-01** view: agent-wise counts and values by type | DB | P03-M02-T01 |
| P05-M02-T02 | 2 | RPT-01 API, page and CSV | BE + FE | P05-M02-T01, **I-7** |
| P05-M03-T01 | 3 | **RPT-02** view: account-wise summary, opening/closing balance | DB | P03-M04-T02 |
| P05-M03-T02 | 3 | RPT-02 API, page and CSV | BE + FE | P05-M03-T01, **I-7** |
| P05-M04-T01 | 4 | **RPT-05** view: customer activity (deposits, withdrawals, interest, net) | DB | P03-M04-T02 |
| P05-M04-T02 | 4 | RPT-05 API, page and CSV | BE + FE | P05-M04-T01, **I-7** |
| P05-M04-T03 | 4 | Reconciliation: ledger vs `current_balance` vs `balance_after` (D-1, D-2) | DB + FE | P05-M04-T01 |
| P05-M05-T01 | 5 | **RPT-03** view: active FDs and next payout dates | DB | P04-M05-T02 |
| P05-M05-T02 | 5 | **RPT-04** view: monthly interest distribution by account type | DB | P04-M05-T04 |
| P05-M05-T03 | 5 | RPT-03 and RPT-04 APIs, pages and CSV | BE + FE | P05-M05-T02, **I-7** |
| P05-M05-T04 | 5 | Index review: `EXPLAIN ANALYZE` before/after for every report | DB | P05-M05-T03 |

## Phase 6 — Integration, Testing & Deployment (13 tasks, TODO)

| ID | M | Title | Layers | Depends on |
|---|---|---|---|---|
| P06-M01-T01 | 1 | SQL-injection test suite against every endpoint | Tests | Phase 5 |
| P06-M01-T02 | 1 | Authorization matrix tests: every role × every route | Tests | Phase 5 |
| P06-M01-T03 | 1 | RLS verification: policies hold when the app layer is bypassed | DB + tests | P02-M01-T01 |
| P06-M01-T04 | 1 | Deployment secrets, HTTPS and security headers | Config | — |
| P06-M02-T01 | 2 | Seed validation: all minimum counts met (AC-12) | Tests | P03-M05-T01 |
| P06-M02-T02 | 2 | Master-data integrity tests | Tests | Phase 2 |
| P06-M02-T03 | 2 | Final documentation pass; no doc contradicts another | Docs | all |
| P06-M03-T01 | 3 | Concurrency tests: parallel withdrawals cannot overspend (AC-06) | Tests | P03-M04-T03 |
| P06-M03-T02 | 3 | Constraint test suite: every `CHECK`, `UNIQUE` and FK | Tests | Phase 4 |
| P06-M04-T01 | 4 | Rollback and idempotency tests; partial-failure evidence | Tests | P03-M04-T05 |
| P06-M04-T02 | 4 | Posting performance under load (NFR-PERF-02, NFR-PERF-04) | Tests | P06-M04-T01 |
| P06-M05-T01 | 5 | Interest re-run idempotency test; report totals reconcile (AC-09) | Tests | P05-M05-T03 |
| P06-M05-T02 | 5 | Backup, restore, migration rollback evidence; demonstration script | Ops + Docs | all |

---

## Blocked-task register

| Task | Blocked by | Owner of the decision |
|---|---|---|
| P02-M02-T01 | **OQ-05** — customer identity / login (G-20) | Team + lecturer |
| P03-M04-T01 | **OQ-08** — reference-number uniqueness / transfers (G-05) | Team |
| P04-M05-T01 | **OQ-01** — one active FD vs one FD ever (G-01) | Team |
| P04-M05-T04, P05-M05-T02 | **OQ-04** — savings-account interest in scope? (G-12) | **Lecturer** |

These four decisions are the highest-priority item after Phase 0 approval. Everything in
Phase 1 can proceed in parallel while they are being settled.
