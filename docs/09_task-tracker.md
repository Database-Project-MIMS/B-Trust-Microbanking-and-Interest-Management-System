# 09 — Task Tracker

**Task ID:** `P<phase>-M<member>-T<task>` — e.g. `P03-M04-T02`.
**Branch:** `feat/p03-m04-<slug>` (AGENTS.md §12).

**Statuses:** `TODO` (not ready) · `READY` (dependencies met, start now) · `IN_PROGRESS` ·
`BLOCKED` (say why) · `REVIEW` (PR open) · `DONE`.

**Update rules:** you update **only your own rows**. Change status in the same PR as the
work. A task is `DONE` only when every item in the AGENTS.md §16 Definition of Done is
satisfied.

**2026-10-05 closeout:** Vibodha authorized cross-member status reconciliation and
Phase 2 entry after verification. `DONE` below records verified implementation in the
local working tree. Closeout was committed as fad4f13 and integrated into dev by
PR #33 (76701e7); PR #34 merged into dev at 2e338a6. PR #35 and customer registration
PR #38 are now merged, followed by M3's holder PR #37 and M1's security PR #40.
T05 is verified locally on feat/p02-m02-customer-api-ui based on dev 25fc264.
Preserve user commit/push/merge
control; no assistant commit, push or completed merge is authorized. See the
[approved checkpoint](../.agent/checkpoints/phase-01-checkpoint.md).

---

## Status summary

| Phase | Total | TODO | READY | IN_PROGRESS | BLOCKED | REVIEW | DONE |
|---|---|---|---|---|---|---|---|
| P0 | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| P1 | 19 | 0 | 0 | 0 | 0 | 0 | 19 |
| P2 | 16 | 1 | 0 | 0 | 0 | 0 | 15 |
| P3 | 14 | 12 | 0 | 0 | 0 | 1 | 1 |
| P4 | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| P5 | 15 | 15 | 0 | 0 | 0 | 0 | 0 |
| P6 | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| **All** | **97** | **55** | **0** | **0** | **0** | 1 | **41** |

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

Phase 1 is complete and its exit checkpoint approved on 2026-10-05. All 19 task
implementations are verified by 184 passing tests, clean rebuild, typecheck, lint and
production build. I-1, I-2 and I-8 are available.

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
| **Status / Branch** | DONE · `feat/p01-m01-app-shell` · verified at Phase 1 closeout |

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
| **Status / Branch** | DONE · `feat/p01-m01-parameters-audit` · verified at Phase 1 closeout |

### Member 2 — Organisation

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M02-T01** | Branch schema | `0120_p01_m02_branch.sql` — `branch` + `branch_code UNIQUE`, status check | — | — | Duplicate `branch_code` rejected; delete restricted | `0000` | DONE |
| **P01-M02-T02** | Agent schema | `0121_p01_m02_agent.sql` — `agent` as a subtype of `app_user`; `employee_no UNIQUE`, `nic_passport_no UNIQUE`, `email UNIQUE`; index `(branch_id, status)` | — | — | FR-ORG-02: agent in exactly one active branch | T01, P01-M01-T01 | DONE |
| **P01-M02-T03** | Branch & agent APIs | `0122_p01_m02_organization_audit.sql` — sanitized, same-transaction branch/agent auditing | `GET/POST/PATCH /api/branches`, `/api/agents`; deactivate-not-delete | — | API authorization, scope, atomicity, rollback/audit and negative tests | T02, **I-1**, P01-M01-T05 contract | DONE |
| **P01-M02-T04** | Branch & agent admin UI | — | — | `app/branches/page.tsx`, `app/agents/page.tsx` — role-aware active/all lists, create forms and confirmed deactivation | `tests/e2e/branches-agents.test.mjs` — create, list, deactivate and history retention | T03 | DONE |

Branch: `feat/p01-m02-<slug>`. Acceptance: ≥ 3 branches and ≥ 5 agents can be created and
listed (FR-ORG-01); no record referenced by history can be deleted (FR-ORG-05).

### Member 3 — Savings plans

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M03-T01** | Savings plan schema with eligibility data | `0140_p01_m03_savings_plan.sql` — `savings_plan` + `min_age_years`, `max_age_years`, `min_holders`, `max_holders`, `requires_all_adult`; age-range check | — | — | `tests/db/savings-plan-constraints.test.mjs` — 8/8 passing, five plans load with exactly the BR-03…BR-07 rates and minimums, all negative cases covered | `0000`; **G-13** approved | DONE (branch `feat/p01-m03-savings-plan-schema`) |
| **P01-M03-T02** | Eligibility function | `fn_check_plan_eligibility(plan_id, date_of_birth, holder_count)` in `database/routines/fn_check_plan_eligibility.sql` | — | — | `tests/db/plan-eligibility-function.test.mjs` — 10/10 passing: child aged 15 rejected for Children; adult aged 30 accepted for Adult; 1 holder rejected for Joint; both boundary cases and all negative/invalid-input cases covered | T01 | DONE (branch `feat/p01-m03-plan-eligibility-function`) |
| **P01-M03-T03** | Plan API and administration page | — | `GET /api/plans`, `PATCH /api/plans/{id}` | `app/plans/page.tsx` + `SavingsPlanClient.tsx` | `tests/api/plans.test.mjs` — 9/9 passing: any role reads, ADMIN/CENTRAL_OPS edit, AGENT gets 403 (client-hidden and server-enforced), CSRF required, zod + DB CHECK both reject bad age/holder ranges | T02, **I-1** | DONE (branch `feat/p01-m03-plan-api-page`) |

Acceptance: eligibility is a **data-driven join**, not `IF plan_name = 'Children'`
hardcoded in TypeScript.

### Member 4 — Data access layer & channels

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M04-T01** | Harden `lib/db` — **publishes I-2** | — | Retry on `40001`/`40P01`, SQLSTATE → domain error mapping, query timing log with value redaction, pool metrics | — | `withTransaction` rolls back on throw; no secret or SQL text appears in a mapped error | Phase 0 scaffold | DONE |
| **P01-M04-T02** | Transaction channel schema | `0160_p01_m04_transaction_channel.sql` — `transaction_channel`; seeds `BRANCH_COUNTER`, `ONLINE`, `SYSTEM` | — | — | `channel_name` unique | `0000` | DONE |
| **P01-M04-T03** | Migration runner tests & rebuild proof | — | Harden `scripts/migrate.mjs`; isolated verification harness | — | Clean rebuild, checksum/pending/missing-file rejection, failed-DDL rollback and verification pass | T02 | DONE |
| **P01-M04-T04** | Database health page | — | Validated session; ADMIN/CENTRAL_OPS infrastructure details through service | `app/admin/health/page.tsx` | Forged, missing, expired and revoked sessions denied; safe DB failure | T01, **I-1** | DONE |

### Member 5 — FD products & seed framework

| ID | Title | DB | Backend | Frontend | Tests | Depends | Status |
|---|---|---|---|---|---|---|---|
| **P01-M05-T01** | FD product schema | `0180_p01_m05_fd_plan.sql` — `fd_plan`, `tenure_months > 0`, effective-dating columns | — | — | Exactly the three BR-13 products; rate stored as a fraction | `0000`; **G-11** approved | DONE |
| **P01-M05-T02** | FD product API and admin page | — | `GET/PATCH /api/fd-products` | `app/fd-products/page.tsx` — products with rate history | Non-privileged role cannot change a rate | T01, **I-1** | DONE |
| **P01-M05-T03** | Seed framework — **publishes I-8** | `database/seed/` layout, fixed-UUID scheme, ordered load, `scripts/seed-check.mjs` | — | — | Seeding twice produces identical row counts and identical totals | T01 | DONE |

---

## Phase 2 — Customers, Accounts & Joint Ownership (16 tasks, entry approved)

**Gate:** OQ-05/G-20, G-06 and G-08 are resolved by ADR-0007, ADR-0008 and ADR-0009.
The Phase 1 exit checkpoint and Phase 2 entry were approved by Vibodha on 2026-10-05.

**Progress:** P02-M03-T01 and P02-M04-T01 are DONE (`0240` account and `0260`
immutable transaction migrations). M2 T01–T04 are technically DONE in this PR's tree:
0220 customer, 0221 assignment history, 0222 documents/verification and registration,
search/profile/validation services. Historical focused T04 evidence: 181 tests and
clean 14-migration rebuild/reapply/verify/typecheck/lint. PR #36 combines this work
with dev's closeout; its earlier verification passed 328 tests with no failures/skips,
clean 14-migration rebuild, TypeScript/lint/production build, recorded in the
[resolution handoff](../.agent/handoffs/p02-m02-t04-pr36-conflict-resolution.md).

The refresh against PR #35's updated 888b983 includes dev 2e338a6 and keeps T04 DONE;
fresh verification passed 328 tests and clean 14-migration rebuild/typecheck/lint/build;
evidence and user publication order are in the
[dependency handoff](../.agent/handoffs/p02-m02-t04-pr36-after-pr35.md).

**2026-10-07 T05:** the preceding conflict-resolution evidence is historical. Current
dev 25fc264 contains customer registration, real account_holder and M1 RLS/audit.
T05 connects authenticated customer routes and live registration/search/profile screens,
reuses the shared RLS context and sanitized customer trigger, and adds M2 migration 0223
for scoped child SELECT/INSERT. 365 tests (35 suites) pass, with a clean 19-migration
rebuild, typecheck, lint and production build. Browser registration/search/profile and
duplicate handling also pass. [T05 handoff](../.agent/handoffs/p02-m02-t05-customer-api-ui.md)
and ADR-0015 record scope/security review. M1-T03 remains its owner's broader route
task. M3-T03 (`0242` joint mandate) is DONE and merged into dev; M3-T04 (`0243` account-opening routine) is DONE. M3-T05 (accounts and holders APIs, `0244`/`0245`) is DONE and merged into dev; M3-T06 (account screens, 486 tests passing) is DONE and merged into dev; its browser pass is partial (happy path blocked by missing document verification and the branch-manager seed gap, see open-questions). User controls publication. No Phase 2 exit/Phase 3 entry approval.

| ID | M | Title | Layers | Depends on | Status |
|---|---|---|---|---|---|
| P02-M01-T01 | 1 | RLS policies on `customer` and `account` | DB + tests | P01-M01-T03, P02-M02-T01, P02-M03-T01 | DONE |
| P02-M01-T02 | 1 | Audit coverage for customer and account creation | DB + BE | P01-M01-T05, P02-M02-T01, P02-M03-T01 | DONE |
| P02-M01-T03 | 1 | Branch-scope enforcement on customer and account routes | BE + tests | P02-M02-T02 | TODO |
| P02-M02-T01 | 2 | `customer` schema + identity uniqueness + trigram search index | DB | ADR-0007 approved, P01-M02-T02 | DONE |
| P02-M02-T02 | 2 | `customer_agent` + one-active-assignment partial index (G-10) | DB | P02-M02-T01 | DONE |
| P02-M02-T03 | 2 | `customer_document` schema and verification | DB + BE | P02-M02-T01 | DONE |
| P02-M02-T04 | 2 | Customer registration service — customer + document + assignment + audit in **one transaction** | BE | P02-M02-T02, P02-M02-T03 | DONE |
| P02-M02-T05 | 2 | Customer API endpoints and registration/search/profile screen integration | BE + FE | P02-M02-T04; M1 scoped grants/RLS/audit integration | DONE |
| P02-M03-T01 | 3 | `account` schema + `branch_id` (G-06) + non-negative balance check (G-18) | DB | P01-M03-T01, ADR-0008 approved | DONE |
| P02-M03-T02 | 3 | `account_holder` + `holder_type` (2–4 adult count rule lands in T03 trigger) | DB | P02-M03-T01, P02-M02-T01 | DONE |
| P02-M03-T03 | 3 | `joint_mandate` + `trg_validate_joint_mandate` (statement-level, transition tables) — `0242_p02_m03_joint_mandate.sql`, `tests/db/joint-mandate-trigger.test.mjs` 32/32 (incl. concurrency, UPDATE paths, `mims_app` under RLS); full isolated suite 397/397; `/review` findings resolved | DB | P02-M03-T02, ADR-0009 approved | DONE (merged into dev) |
| P02-M03-T04 | 3 | `sp_open_savings_account` — account + holders + mandate + optional initial deposit, atomic — `0243_p02_m03_sp_open_savings_account.sql` (+ `fn_next_account_number`), `tests/db/sp-open-savings-account.test.mjs` 29/29 (incl. locks, hours, malformed input, `mims_app` atomicity); full isolated suite 426/426; `/review` findings resolved | DB | P02-M03-T03, P02-M04-T01 | DONE |
| P02-M03-T05 | 3 | Accounts and holders APIs — `POST/GET /api/accounts`, `GET /api/accounts/{id}`, `POST …/holders`, `POST …/close` (501 stub); migrations `0244` (idempotency table) and `0245` (`sp_add_account_holder`); `services/account-service.ts`; `tests/api/accounts.test.mjs` 23/23, DB tests 15; full isolated suite 464/464; typecheck, lint, build clean | BE + DB | P02-M03-T04, **I-1** | DONE (merged into dev) |
| P02-M03-T06 | 3 | Account opening wizard, account detail, holder management pages — live `/accounts`, `/accounts/new` (review step, idempotent submit), `/accounts/{id}` (add holder), real `/plans`; pure-logic tests `tests/e2e/accounts-ui-model.test.mjs` 12/12 and `tests/e2e/plan-edit-ui-model.test.mjs` 10/10; `/review` important findings fixed (focus trap, NaN age guard, review-step error); full isolated suite 486/486; typecheck, lint, build clean; browser pass partial (happy path blocked by missing document verification) | FE | P02-M03-T05 | DONE (merged into dev) |
| P02-M04-T01 | 4 | `transaction` schema + immutability trigger (`UPDATE`/`DELETE` rejected) | DB | P01-M04-T02, P02-M03-T01 | DONE |
| P02-M05-T01 | 5 | Seed sets 1–3: branches, agents, customers, accounts, 2 joint accounts | DB | P02-M03-T04, P01-M05-T03 | DONE |

## Phase 3 — Financial Transactions (12 TODO, 1 REVIEW, 1 DONE)

**Gate:** Phase 2 exit approval; OQ-12 transfer typing and OQ-14 lecturer scope acceptance.
OQ-08 was resolved by ADR-0010; it is not an open blocker.

**Scoped exception (2026-10-08):** Vibodha authorized P03-M02-T01 to start early
and its prescribed G-07 schema (ADR-0016). M4 transaction schema is merged.
This does not approve Phase 2 exit, general Phase 3 entry, or OQ-12/OQ-14.
P03-M02-T02 remains TODO; user publication and M4 review are retained.

T01's 0320 migration and 15 attribution tests are verified locally: clean
24-migration rebuild, 501 tests in 45 suites, TypeScript/lint/build all pass.
[Handoff and review](../.agent/handoffs/p03-m02-transaction-attribution.md).
REVIEW below means ready for the user's PR; it does not claim publication.

**M3 early start (2026-10-08):** P03-M03-T01 (`fn_check_plan_minimum`, I-4) was started
at the user's direction and is DONE. ADR-0016 covers only P03-M02-T01, so this does not
extend that exception; it likewise does not approve Phase 2 exit or general Phase 3 entry.

| ID | M | Title | Layers | Depends on | Status |
|---|---|---|---|---|---|
| P03-M01-T01 | 1 | Business-hours and withdrawal-limit enforcement from `system_parameter` | DB + BE | P01-M01-T05 | TODO |
| P03-M01-T02 | 1 | Manager-only authorization for reversals | BE + tests | P03-M04-T04 | TODO |
| P03-M01-T03 | 1 | Audit events for every financial operation | BE + tests | P03-M04-T02 | TODO |
| P03-M02-T01 | 2 | `agent_id` / `branch_id` attribution on `transaction` (G-07) + reporting indexes | DB | P02-M04-T01, G-07 authorized by ADR-0016 | REVIEW (verified locally; user PR/M4 review pending) |
| P03-M02-T02 | 2 | Agent daily activity API and page | BE + FE | P03-M02-T01 | TODO |
| P03-M03-T01 | 3 | `fn_check_plan_minimum` — post-withdrawal minimum-balance rule (**publishes I-4**) — `database/routines/fn_check_plan_minimum.sql`, `tests/db/fn-check-plan-minimum.test.mjs` 11/11; handoff [i-4](../.agent/handoffs/i-4-fn-check-plan-minimum.md) | DB | P02-M03-T01 | DONE |
| P03-M03-T02 | 3 | Joint-mandate validation callable from the withdrawal path | DB | P02-M03-T03 | TODO |
| P03-M03-T03 | 3 | Account balance panel and holder authority display | FE | P03-M04-T02 | TODO |
| P03-M04-T01 | 4 | Reference-number generation + `UNIQUE`; `idempotency_key` partial unique index (G-04) | DB | **OQ-08** (ADR-0010) | DONE (migration `0360`, branch `feat/p03-m04-reference-idempotency-indexes`) |
| P03-M04-T02 | 4 | `sp_post_deposit` — lock, insert ledger, update balance, `balance_after`, audit | DB | P03-M04-T01 | DONE (migration `0361`, branch `feat/p03-m04-sp-post-deposit`) |
| P03-M04-T03 | 4 | `sp_post_withdrawal` — lock, re-validate status/mandate/limits/minimum, debit | DB | P03-M04-T02, **I-4** | TODO |
| P03-M04-T04 | 4 | `transaction_reversal` + `sp_reverse_transaction`, reversible once (G-02) | DB | P03-M04-T03 | TODO |
| P03-M04-T05 | 4 | Transaction APIs with `Idempotency-Key`; deposit, withdrawal, receipt, statement, reversal pages | BE + FE | P03-M04-T04, **I-1** | TODO |
| P03-M05-T01 | 5 | Seed set 4: 100+ mixed transactions across dates, branches, agents and plans | DB | P03-M04-T02 | TODO |

## Phase 4 — Fixed Deposits & Interest (14 tasks, TODO)

**Gates:** Phase 3 exit approval; OQ-13 mid-cycle interest and OQ-14 scope acceptance.
OQ-01/OQ-04 were resolved by ADR-0011/ADR-0012; they are not open blockers.

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
| Phase 3 transaction work | **OQ-12**, **OQ-14** — transfer typing and lecturer scope acceptance | Team / Lecturer |
| Phase 4 interest work | **OQ-13**, **OQ-14** — mid-cycle interest and scope acceptance | Team / Lecturer |

These future-phase decisions do not block P02-M02-T01. OQ-11 is needed before optional
customer login provisioning/UI, rather than before the independent customer schema.
