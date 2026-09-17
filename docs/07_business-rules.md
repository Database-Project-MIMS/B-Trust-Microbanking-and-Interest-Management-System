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
| BR-O1 | Every agent is an `app_user` subtype assigned to exactly one branch | CON | `agent.agent_id` is PK/FK to `app_user`; `branch_id NOT NULL` FK to `branch` |
| BR-O2 | Every active agent belongs to an active branch | CON, TRG | `trg_validate_agent_active_branch` locks and validates the branch; `trg_branch_prevent_deactivation_with_active_agents` rejects branch deactivation while active agents remain |
| BR-O3 | Employee number, NIC/passport number and email uniquely identify an agent | CON | Named `UNIQUE` constraints on `employee_no`, `nic_passport_no` and `email` |
| BR-O4 | Referenced users and branches are deactivated rather than physically deleted | CON | Agent FKs use `ON DELETE RESTRICT` (FR-ORG-05) |

## Products and eligibility

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-01 | Every customer is registered at a branch and has one current assigned agent | CON, IDX, SRV | `customer.branch_id NOT NULL FK`; partial unique index on `customer_agent(customer_id) WHERE is_active` (G-10) |
| BR-02 | A customer may own one or more savings accounts; ownership may be individual or joint | CON | `account_holder` intersection table with `UNIQUE(account_id, customer_id)` |
| BR-03 | Children — 12%, no minimum balance | CON | `savings_plan` seeded row: `interest_rate = 0.1200`, `min_balance = 0` |
| BR-04 | Teen — 11%, LKR 500 minimum | CON | `savings_plan`: `0.1100`, `500.00` |
| BR-05 | Adult (18+) — 10%, LKR 1,000 minimum | CON | `savings_plan`: `0.1000`, `1000.00` |
| BR-06 | Senior (60+) — 13%, LKR 1,000 minimum | CON | `savings_plan`: `0.1300`, `1000.00` |
| BR-07 | Joint — 7%, LKR 5,000 minimum, multiple authorised adult holders | CON, FN, TRG | `savings_plan`: `0.0700`, `5000.00`; holder count 2–4 enforced by `trg_validate_joint_mandate`; all holders 18+ via `fn_check_plan_eligibility` |
| BR-E1 | Plan age eligibility is checked from date of birth at account opening | UI, SRV, FN | `fn_check_plan_eligibility(plan_id, dob, holder_count)` reads `min_age_years`/`max_age_years` from `savings_plan` (G-13) — **data, not hardcoded names** |

Rates are stored as fractions (`0.1200`), so interest is one exact multiplication with no
divide-by-100 (see `04_database-schema.md` §B.6).

## Deposits, withdrawals and the ledger

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-08 | Deposits and withdrawals only through authorised users, during configured business hours | SRV, CON | Role check in `requireRole()`; hours read from `system_parameter` / `business_calendar`, re-checked inside `sp_post_deposit` / `sp_post_withdrawal` (G-15) |
| BR-09 | **Overdrafts are never allowed**; withdrawals must preserve the plan minimum | UI, SRV, SP, CON | `SELECT … FOR UPDATE` on the account row, then `fn_check_plan_minimum` inside the transaction; last line of defence is `CHECK (current_balance >= 0)` (G-18) |
| BR-10 | Every transaction has a unique reference, timestamp, type, amount, account and responsible user | CON | `transaction.reference_number UNIQUE NOT NULL` (G-05); `NOT NULL` on type, amount, account, initiator; `amount` uses the `positive_money` domain |
| BR-16 | Posted transactions are **never physically deleted**; corrections use linked reversing entries | TRG, CON | `trg_financial_transaction_immutable` rejects `UPDATE`/`DELETE`; the app role has no `DELETE` grant; `transaction_reversal.original_transaction_id UNIQUE` makes a transaction reversible exactly once (DB-CON-04, G-02) |
| BR-17 | Joint-account withdrawals must satisfy the stored mandate | SRV, FN, TRG | `joint_mandate.mandate_type` (`ANY_ONE` / `ALL_HOLDERS`) validated inside the withdrawal transaction (G-08) |
| BR-18 | Account closure requires zero balance and no active FD | SRV, SP, CON | Checked in the closure procedure against `current_balance = 0` and the absence of an `ACTIVE` FD |
| BR-I1 | A repeated request with the same idempotency key must not create a second financial effect | CON, SRV | Partial unique index on `transaction(idempotency_key)`; the routine catches `23505` and returns the original row (G-04, FR-DEP-04) |
| BR-I2 | Withdrawal limits: LKR 100,000 single, LKR 200,000 daily per account, unless a manager approves | SRV, SP | Values in `system_parameter`; daily total computed inside the locked transaction (SRS §7.1) |
| BR-L1 | A rejected withdrawal creates **no ledger row** but is still recorded | SRV | Audit event only; no `transaction` insert (FR-WD-05) |

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

| ID | Rule | Enforced at | Implementation |
|---|---|---|---|
| BR-S1 | Authorization is checked on the server for every request | SRV | `requireRole()` in every route handler; hiding a nav item is not access control (FR-AUTH-02) |
| BR-S2 | Branch-scoped users never receive rows from other branches | SRV, CON | Scope applied **in the SQL `WHERE` clause**; Row Level Security on `customer`, `account`, `transaction` as the backstop (NFR-SEC-07, REP-COM-02) |
| BR-S3 | Customers see only accounts they hold | SRV, CON | Join through `account_holder`; enforced by RLS (FR-TXN-05) |
| BR-S4 | Passwords are stored only as salted adaptive hashes | SRV | argon2id; no endpoint ever returns `password_hash` |
| BR-S5 | All SQL input values are parameterized | SRV | `$1, $2, …` only; dynamic identifiers via `allowListed()` (NFR-SEC-02) |
| BR-S6 | Security-sensitive and financial actions produce audit events | TRG, SRV | `trg_audit_master_changes` plus explicit audit writes inside financial transactions (FR-AUD-01) |
| BR-S7 | Records referenced by ledger entries are never physically deleted | CON | `ON DELETE RESTRICT` on every FK into financial history (FR-ORG-05, DB-CON-02) |
| BR-20 | Only synthetic data is used | Process | Seed data only; enforced by review, not by code |

---

## Rules that are intentionally **not** in the database

| Rule | Where it lives | Why |
|---|---|---|
| Field formatting, input masks, required-field highlighting | UI | Usability only; every one is re-validated server-side |
| Password complexity policy | SRV | Policy, not data integrity; changes without a migration |
| Report pagination size | SRV | Presentation concern (REP-COM-05) |
| Session inactivity timeout | SRV + `user_session.expires_at` | Computed by the app; the database stores the expiry so sessions can be invalidated server-side |

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
