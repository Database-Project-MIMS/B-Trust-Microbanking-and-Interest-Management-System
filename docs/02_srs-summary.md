# 02 — SRS Summary (implementation-oriented)

A condensed, buildable digest of the 53-page Group 32 SRS v1.1. This does not replace the
SRS — it maps the requirements that change what we write.

---

## Functional requirements

### Authentication and access (FR-AUTH) — M1
| ID | Requirement | Implemented by |
|---|---|---|
| FR-AUTH-01 | Authenticate active users over HTTPS; create a secure session | `POST /api/auth/login`, `user_session` |
| FR-AUTH-02 | Enforce role and branch scope before reading or changing protected data | `requireRole()`, `branchScope()` in SQL, RLS |
| FR-AUTH-03 | Throttle repeated failed sign-ins | `login_attempt` table + rate limit |
| FR-AUTH-04 | Reset tokens single-use, time-limited, invalidate existing sessions | `user_session.revoked_at` |

### Organisation (FR-ORG) — M2
FR-ORG-01 ≥ 3 branches, ≥ 5 agents · FR-ORG-02 each active agent in one active branch ·
FR-ORG-03 `ACTIVE`/`INACTIVE`/`SUSPENDED` · FR-ORG-04 changes record actor, time, reason,
before/after · FR-ORG-05 records referenced by the ledger are never physically deleted.

### Customers (FR-CUS) — M2
FR-CUS-01 unique customer number · FR-CUS-02 one current home branch and one current agent
· FR-CUS-03 assignment history preserved · FR-CUS-04 identity unique and masked from
unauthorised users · FR-CUS-05 ≥ 15 customers seeded.

### Accounts (FR-ACC) — M3
FR-ACC-01 unique account number, plan, **branch**, status, balance · FR-ACC-02 eligibility
enforced from date of birth and holder count · FR-ACC-03 balance never below the plan
minimum after a withdrawal · FR-ACC-04 joint withdrawals satisfy the mandate · FR-ACC-05
closure requires zero balance and no active FD.

### Deposits (FR-DEP) and withdrawals (FR-WD) — M4
FR-DEP-01 deposits to active accounts during permitted hours · FR-DEP-02 unique reference,
timestamp, amount, account, **agent and branch** · FR-DEP-03 ledger and balance update
atomically · FR-DEP-04 duplicate idempotency key creates no duplicate credit · FR-DEP-05
failure leaves no partial effect.
FR-WD-01 reject on inactive/frozen/closed · FR-WD-02 mandate and business-hour controls ·
FR-WD-03 reject overdraft or minimum-balance breach · FR-WD-04 debit, balance and audit
commit or roll back together · FR-WD-05 rejection stores a reason with **no ledger effect**.

### Transactions and reversal (FR-TXN) — M4
FR-TXN-01 types `DEPOSIT`, `WITHDRAWAL`, `INTEREST_CREDIT`, `REVERSAL` · FR-TXN-02 posted
rows not updated or deleted by normal roles · FR-TXN-03 every reversal references its
original and is reversible **once** · FR-TXN-04 history shows running balance ·
FR-TXN-05 customers see only their own accounts.

### Fixed deposits (FR-FD) and interest (FR-INT) — M5
FR-FD-01 FD requires an active savings account · FR-FD-02 **one active FD per account** ·
FR-FD-03 6-month/1-year/3-year at 13/14/15% · FR-FD-04 maturity date derived from term and
opening date · FR-FD-05 ≥ 10 FDs seeded.
FR-INT-01 monthly using a 30-day cycle · FR-INT-02 credited to the linked savings account
as a **separate transaction** · FR-INT-03 no duplicate distribution per FD per cycle ·
FR-INT-04 a failed distribution rolls back **without affecting completed ones** ·
FR-INT-05 store run counts, totals, exceptions and next payout dates.

### Reporting and audit (FR-REP, FR-AUD, REP-COM)
FR-REP-01 all five reports · FR-REP-02 date, branch, agent, account, plan, status filters ·
FR-REP-03 CSV totals match the screen · FR-AUD-01 security-sensitive and financial actions
produce protected audit events.
REP-COM-01 title, filters, timestamp, requesting user · REP-COM-02 branch-scoped users get
no unauthorised rows · REP-COM-03 detail rows plus labelled subtotals and grand totals ·
REP-COM-04 CSV uses the same filtered query · REP-COM-05 pagination or streaming ·
REP-COM-06 report access is audited.

---

## Nonfunctional requirements

| Group | Key requirements | Where addressed |
|---|---|---|
| **Performance** | Lookups < 2 s (95%); posting < 3 s; reports < 5 s; design for 100 concurrent users and 1M ledger rows | Indexes, `EXPLAIN ANALYZE`, `12_testing-and-acceptance.md` |
| **Safety** | Balance never below zero even under concurrency; plan minimums; interest never posts twice per cycle; no second FD; partial failure leaves balances unchanged | `CHECK`, `FOR UPDATE`, partial unique indexes, transactions |
| **Security** | HTTPS; **all SQL parameterized**; dynamic identifiers from allow-lists; least-privilege DB roles; server-side validation + CSRF; secrets masked in logs; **RLS on `customer`, `account`, `transaction`**; pooled connections | `15_security-and-rbac.md`, `lib/db`, `database/roles/` |
| **Reliability** | ACID via explicit transactions; row-level locking; idempotency controls; encrypted backups with restore tests; documented migration rollback; health checks | `03_architecture.md`, `14_git-workflow.md` |
| **Usability** | An agent can register a customer and post a transaction without database knowledge; clear labels, confirmations and field errors | `11_ui-rules.md` |
| **Maintainability** | SQL separated into migration, seed, procedure, view and test scripts; TypeScript separates UI, validation, authorization, services and data access | `database/`, AGENTS.md §6 |
| **Portability** | Runs in a documented local environment and an approved Linux deployment | `10_local-setup.md` |

## Database design requirements (SRS §6)

- Normalised to at least **3NF**; any denormalisation **documented** → `04_database-schema.md` §B.5–B.6
- PK, alternate unique keys, FK, `CHECK` and `NOT NULL` enforce integrity independently of the UI
- Exact `DECIMAL`/`NUMERIC` for currency and rates; **no floating point**
- Schema changes only through ordered, reviewable migrations
- DB-CON-01…06: documented PK on every table; `RESTRICT` on financial history; checks for
  positive amounts, valid dates, statuses, holder counts and non-negative balances; one
  reversal per transaction; one distribution per FD-cycle; created/updated timestamps and
  actor identifiers on controlled master records
- Routines and triggers per SRS §6.5 → `16_database-routines-views-indexes.md`
- Indexing per SRS §6.7, with `EXPLAIN` review of major reports

## Assumed operational rules (SRS §7.1)

| Assumption | Baseline | Where stored |
|---|---|---|
| Business hours | 08:30–16:30 on working days | `system_parameter` / `business_calendar` |
| Single withdrawal limit | LKR 100,000 unless a manager approves | `system_parameter` |
| Daily withdrawal limit | LKR 200,000 per account | `system_parameter` |
| Joint mandate | `ANY_ONE` or `ALL_HOLDERS` | `joint_mandate.mandate_type` |
| FD early closure | Not supported in Release 1.0 | — |
| Maturity treatment | Principal returns to the linked savings account | **OQ-06 — pending** |
| Rounding | Two decimal places, database decimal rounding | `fn_calculate_fd_interest` |

## Open items from the SRS

The SRS itself flags six TBDs. Their status here:

| SRS TBD | Question | Our position |
|---|---|---|
| TBD-01 | PostgreSQL or MySQL | **Settled: PostgreSQL 16** (ADR-0001) |
| TBD-02 | Customer login mandatory? | **OQ-05 — blocking**, drives ERD gap G-20 |
| TBD-03 | Exact withdrawal limits and approval threshold | **OQ-07** — defaults adopted, confirmable |
| TBD-04 | FD maturity: return principal or renew | **OQ-06** — return principal assumed |
| TBD-05 | Hosting provider and public production URL | **OQ-09** |
| TBD-06 | Required submission artifacts | **OQ-10** |

Full list with recommendations: `../.agent/open-questions.md`.
