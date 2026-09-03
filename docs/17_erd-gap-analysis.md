# 17 — ERD Gap Analysis

**Compares:** `Project 4` assignment brief · `Group 32 SRS v1.1` · `group_32_ERD2`
**Status:** Phase 0 analysis complete. **20 findings.** 4 are blocking.

---

## How to read this

Source precedence (from the project initialization contract):

1. Official Project 4 assignment brief
2. Explicit lecturer / course requirements
3. **Our current approved ERD**
4. MIMS SRS
5. Reasonable engineering assumptions

The ERD outranks the SRS. That matters: where the SRS describes something the ERD does
not model, **the ERD has not been changed**. The difference is recorded here and, where
it materially affects implementation, escalated for a human decision.

**Severity:** `HIGH` — blocks or corrupts a required workflow · `MEDIUM` — causes rework
or a weak demonstration · `LOW` — tidy-up.

**Approval needed:** `YES` means a member must not implement it until the team (and where
noted, the lecturer) decides. `NO` means it is pure integrity hardening that adds no new
structure and contradicts nothing — a member may implement it directly.

### Summary

| ID | Finding | Severity | Approval |
|---|---|---|---|
| G-01 | One FD *ever* per account vs one *active* FD | HIGH | **YES — blocking** |
| G-02 | No reversal support in the ledger | HIGH | YES |
| G-03 | No central interest-run tracking | HIGH | YES |
| G-04 | No idempotency key on transactions | HIGH | YES |
| G-05 | `reference_number` uniqueness contradicts the transfer assumption | HIGH | **YES — blocking** |
| G-06 | Accounts have no owning branch | HIGH | YES |
| G-07 | Transactions have no agent or branch attribution | HIGH | YES |
| G-08 | Joint operating mandate not modelled | HIGH | YES |
| G-09 | Single role per user vs `user_role` many-to-many | MEDIUM | YES |
| G-10 | Nothing prevents two active customer–agent assignments | MEDIUM | NO |
| G-11 | Product rates not effective-dated; FD does not snapshot its rate | HIGH | YES |
| G-12 | Savings-account interest cannot be recorded | HIGH | **YES — blocking** |
| G-13 | Plan eligibility ages not stored as data | MEDIUM | YES |
| G-14 | No running-balance evidence on the ledger | MEDIUM | YES |
| G-15 | No parameter store for business hours and withdrawal limits | MEDIUM | YES |
| G-16 | No session table for server-side invalidation | MEDIUM | YES |
| G-17 | No store for failed sign-in throttling | LOW | NO |
| G-18 | `current_balance` denormalisation undocumented and unconstrained | HIGH | NO |
| G-19 | Monetary and rate columns lack precision | MEDIUM | NO |
| G-20 | Every customer is forced to have a login | HIGH | **YES — blocking** |

---

## G-01 · One FD *ever* per account vs one *active* FD

**Current ERD design** — `fixed_deposit` declares `FK,UK account_id`. A `UNIQUE`
constraint on `account_id` permits **at most one `fixed_deposit` row per savings account
for the entire life of the account**.

**Project / SRS requirement** — The brief says "Customers can only have one FD per
Savings Account", which is ambiguous. The SRS is explicit and repeated: FR-FD-02 and
BR-12 say *"Only one **active** fixed deposit shall exist per savings account"*;
NFR-SAFE-04 says the system shall prevent creation of a second FD on the same account;
SRS §6.3 prescribes *"At most one active FD for a savings account; enforce with a
**partial unique index** or equivalent trigger/constraint."*

**Why they conflict** — The brief also requires FD maturity handling (§4.9: "Maturity
processing updates status and handles principal"), and the ERD carries a `status` column
on `fixed_deposit`. Under the ERD's hard `UNIQUE`, once a customer's 6-month FD matures
and closes, that savings account can **never** hold another FD. The FD lifecycle becomes
one-shot, `status` becomes decorative, and AC-07 (open an FD, run a cycle, see the credit)
can only ever be demonstrated once per account.

**Proposed change**

```sql
-- instead of: UNIQUE (account_id)
CREATE UNIQUE INDEX ux_fixed_deposit_one_active
    ON fixed_deposit (account_id)
    WHERE status = 'ACTIVE';
```

**Database impact** — Drops a table-level `UNIQUE` and replaces it with a partial unique
index (L10). Allows many historical FDs per account, at most one `ACTIVE`. `sp_open_fixed_deposit`
relies on the index for the race-condition guarantee, not on a prior `SELECT`.

**Approval needed — YES, blocking.** This changes an approved ERD key. It is the single
most consequential finding. Recommendation: adopt the partial unique index. Tracked as
**OQ-01**.

---

## G-02 · No reversal support in the ledger

**Current ERD design** — `transaction` has no link to a reversing entry, no `status`, and
no reversal table exists.

**Project / SRS requirement** — FR-TXN-03 (every reversal references its original and is
reversible only once), BR-16 (posted transactions are never deleted; corrections use
linked reversing entries), SRS §6.2 lists `transaction_reversal` as a core entity with a
one-to-one link, DB-CON-04 (the database shall prevent more than one reversal per
transaction), and `sp_reverse_transaction` in §6.5.

**Why they conflict** — Without a linkage table there is nowhere to record *which*
transaction a compensating entry corrects, who authorised it, or why. "Reversible only
once" cannot be enforced at all.

**Proposed change** — Add table `transaction_reversal`:
`reversal_id` PK · `original_transaction_id` FK **UNIQUE** · `reversal_transaction_id` FK
UNIQUE · `reason` · `reversed_by_user_id` FK · `reversed_at`. Add `status` to
`transaction` (`POSTED` / `REVERSED`).

**Database impact** — One new table, one new column. The `UNIQUE` on
`original_transaction_id` is what enforces DB-CON-04 — no procedural check required.

**Approval needed — YES** (adds a table and a column to the approved ERD).

---

## G-03 · No central interest-run tracking

**Current ERD design** — `interest_payout` records `fd_id`, `transaction_id`,
`payout_date`, `interest_amount`. There is no run/cycle entity.

**Project / SRS requirement** — The brief states "All interest calculations are processed
by the **central system**". FR-INT-03 (prevent duplicate distributions for the same FD and
cycle), FR-INT-05 (store run counts, totals, exceptions and next payout dates),
NFR-SAFE-03 (the job shall never post twice for the same 30-day cycle **even if manually
re-run or interrupted**), SRS §6.2 `interest_run / interest_distribution`, §6.5
`sp_run_interest_cycle`.

**Why they conflict** — `payout_date` is the date a payout happened, not the cycle it
belongs to. If the job is re-run on the same day, or interrupted and restarted, nothing
in the ERD distinguishes "this FD was already paid for cycle 3" from "this FD is being
paid again". A `UNIQUE(fd_id, payout_date)` is not equivalent: a retry the next day would
pass. This is directly AC-08 and a named critical test scenario.

**Proposed change** — Add table `interest_run`: `run_id` PK · `cycle_date` **UNIQUE** ·
`status` · `started_at` · `completed_at` · `fd_count` · `total_interest` ·
`exception_count` · `executed_by`. Add to `interest_payout`: `interest_run_id` FK,
`cycle_date`, and `UNIQUE (fd_id, cycle_date)`.

**Database impact** — One new table, two new columns, one new composite unique
constraint. The unique constraint *is* the idempotency guarantee (SRS §6.7 names this
index explicitly).

**Approval needed — YES.**

---

## G-04 · No idempotency key on transactions

**Current ERD design** — `transaction` has `reference_number` but no idempotency key.

**Project / SRS requirement** — FR-DEP-04 (a repeated request with the same idempotency
key shall not create a duplicate credit), NFR-REL-03, AC-06, glossary entry
"Idempotency key", and the critical test "Repeated deposit request → same key returns the
original result; balance credited once".

**Why they conflict** — `reference_number` is generated *by the system when the
transaction is created*, so a retried request produces a new reference and a second
credit. The system-generated reference cannot deduplicate a client retry; only a
client-supplied token can.

**Proposed change** — Add `idempotency_key varchar(80)` to `transaction`, plus

```sql
CREATE UNIQUE INDEX ux_transaction_idempotency
    ON transaction (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
```

The posting routine catches SQLSTATE `23505` on this index and returns the original row.

**Database impact** — One nullable column, one partial unique index. Nullable because
seeded and system-generated interest credits do not carry a client key.

**Approval needed — YES.**

---

## G-05 · `reference_number` uniqueness contradicts the transfer assumption

**Current ERD design** — `transaction.reference_number varchar(50)` is **not** marked
`UK`. ERD *Assumption 4* states: "For account to account transfers, two transaction
records are created with the **same reference_number**: one DEBIT entry for the source
account and one CREDIT entry for the destination account."

**Project / SRS requirement** — The brief: "All transactions must be logged with
timestamps, transaction type, and reference numbers." BR-10 and NFR-BR-07: every
transaction has a **unique** reference number. FR-DEP-02: "Each deposit shall have a
unique reference". SRS §6.7 names "Unique account_number and transaction_reference" as a
required index. DB-CON-01.

**Why they conflict** — Directly. Assumption 4 requires two rows to share a reference;
BR-10 requires references to be unique. Both cannot hold.

There is a second, larger problem: **account-to-account transfers are not in scope.** The
brief lists only deposits, withdrawals and interest credits. FR-TXN-01 enumerates exactly
four types — `DEPOSIT`, `WITHDRAWAL`, `INTEREST_CREDIT`, `REVERSAL` — with no `TRANSFER`.
SRS Appendix B.3 places interbank and wallet settlement out of scope, and no transfer
endpoint appears in Appendix C.1. ERD Assumption 4 appears to describe a feature the
approved requirements do not ask for.

**Proposed change (recommended)** — Drop account-to-account transfers from Release 1.0,
and make `reference_number` `UNIQUE NOT NULL`. If the team wants to keep transfers as an
extension, the alternative is to keep `reference_number` unique per row and add a
separate nullable `transfer_group_id` that links the DEBIT/CREDIT pair — which satisfies
both BR-10 and Assumption 4's intent.

**Database impact** — Either one `UNIQUE` constraint (recommended), or one `UNIQUE`
constraint plus one nullable grouping column and a fifth transaction type.

**Approval needed — YES, blocking.** Tracked as **OQ-08**.

---

## G-06 · Accounts have no owning branch

**Current ERD design** — `account` has `plan_id`, `opened_by_agent_id`, `account_number`,
`opened_date`, `status`, `current_balance`. No `branch_id`.

**Project / SRS requirement** — FR-ACC-01: "Every savings account shall have a unique
account number, plan, **branch**, status and current balance." REP-COM-02 (branch-scoped
users must not receive rows from unauthorised branches), NFR-SEC-07 (RLS by branch scope),
RPT-01/RPT-02 branch filters.

**Why they conflict** — Branch would have to be derived as
`account → opened_by_agent → agent.branch_id`. That breaks the moment an agent transfers
branch, which FR-ORG-04 explicitly supports with effective dates: every account that agent
ever opened would silently migrate to the new branch, changing historical report totals
and RLS visibility retroactively.

**Proposed change** — Add `branch_id uuid NOT NULL REFERENCES branch(branch_id)` to
`account`. This is a deliberate, documented denormalisation: the owning branch is a fact
fixed at account opening, not a derivable one.

**Database impact** — One `NOT NULL` FK, one index `(branch_id, status)`, and it becomes
the RLS anchor column. Record in the denormalisation register in `04_database-schema.md`.

**Approval needed — YES.**

---

## G-07 · Transactions have no agent or branch attribution

**Current ERD design** — `transaction` has `initiated_by_user_id` and `channel_id` only.

**Project / SRS requirement** — **RPT-01 is "Agent-wise total number and value of
transactions"** — a required report from the brief itself. FR-DEP-02: "Each deposit shall
have a unique reference, timestamp, amount, account, **agent and branch**." SRS §6.7 names
indexes on `transaction (agent_id, posted_at)` and `(branch_id, posted_at)`.

**Why they conflict** — Agent could be derived via `initiated_by_user_id → agent` (the ERD
makes `agent.agent_id` a `PK,FK` to `user`), but only when the initiator is an agent.
`INTEREST_CREDIT` rows are posted by the central system with no agent, and a branch
manager or admin is not an agent. Branch has the same historical-drift problem as G-06.
RPT-01 cannot be built reliably on a derivation.

**Proposed change** — Add to `transaction`: `agent_id uuid NULL REFERENCES agent(agent_id)`
and `branch_id uuid NULL REFERENCES branch(branch_id)`, both captured at posting time.
Nullable because system-posted interest credits have neither.

**Database impact** — Two nullable FKs and the two reporting indexes named in SRS §6.7.

**Approval needed — YES.**

---

## G-08 · Joint operating mandate not modelled

**Current ERD design** — `account_holder` links customers to accounts with
`joined_date` and `UNIQUE(account_id, customer_id)`. There is no mandate.

**Project / SRS requirement** — FR-ACC-04 ("Joint withdrawals shall satisfy the configured
mandate before posting"), BR-17, §6.2 core entity `joint_mandate` ("joint operating rule,
required signatories and effective dates"), §6.5 trigger `trg_validate_joint_mandate`,
§4.4 ("Joint accounts require two to four adult holders and a stored operating mandate"),
§7.1 (`ANY_ONE` or `ALL_HOLDERS`), and the critical test "Joint withdrawal without mandate
→ rejected and audited without ledger effect".

**Why they conflict** — The mandate is required by four separate requirements and has
nowhere to live. There is also no constraint enforcing the 2–4 adult holder count.

**Proposed change** — Add table `joint_mandate`: `mandate_id` PK · `account_id` FK
**UNIQUE** · `mandate_type` CHECK IN (`ANY_ONE`,`ALL_HOLDERS`) · `required_signatories int`
· `effective_from` · `effective_to` · audit columns. Add `holder_type` to `account_holder`
(`PRIMARY` / `JOINT`) and enforce the 2–4 count in `sp_open_savings_account` plus a
statement-level trigger.

**Database impact** — One new table, one new column, one trigger. Holder-count rules
cannot be a row-level `CHECK` (they span rows), which makes this a good demonstration of
statement-level triggers with transition tables (L08).

**Approval needed — YES.**

---

## G-09 · Single role per user vs `user_role` many-to-many

**Current ERD design** — `user.role_id` is a single FK. One role per user.

**Project / SRS requirement** — SRS §6.2 lists `app_user / role / user_role`, implying a
many-to-many. SRS §2.4 defines seven user classes.

**Why they conflict** — Mild. Seven user classes are representable as seven rows in `role`
with one role each; the SRS never states a user *needs* two roles simultaneously.

**Proposed change (recommended: keep the ERD)** — Retain `user.role_id`. It satisfies
every stated requirement, the ERD outranks the SRS, and it keeps RBAC checks simple. If
the team later wants combined roles, add `user_role` then. Document the decision so a
reviewer sees it was considered rather than missed.

**Database impact** — None if the ERD is kept.

**Approval needed — YES** (a recorded decision, not a change). Recommend: keep ERD.

---

## G-10 · Nothing prevents two active customer–agent assignments

**Current ERD design** — `customer_agent` has `assigned_date`, `end_date`, `is_active`.
No constraint limits how many rows may be active for one customer.

**Project / SRS requirement** — FR-CUS-02: "Each customer shall have **one current** home
branch and **one current** assigned agent." FR-CUS-03: assignment history is preserved.

**Why they conflict** — The history model is right, but "exactly one current" is
unenforced. A double insert silently produces two active agents and breaks RPT-01 and
RPT-05 attribution.

**Proposed change**

```sql
CREATE UNIQUE INDEX ux_customer_agent_one_active
    ON customer_agent (customer_id)
    WHERE is_active;
```

**Database impact** — One partial unique index. No structural change; the ERD already
models exactly this intent.

**Approval needed — NO.** Pure integrity hardening of an existing ERD design.

---

## G-11 · Product rates not effective-dated; FD does not snapshot its rate

**Current ERD design** — `savings_plan.interest_rate` and `fd_plan.interest_rate` are
single current values. `fixed_deposit` stores `fd_plan_id` but not the rate that applied
at opening.

**Project / SRS requirement** — §4.5: "Rates and minimum balances shall be stored as
controlled product data **with effective dates**. Historical accounts and deposits retain
the rate/product version that applied when they were created." BR-19. FR-FD-04 (the
product rate, term, start date, maturity date and first payout date are **fixed at
opening**).

**Why they conflict** — This is a financial-correctness bug, not a modelling preference.
`fn_calculate_fd_interest` computes `principal × annual_rate × 30 / 365`. If it reads the
rate through `fd_plan_id` and a rate is ever edited, **every past and future payout on
every existing FD silently recalculates at the new rate** — and RPT-04 stops reconciling
against already-posted `INTEREST_CREDIT` ledger rows.

**Proposed change** — Minimum: add `interest_rate_at_opening interest_rate NOT NULL` to
`fixed_deposit`, and have the interest function read that column, never the plan. Fuller:
add `effective_from` / `effective_to` to `savings_plan` and `fd_plan` and select the
version applicable at the transaction date.

**Database impact** — One `NOT NULL` snapshot column (recommended, low risk) plus
optional effective-dating columns on both product tables.

**Approval needed — YES.** Strong recommendation to adopt at least the snapshot column.

---

## G-12 · Savings-account interest cannot be recorded

**Current ERD design** — `interest_payout.fd_id` is a `NOT NULL` FK to `fixed_deposit`.
Every interest payout must belong to a fixed deposit.

**Project / SRS requirement** — The brief assigns an interest rate to **every savings
plan** (Children 12%, Teen 11%, Adult 10%, Senior 13%, Joint 7%) and BR-03…BR-07 repeat
them. **RPT-04 is "Monthly interest distribution summary by account type"** — and
"account type" most naturally means the savings plan.

**Why they conflict** — The brief and SRS §4.10 only ever describe *FD* interest being
calculated and credited. Nothing states when or whether savings-plan interest is paid — yet
five savings interest rates are specified, and a report groups distributions by account
type. Two readings are possible:

- **(a) Savings rates are descriptive product data only.** Only FDs generate interest.
  RPT-04's "account type" then means the FD product (6-month / 1-year / 3-year). The ERD is
  correct as drawn and no change is needed.
- **(b) Savings accounts also accrue interest on a 30-day cycle.** Then `interest_payout`
  must be able to reference a savings account with no FD, and the interest run must process
  both. This roughly doubles the Phase 4 workload.

**Proposed change if (b) is chosen** — Make `fd_id` nullable, add
`account_id uuid NOT NULL`, add `source_type CHECK IN ('FIXED_DEPOSIT','SAVINGS')`, and a
`CHECK (source_type = 'SAVINGS' OR fd_id IS NOT NULL)`.

**Database impact** — (a) none. (b) one nullable-ised FK, two new columns, one table-level
check, and a materially larger `sp_run_interest_cycle`.

**Approval needed — YES, blocking.** This changes the meaning of a required report and the
size of Phase 4. **This is a good question to put to the lecturer.** Recommendation
pending: interpretation (a), since §4.10 is unambiguously FD-only. Tracked as **OQ-04**.

---

## G-13 · Plan eligibility ages not stored as data

**Current ERD design** — `savings_plan` has `plan_name`, `interest_rate`, `min_balance`,
`description`, `status`. No age boundaries, no holder-count rules.

**Project / SRS requirement** — The brief and SRS §4.5 define Children (< 13), Teen
(13–17), Adult (18–59), Senior (60+), Joint (2–4 adult holders). FR-ACC-02: "Children,
Teen, Adult, Senior and Joint eligibility rules shall be enforced **from date of birth and
holder count**."

**Why they conflict** — With ages absent from the schema, eligibility must be hardcoded as
`IF plan_name = 'Children' AND age < 13` inside a routine or in TypeScript. That is
business data living in code, it breaks the moment a plan is renamed, and it is exactly the
kind of thing a Database Systems reviewer marks down.

**Proposed change** — Add to `savings_plan`: `min_age_years int NULL`, `max_age_years int
NULL`, `min_holders int NOT NULL DEFAULT 1`, `max_holders int NOT NULL DEFAULT 1`,
`requires_all_adult boolean NOT NULL DEFAULT false`, plus
`CHECK (max_age_years IS NULL OR min_age_years IS NULL OR max_age_years >= min_age_years)`.
Eligibility then becomes a data-driven join.

**Database impact** — Five columns and one check on a small reference table.

**Approval needed — YES.**

---

## G-14 · No running-balance evidence on the ledger

**Current ERD design** — `transaction` has `amount` but no post-transaction balance.

**Project / SRS requirement** — FR-TXN-04: "Transaction history shall show **running
balance or equivalent balance evidence**." RPT-02 requires opening and closing balance.

**Why they conflict** — A running balance can be computed with a window function
(`SUM(signed_amount) OVER (PARTITION BY account_id ORDER BY posted_at, transaction_id)`) —
which is genuinely good L13 material. But once reversals exist, ordering and signing become
subtle, and RPT-02's opening balance for a date range requires scanning all prior rows.

**Proposed change** — Add `balance_after money_amount NOT NULL` to `transaction`, written
by the posting routine inside the same locked transaction. Keep the window-function view as
well, and add a reconciliation check asserting the two agree — which turns a denormalisation
into a demonstrable integrity control.

**Database impact** — One `NOT NULL` column; a documented denormalisation entry; a
reconciliation query for Phase 5.

**Approval needed — YES.**

---

## G-15 · No parameter store for business hours and withdrawal limits

**Current ERD design** — Nothing.

**Project / SRS requirement** — BR-08 (transactions accepted only during **configured**
business hours), SRS §7.1 (08:30–16:30; single withdrawal limit LKR 100,000; daily limit
LKR 200,000 per account), §6.2 mentions "business-calendar/parameter tables", FR-WD-02.

**Why they conflict** — "Configured" means the value is data. Hardcoding `08:30` in
TypeScript puts a business rule in the frontend/backend only, which AGENTS.md §5 forbids.

**Proposed change** — Add `system_parameter` (`param_key` PK, `param_value`, `data_type`,
`description`, `updated_by`, `updated_at`) and `business_calendar` (`calendar_date` PK,
`is_business_day`, `open_time`, `close_time`, `note`).

**Database impact** — Two small reference tables, read by the posting routines.

**Approval needed — YES.**

---

## G-16 · No session table for server-side invalidation

**Current ERD design** — `user` has `last_login` only.

**Project / SRS requirement** — FR-AUTH-01 (create a secure session), FR-AUTH-04 (reset
tokens invalidate **existing sessions**), §4.1 ("inactivity timeout and **server-side
invalidation**").

**Why they conflict** — Server-side invalidation is impossible with a stateless signed
cookie. There must be a session record the server can delete.

**Proposed change** — Add `user_session`: `session_id` PK · `user_id` FK · `token_hash`
UNIQUE · `issued_at` · `last_seen_at` · `expires_at` · `revoked_at` · `ip_address` ·
`user_agent`. Store only the **hash** of the token.

**Database impact** — One table, one index on `(user_id, expires_at)`.

**Approval needed — YES.**

---

## G-17 · No store for failed sign-in throttling

**Current ERD design** — Nothing.

**Project / SRS requirement** — FR-AUTH-03 (temporarily lock or throttle repeated failed
sign-in attempts), §4.1 (failed sign-ins are rate-limited and audited **without revealing
whether a username exists**).

**Proposed change** — Add `login_attempt`: `attempt_id` PK · `username_attempted` ·
`ip_address` · `succeeded boolean` · `attempted_at`, indexed on
`(username_attempted, attempted_at DESC)`.

**Database impact** — One append-only table and one index.

**Approval needed — NO.** Adds a security control required by a functional requirement,
contradicts nothing in the ERD.

---

## G-18 · `current_balance` denormalisation undocumented and unconstrained

**Current ERD design** — `account.current_balance decimal`, with no constraint. The ledger
in `transaction` is the source of truth, so this column duplicates derivable data.

**Project / SRS requirement** — NFR-SAFE-01 ("shall **never** allow a balance to fall below
zero … including concurrent access"), DB-CON-03, DB-CON-05, SRS §6.1 (any intentional
denormalisation **must be documented**).

**Why they conflict** — The column is legitimate and necessary — recomputing a balance from
the ledger on every withdrawal does not scale and makes `FOR UPDATE` locking awkward — but
as drawn it has no `NOT NULL`, no default and no non-negative check, so the headline safety
requirement is unenforced at the database level.

**Proposed change**

```sql
current_balance money_amount NOT NULL DEFAULT 0
    CONSTRAINT ck_account_no_overdraft CHECK (current_balance >= 0)
```

Plus a formal entry in the denormalisation register and a Phase 5 reconciliation view
asserting `current_balance = SUM(signed ledger amounts)` for every account.

**Database impact** — One `NOT NULL`, one default, one `CHECK`. The `CHECK` is the last
line of defence behind row locking: even a bug in the routine cannot produce an overdraft.

**Approval needed — NO.** Hardening only.

---

## G-19 · Monetary and rate columns lack precision

**Current ERD design** — `account.current_balance`, `transaction.amount`,
`fixed_deposit.principal_amount`, `savings_plan.interest_rate`, `savings_plan.min_balance`
and `fd_plan.interest_rate` are all plain `decimal`. Only `interest_payout.interest_amount`
specifies `decimal(15,2)`.

**Project / SRS requirement** — SRS §6.1: "Exact DECIMAL/NUMERIC data types shall be used
for currency and rates; floating-point types shall not be used." §7.1 rounding rule.

**Why they conflict** — Unqualified `numeric` in PostgreSQL is arbitrary-precision, so
values are exact — but scale is unconstrained, meaning `100.005` can be stored and the
"round to two decimal places" rule silently drifts across the system.

**Proposed change** — Apply the shared domains already created in migration `0000`:
`money_amount` = `numeric(15,2)`, `positive_money` = `numeric(15,2) CHECK (VALUE > 0)`,
`interest_rate` = `numeric(6,4)` as a fraction (10% → `0.1000`).

**Database impact** — Type declarations only. Storing rates as fractions keeps
`principal * rate * 30 / 365` a single exact expression with no divide-by-100.

**Approval needed — NO.** Implements an explicit SRS requirement.

---

## G-20 · Every customer is forced to have a login

**Current ERD design** — `customer.customer_id` is `PK,FK` — a subtype of `user`. Every
`customer` row therefore **requires** a corresponding `user` row with a `username`,
`password_hash` and `role_id`. (`agent` is modelled the same way, which is fine — agents are
staff and always have logins.)

**Project / SRS requirement** — SRS **TBD-02**: "Whether a customer login must be
implemented or staff-only UI is sufficient." §2.4 hedges: customers view their data "**where
customer access is implemented**". Appendix B.1: "Customers normally interact through
authorized banking agents; optional customer self-service is limited to inquiry functions."
Meanwhile the brief says customers deposit and withdraw "through an online system managed
by regional service agents" — the agent operates the system.

**Why they conflict** — If customer self-service is not implemented, the ERD still forces a
`user` row per customer. Fifteen seeded customers become fifteen credential-bearing accounts
that no one signs into — dead authentication surface, and NFR-PRIV-01 (collect only the
minimum necessary data) argues against it. `user.username` and `password_hash` are
`NOT NULL`, so placeholder rows would need fake usernames and unusable hashes.

**Proposed change** — Give `customer` its own independent surrogate key and an **optional**
link to a login:

```sql
customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id     uuid NULL UNIQUE REFERENCES app_user(user_id)
```

A customer with self-service gets a linked user; one without does not. `agent` keeps the
`PK,FK` subtype pattern.

**Database impact** — Changes the identity of a central entity, so it must be settled
**before Phase 2 begins**. Also removes ERD Assumption 2's side effect ("a customer is
recorded only if an account is open") as a schema-level requirement.

**Approval needed — YES, blocking.** Depends on the answer to TBD-02. Tracked as **OQ-05**.

---

## Resulting table count

| | Tables |
|---|---|
| Current ERD | **16** |
| Proposed additions (G-02, G-03, G-08, G-15 ×2, G-16, G-17) | **+7** |
| Total if all proposals are approved | **23** |

New tables: `transaction_reversal`, `interest_run`, `joint_mandate`, `system_parameter`,
`business_calendar`, `user_session`, `login_attempt`.

No ERD table is removed. Every proposal is additive except G-01 (constraint form), G-05
(constraint addition), and G-20 (key change).

---

## What happens next

1. The team reviews this document and decides **OQ-01, OQ-04, OQ-05, OQ-08** (see
   `.agent/open-questions.md`). OQ-04 and OQ-08 are good lecturer questions.
2. Approved changes are folded into `docs/04_database-schema.md` under **PROPOSED**, and
   an ADR is written in `.agent/decisions/`.
3. Only then do Phase 2 tasks touching `account`, `customer`, `fixed_deposit` or
   `transaction` move to `READY`.

Findings marked **Approval needed: NO** (G-10, G-17, G-18, G-19) may be implemented as part
of their owning member's Phase 1/2 task without further discussion.
