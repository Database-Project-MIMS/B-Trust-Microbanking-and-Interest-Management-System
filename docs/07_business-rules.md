# 07 — Business Rules

Every rule, and **where it is enforced**.

The core principle (AGENTS.md §5): an important rule must never exist only in the UI. The
`Enforced at` column shows the layers; **at least one must be `DB`** for any rule that
protects money or data integrity. UI enforcement is for usability — the server and
database are what make the rule true.

**Legend:** `UI` form validation · `SRV` service/route-handler validation ·
`CON` database constraint (`CHECK`/`UNIQUE`/`FK`/`NOT NULL`) · `IDX` partial unique index ·
`FN` function · `SP` stored procedure · `TRG` trigger

---

## Organisation

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-O1 | Every `AGENT` and `BRANCH_MANAGER` login has an `agent` branch-staff profile assigned to exactly one branch | CON, SRV | `agent.agent_id` is PK/FK to `app_user`; `agent.branch_id NOT NULL` FK to `branch`; session validation denies a branch-scoped role with no profile |
| BR-O2 | Every active agent belongs to an active branch | CON, TRG | `trg_validate_agent_active_branch` locks and validates the branch; `trg_branch_prevent_deactivation_with_active_agents` rejects branch deactivation while active agents remain |
| BR-O3 | Employee number, NIC/passport number and email uniquely identify an agent | CON | Named `UNIQUE` constraints on `employee_no`, `nic_passport_no` and `email` |
| BR-O4 | Referenced users and branches are deactivated rather than physically deleted | SRV, CON | Organisation APIs expose `PATCH` and no `DELETE`; agent deactivation updates `agent` and `app_user` together; FKs use `ON DELETE RESTRICT` (FR-ORG-05) |
| BR-O5 | Agent-management APIs manage ordinary agents, not branch-manager profiles | SRV | Every agent query joins `role` and requires `role_name = 'AGENT'`; the server assigns the `AGENT` role during creation and rejects role fields in the request |
| BR-O7 | Agent activity respects both current access and immutable posting-branch history | SRV + SQL | T02 revalidates active caller role/profile; AGENT is self-only, manager targets current own-branch ordinary agents and filters `transaction.branch_id` in SQL; ADMIN/CENTRAL_OPS are bankwide. NULL agent attribution is excluded; managers also exclude NULL branch attribution. Inclusive Asia/Colombo dates use half-open timestamp bounds. Counts/SUM are calculated in PostgreSQL; no net balance inferred. ADR-0017. |
| BR-O6 | Branch and agent master-data changes are audited atomically without storing passwords or identity numbers | TRG | `trg_audit_branch`, `trg_audit_agent` and the linked `app_user` trigger write through the sanitized `fn_audit_master_changes()` function in the caller transaction |

## Products and eligibility

**Customer schema enforcement (P02-M02-T01, 0220):** customer_number,
nic_passport_no and email are NOT NULL/UNIQUE; customer_id is independent and
app_user_id is optional/unique (ADR-0007). Branch/login FKs restrict deletion;
ck_customer_birth_date_past rejects today/future dates; ck_customer_status permits
ACTIVE/INACTIVE. 0221/0222 implement assignment/document integrity; T04 implements
atomic registration and scoped/masked reads. Runtime grants/RLS remain M1 work.
Registration accepts metadata-only, initially unverified documents (zero to twenty);
M3 enforces required verified documentation at account opening (`sp_open_savings_account`, `DOCUMENTS_NOT_VERIFIED`, migration 0243). The service uppercases
identity and lowercases email before the database UNIQUE checks. Audit contains only
customer reference, branch, assigned agent and document count, in the same transaction.
See schema Part B.4 and ADR-0014 for the implemented definition.

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-01 | Every customer is registered at a branch and has one current assigned agent | CON, IDX, SRV | `customer.branch_id NOT NULL FK`; 0221 partial unique index allows at most one active assignment (G-10). Implemented T04 registration supplies existence atomically; future reassignment must retain history/existence. Direct owner inserts are not an existence guarantee. |
| BR-02 | A customer may own one or more savings accounts; ownership may be individual or joint | CON | `account_holder` intersection table with `UNIQUE(account_id, customer_id)` |
| BR-03 | Children — 12%, no minimum balance | CON | `savings_plan` seeded row: `interest_rate = 0.1200`, `min_balance = 0` |
| BR-04 | Teen — 11%, LKR 500 minimum | CON | `savings_plan`: `0.1100`, `500.00` |
| BR-05 | Adult (18+) — 10%, LKR 1,000 minimum | CON | `savings_plan`: `0.1000`, `1000.00` |
| BR-06 | Senior (60+) — 13%, LKR 1,000 minimum | CON | `savings_plan`: `0.1300`, `1000.00` |
| BR-07 | Joint — 7%, LKR 5,000 minimum, multiple authorised adult holders | CON, FN, TRG | `savings_plan`: `0.0700`, `5000.00`; holder count 2–4 and all-holders-18+ enforced by `trg_validate_joint_mandate` (Phase 2, P02-M03-T03) — `fn_check_plan_eligibility` only checks the primary applicant, since its signature carries one `date_of_birth`, not one per holder |
| BR-E1 | Plan age eligibility is checked from date of birth at account opening | UI, SRV, FN | `fn_check_plan_eligibility(plan_id, dob, holder_count)` reads `min_age_years`/`max_age_years` from `savings_plan` (G-13) — **data, not hardcoded names**. Checks the primary applicant only; see BR-07 for the joint-holder-age rule |

Rates are stored as fractions (`0.1200`), so interest is one exact multiplication with no
divide-by-100 (see `04_database-schema.md` §B.6).

## Deposits, withdrawals and the ledger

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-08 | Deposits and withdrawals only through authorised users, during configured business hours | SRV, CON | Role check in `requireRole()`; hours read from `system_parameter` / `business_calendar`, re-checked inside `sp_post_deposit` / `sp_post_withdrawal` (G-15); the initial deposit of `sp_open_savings_account` is checked with `fn_is_business_hour` (`OUTSIDE_BUSINESS_HOURS`) |
| BR-09 | **Overdrafts are never allowed**; withdrawals must preserve the plan minimum | UI, SRV, SP, CON | `SELECT … FOR UPDATE` on the account row, then `fn_check_plan_minimum(account_id, current_balance - amount)` (`database/routines/fn_check_plan_minimum.sql`, I-4) called by `sp_post_withdrawal` inside the transaction; last line of defence is `CHECK (current_balance >= 0)` (G-18) |
| BR-10 | Every transaction has a unique reference, timestamp, type, amount, account and responsible user | CON | `transaction.reference_number UNIQUE NOT NULL` (G-05); `NOT NULL` on type, amount, account, initiator; `amount` uses the `positive_money` domain |
| BR-16 | Posted transactions are **never physically deleted**; corrections use linked reversing entries | TRG, CON | `trg_financial_transaction_immutable` rejects `UPDATE`/`DELETE`; the app role has no `DELETE` grant; `transaction_reversal.original_transaction_id UNIQUE` makes a transaction reversible exactly once (DB-CON-04, G-02) |
| BR-17 | Joint-account withdrawals must satisfy the stored mandate | SRV, FN, TRG | `joint_mandate.mandate_type` (`ANY_ONE` / `ALL_HOLDERS`) validated inside the withdrawal transaction (G-08) by `fn_check_withdrawal_mandate(account_id, signer_customer_ids)` (`database/routines/fn_check_withdrawal_mandate.sql`, I-4, P03-M03-T02), called by `sp_post_withdrawal` after the account lock. Stored and shape-checked by `0242`: `CHECK`s, `UNIQUE(account_id)`, `trg_joint_mandate_fit`; holder count/adult rule by `trg_validate_joint_mandate` |
| BR-18 | Account closure requires zero balance and no active FD | SRV, SP, CON | Checked in the closure procedure against `current_balance = 0` and the absence of an `ACTIVE` FD |
| BR-I1 | A repeated request with the same idempotency key must not create a second financial effect | CON, SRV | Partial unique index on `transaction(idempotency_key)` (G-04, FR-DEP-04); withdrawal 0363 serializes per key, locks account and binds replay to the original actor/account/channel/amount/narration/canonical signer set; matching replay returns the original row without another debit |
| BR-I2 | Withdrawal limits: LKR 100,000 single, LKR 200,000 daily per account, unless a manager approves | SRV, SP | Values in `system_parameter`; daily total computed inside the `sp_post_withdrawal` locked transaction (SRS §7.1) |
| BR-I3 | A repeated account-opening request (same `Idempotency-Key`) never opens a second account or credits a second initial deposit | CON, SRV | `account_opening_request` `UNIQUE (user_id, idempotency_key)` written in the opening transaction (migration 0244); per-key advisory lock; replay returns the original result (FR-DEP-04 pattern for accounts) |
| BR-L1 | A rejected withdrawal creates **no ledger row** but is still recorded | SRV, SP | `sp_try_post_withdrawal` (0363) rolls back inner financial work for known business rejections, CALLs `sp_write_rejection_audit` in the outer transaction and returns a code. Service commits that audit-only result, then maps a safe error outside withTransaction (FR-WD-05). Legacy throwing calls roll back their audit with the caller transaction. |

**Ledger attribution (G-07, P03-M02-T01):** migration 0320 adds nullable reporting
agent/posting-branch FKs with ON DELETE RESTRICT. The existing immutability trigger
protects both fields after insert, preserving history when an agent transfers branches.
Legacy/system/unattributed values may be NULL. The future posting producer must capture
authorized attribution in its transaction; FKs do not enforce branch authorization or
attribution completeness. Existing M3 opening deposits still omit these values.

**Withdrawal correction (0363, ADR-0021):** an authenticated AGENT uses its stored
profile as attribution; manager/admin are not inferred as reporting agents. Posting
branch comes from verified staff scope, or the locked account for an authorized
bankwide/admin or linked customer operation. No NULL legacy row is backfilled.
Amounts are positive finite exact cents; active channel, stored actor/context and
branch/assignment/self scope are checked before posting. Customer self-service cannot
claim another holder's signature. The future T05 service must validate signer evidence.
Calendar/hours use fn_is_business_hour; limits use WITHDRAWAL_SINGLE_LIMIT and
WITHDRAWAL_DAILY_LIMIT per account, with Asia/Colombo half-open day bounds. Validation,
configuration and unexpected SQL errors abort rather than becoming business rejections.

### Why `FOR UPDATE` and not just a `CHECK`

The `CHECK (current_balance >= 0)` alone cannot prevent two concurrent withdrawals from
both reading a balance of 1,000 and each deciding 600 is affordable. Under `READ
COMMITTED`, both would proceed and the second `UPDATE` would fail the check — correct, but
as an error rather than a clean rejection. Locking the account row first serialises the
two withdrawals so the second reads the balance the first left behind and is rejected with
a proper business error. The `CHECK` remains as the guarantee that no bug can ever produce
a negative balance (NFR-SAFE-01, AC-06).

## Fixed deposits and interest

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-11 | An FD may only be opened against an **active** savings account | SRV, SP, CON | `sp_open_fixed_deposit` reads the account under lock and requires `status = 'ACTIVE'` |
| BR-12 | Only one **active** FD per savings account | IDX | Partial unique index `ON fixed_deposit(account_id) WHERE status='ACTIVE'` (**G-01 — pending OQ-01**) |
| BR-13 | FD products: 6 months / 13%, 1 year / 14%, 3 years / 15% | CON | Three seeded `fd_plan` rows; `tenure_months > 0` |
| BR-14 | FD interest is calculated every 30 days and credited to the linked savings account **as a separate transaction** | SP, CON | `sp_run_interest_cycle` posts an `INTEREST_CREDIT` through the ledger routine; `interest_payout.transaction_id UNIQUE` guarantees exactly one ledger row per distribution |
| BR-15 | The **central system** performs interest calculations and records distributions and control totals | SP, CON | `interest_run` stores `fd_count`, `total_interest`, `exception_count`; `UNIQUE(cycle_date)` prevents a duplicate run (G-03) |
| BR-19 | Product rates are effective-dated; historical records retain the applicable version | CON | `fixed_deposit.interest_rate_at_opening NOT NULL`, set once and never updated; the interest function reads **that column**, never the plan (G-11) |
| BR-F1 | Maturity date is derived from term and opening date, fixed at opening | SP, CON | `maturity_date` computed by `sp_open_fixed_deposit` from `fd_plan.tenure_months` (G-23, FR-FD-04) |
| BR-F2 | The same FD may not be paid twice for the same cycle | CON | `UNIQUE(fd_id, cycle_date)` on `interest_payout` — this **is** the idempotency guarantee, not a procedural check (NFR-SAFE-03, AC-08) |

### The interest formula

```
interest = round(principal × interest_rate_at_opening × 30 / 365, 2)
```

Exact `NUMERIC` throughout (SRS §4.10, Appendix B.1). Rates are fractions, so no
division by 100. Rounding to two decimal places happens once, at the end, using
PostgreSQL's decimal rounding (SRS §7.1) — never in JavaScript.

**Worked example:** LKR 100,000 at 14% for one cycle →
`100000 × 0.1400 × 30 / 365 = 1150.6849…` → **LKR 1,150.68**.

### Why one transaction per FD, not one per run

FR-INT-04: a failed distribution must roll back **without affecting FDs already
processed**. `sp_run_interest_cycle` therefore opens the run, then processes each due FD in
its own transaction, recording failures in `exception_count` rather than aborting. Wrapping
the whole run in one transaction would violate FR-INT-04.

## Security and access

P02-M02-T05 customer routes authenticate live sessions, enforce route roles and SQL
branch/assignment/self scope, validate strict fields and verify CSRF for registration.
The service rechecks stored actor state before setting transaction-local RLS context.
Migration 0223 extends parent scope to customer assignment/document SELECT/INSERT;
it permits only unverified document inserts and self-agent assignment for AGENT.
The customer trigger writes one sanitized audit in the registration transaction,
including rollback when a later document/assignment insert fails (ADR-0015).
NIC/email masking is performed in response shaping, before data reaches the browser.

P02-M02-T03 implements document verification in services/customer-document-service.ts:
active AGENT/BRANCH_MANAGER only, active staff profile/branch and active customer,
branch scope in SQL, current assignment required for AGENT. The caller supplies the
authenticated session user ID. One withTransaction locks authorization/customer/document
rows, sets verified_by/verified_date together and inserts a minimal audit event using
the same client. Paths/content/identity are excluded from audit JSON. Same-verifier
retry retains timestamp/audit count; another verifier receives 409
DOCUMENT_ALREADY_VERIFIED. Invalid UUIDs fail with 400; denied scope/role with 403;
missing document with 404. M1's grants/RLS and future controller authentication/CSRF
remain separate work. 0222's CHECK also rejects half-verification from direct SQL.

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-S1 | Authorization is checked on the server for every request | SRV | `requireRole()` in every route handler; hiding a nav item is not access control (FR-AUTH-02) |
| BR-S2 | Branch-scoped users never receive rows from other branches | SRV, CON | `AGENT` and `BRANCH_MANAGER` scope comes from `agent.branch_id`; a missing profile is denied; scope is applied **in the SQL `WHERE` clause**; Row Level Security on `customer`, `account`, `transaction` is the backstop (NFR-SEC-07, REP-COM-02) |
| BR-S3 | Customers see only accounts they hold | SRV, CON | Join through `account_holder`; enforced by RLS (FR-TXN-05) |
| BR-S4 | Passwords are stored only as salted adaptive hashes | SRV | argon2id; no endpoint ever returns `password_hash` |
| BR-S5 | All SQL input values are parameterized | SRV | `$1, $2, …` only; dynamic identifiers via `allowListed()` (NFR-SEC-02) |
| BR-S6 | Security-sensitive and financial actions produce audit events | TRG, SRV | Sanitized `fn_audit_master_changes()` triggers cover master data; explicit audit writes remain inside financial transactions (FR-AUD-01) |
| BR-S7 | Records referenced by ledger entries are never physically deleted | CON | `ON DELETE RESTRICT` on every FK into financial history (FR-ORG-05, DB-CON-02) |
| BR-20 | Only synthetic data is used | Process | Seed data only; enforced by review, not by code |

---

## Rules that are intentionally **not** in the database

| Rule | Where it lives | Why |
|---|---|---|
| Field formatting, input masks, required-field highlighting | UI | Usability only; every one is re-validated server-side |
| Password complexity policy | SRV | Policy, not data integrity; changes without a migration |
| Report pagination size | SRV | Presentation concern (REP-COM-05) |
| Session inactivity and absolute timeout | SRV + SQL + `user_session.expires_at` | Creation uses configured limits in SQL inside the caller transaction; validation refreshes inactivity without exceeding the absolute deadline, rejecting expired/revoked sessions. Browser cookie expires at the absolute limit |

### RPT-01 database aggregation contract (0520, ADR-0020)

**Runtime follow-up (0521, ADR-0022):** Current stored active report roles are
validated in both service and SQL. Manager branch predicates use immutable posting
branch before the roster outer join. Net = deposits + interest − withdrawals +
linked withdrawal reversals − linked deposit/interest reversals. Missing/invalid
original links make net unresolved, never an assumed credit. Counts and NUMERIC
sums stay exact strings, including page and full-filter totals. REPEATABLE READ
materialization and REPORT_ACCESSED audit commit together; CSV then streams its
private snapshot spool. NULL-agent exclusions are disclosed separately. Legacy
global transaction RLS remains an owner integration gap, not a report grant.

Counts/values use captured `transaction.agent_id` and `transaction.branch_id`, never
current membership or inferred attribution. Include all agent profiles regardless
of current role/status; report request authorization is a separate I-7 responsibility.
Retain exact timestamps, bigint counts and unbounded NUMERIC sums. Positive amounts
remain grouped by type, with REVERSAL separate; the 0521 readers above implement
signed net from valid original links. Selected-range zero rows require the eligible roster's
LEFT JOIN to already-filtered facts, not a WHERE date filter after the outer join.
The owner-only invoker/barrier view exposes no live runtime report by itself.

---

## Traceability

| Source | IDs covered here |
|---|---|
| Brief — savings plans, FD products, overdraft ban, one FD per account, 30-day interest, unique references | BR-03…BR-14 |
| SRS §7 Business Rules | BR-01…BR-20 (all 20) |
| SRS §5.2 Safety | BR-09 (SAFE-01/02), BR-F2 (SAFE-03), BR-12 (SAFE-04), transaction rules (SAFE-05) |
| SRS §6.4 Keys and Constraints | DB-CON-01…06 → BR-10, BR-16, BR-F2, BR-09, BR-S7 |
| SRS §7.1 Assumed operational rules | BR-08, BR-I2 |
| ERD gap analysis | BR-12 (G-01), BR-10 (G-05), BR-19 (G-11), BR-E1 (G-13) |

**Unresolved:** BR-12's exact form depends on **OQ-01**. Whether savings accounts accrue
interest at all (**OQ-04**) would add rules BR-14a/BR-15a — see `17_erd-gap-analysis.md`
G-12.

## Customer FD read scope (P04-M02-T01)

FD principal and opening rate are read from fixed_deposit, never recomputed from the
current product rate (BR-19). A customer receives only FDs linked through actual
account_holder membership, including matured/closed history; joint-account listing
does not reveal another holder's profile. Both customer and account branch must
match branch staff, and AGENT also needs the current customer assignment. CUSTOMER
requires the optional app_user_id self link; CENTRAL_OPS/AUDITOR read bankwide.
Enforcement: migration0420 caller-security view and SELECT FD RLS; service revalidated
actor/local RLS context/parameterized WHERE; route role/session checks. No read changes
FD rows, account balance, ledger or audit. Future FD opening ledger/audit correctness
remains M5/M4's financial boundary, outside this read task.

P04-M02-T02 /0421 adds an ANDed restrictive SELECT actor guard: current active
stored identity/role and current active branch staff profile must agree with trusted
transaction context. Missing identity/branch, inactive user/role/profile/branch and
stale/forged context fail closed for direct FD/view SQL reads. Existing row scope
still checks both branches, current assignment and the optional self link. Bankwide
readers retain bankwide scope even with a historical inactive staff profile. This
does not authenticate database context setters; live server session checks remain
mandatory. General Phase 4 gate is unchanged; ADR-0019 authorizes this task only.
