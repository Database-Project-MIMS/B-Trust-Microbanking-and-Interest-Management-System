# 0001. Savings plan schema with eligibility data

**Date**: 2026-09-19
**Status**: Accepted

## Summary

This decides the exact shape of the `savings_plan` table, the first table Member 3 owns. It stores B-Trust's five savings products (Children, Teen, Adult, Senior, Joint) plus their eligibility rules (age range, holder count, whether a holder must be an adult) as data in columns, not as logic hardcoded in application code. This lets the eligibility check (a later task) read the rules instead of matching on plan names.

## Context

The five savings plans (BR-03 through BR-07) each carry a fixed interest rate and minimum balance, and each has eligibility rules: an age range, how many account holders it allows, and whether those holders must be adults. The approved ERD (`docs/04_database-schema.md` Part A) only has `plan_id`, `plan_name`, `interest_rate`, `min_balance`, `description`, `status` — no eligibility columns. Gap **G-13** in the ERD gap analysis already identifies this and proposes the fix (Part B), and the task tracker (`P01-M03-T01`) and the personal task breakdown (`3_Nisith/01_P1-T01_savings-plan-schema.md`) both assign it to Member 3.

The two sources broadly agree on the table shape but differ on a few specifics: whether `interest_rate`/`min_balance` use the shared domains defined in migration `0000` or raw `numeric` types (the already-merged `fd_plan` migration uses raw types), what `requires_all_adult` means (a joint-only flag versus a general "this plan's holders must be adults" flag), and whether effective-dating columns (`effective_from`/`effective_to`) belong in this migration or a later one. These were resolved directly with the engineer (see Decision).

If the eligibility rules are not captured as data, the eligibility function (`P01-M03-T02`) would have to branch on `plan_name` string literals, which the task tracker and business rules doc both call out as the wrong approach and the single most marks-relevant modelling decision in this slice.

## Requirements

**User stories**:
- As the account-opening flow, I want each plan's age and holder-count rules readable as data, so eligibility can be checked with a join instead of hardcoded plan-name branches.
- As a database reviewer, I want the five BR-03 to BR-07 products to exist with exactly the specified rates and minimums, so the seeded data is demonstrably correct.

**Acceptance criteria**:
- **AC-1**: After the migration runs, exactly five `savings_plan` rows exist: Children, Teen, Adult, Senior, Joint, each with the interest rate and minimum balance from BR-03 to BR-07 (rate stored as a fraction, e.g. `0.1200`, never `12`).
- **AC-2**: Each plan's age range and holder-count columns are populated per the agreed table (see Feature design), readable without inspecting any application code.
- **AC-3**: A duplicate `plan_name` insert is rejected (unique violation, SQLSTATE `23505`).
- **AC-4**: A row where `max_age_years < min_age_years` is rejected by a `CHECK` constraint.
- **AC-5**: A row where `max_holders < min_holders` is rejected by a `CHECK` constraint.
- **AC-6**: A `NULL plan_name` or an invalid `status` value is rejected.
- **AC-7**: The migration is re-runnable against a clean database (`npm run db:rebuild` succeeds) and self-registers in `schema_migration` through the existing runner, with no manual insert into that table.

## Options considered

### Option 1: Eligibility columns on `savings_plan` (G-13, as proposed)

Add `min_age_years`, `max_age_years`, `min_holders`, `max_holders`, `requires_all_adult` directly to `savings_plan`, alongside the existing rate/minimum columns.

**Pros**:
- One row per plan carries its complete rule set; a join from `account` needs no second table.
- Matches the already-approved G-13 gap analysis entry and both task breakdowns.

**Cons**:
- Couples eligibility rules to the pricing table; a future plan with more complex eligibility (e.g. a rule needing OR logic) would strain a flat column set.

### Option 2: Separate `plan_eligibility_rule` table

Model each eligibility rule as its own row (plan_id, rule_type, rule_value), allowing arbitrary rule composition.

**Pros**:
- More extensible if eligibility logic grows more complex than age/holder bounds.

**Cons**:
- Not in the approved ERD or gap analysis; would require a new open question and ADR before implementation (AGENTS.md forbids inventing schema).
- Over-engineered for exactly five plans with a fixed, small rule shape; adds a join for no present benefit.

## Decision

**Chosen option**: Option 1: Eligibility columns on `savings_plan` (G-13, as proposed)

Add the five G-13 eligibility columns directly to `savings_plan`, using the shared `interest_rate` and `money_amount` domains from migration `0000` for the rate and minimum-balance columns, and deferring `effective_from`/`effective_to` to a later migration.

## Rationale

Option 1 is what G-13 already proposes and what both the task tracker and the personal task breakdown converge on; introducing a separate rule table would be new, unapproved schema for a rule shape (an age range and a holder-count range) that is fixed and small across exactly five seeded rows — the kind of premature generality AGENTS.md's database-first principle warns against ("do not invent schema"). Using the shared domains (rather than copying `fd_plan`'s raw `numeric` columns) follows AGENTS.md §8 as written; `fd_plan`'s deviation is already merged and not this task's to fix, but a new migration should not repeat it. Effective-dating is left out because the personal task breakdown (which the engineer confirmed as authoritative for their actual work) omits it for this task, and BR-19's effective-dating scope belongs to how rate changes are handled later (a savings-plan analogue of `fd_plan`'s SCD2 pattern would need its own decision), not folded into the first schema migration.

## Feature design

**Data model sketch**:

`savings_plan` (all columns, this migration creates the table from scratch):

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `plan_id` | uuid | no | PK, `gen_random_uuid()` |
| `plan_name` | varchar(100) | no | UNIQUE |
| `interest_rate` | `interest_rate` domain (numeric(6,4), 0 to 1) | no | fraction, e.g. `0.1200` |
| `min_balance` | `money_amount` domain (numeric(15,2)) | no | default `0`; table `CHECK (min_balance >= 0)` since the domain itself allows negative |
| `description` | varchar(255) | yes | |
| `status` | varchar(20) | no | default `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `min_age_years` | int | yes | NULL = no lower bound |
| `max_age_years` | int | yes | NULL = no upper bound |
| `min_holders` | int | no | default `1` |
| `max_holders` | int | no | default `1` |
| `requires_all_adult` | boolean | no | default `false`; true means every holder of this plan must be an adult (18+), independent of the plan's own age band |
| `created_at` | timestamptz | no | default `now()` |
| `updated_at` | timestamptz | yes | maintained by the shared `set_updated_at()` trigger from migration `0000` |

Table-level checks:
- `chk_savings_plan_age_range`: `max_age_years IS NULL OR min_age_years IS NULL OR max_age_years >= min_age_years`
- `chk_savings_plan_holder_range`: `max_holders >= min_holders`
- `chk_savings_plan_min_balance_nonneg`: `min_balance >= 0`

No foreign keys (this is a root product table); `account.plan_id` will reference it in Phase 2 (`ON DELETE RESTRICT`, per AGENTS.md §8).

**State transitions**: none. `status` toggles `ACTIVE`/`INACTIVE` administratively (a later plan-admin task), not a lifecycle this migration models.

**API surface**: none. This task is database-only (`P01-M03-T01`); the API (`GET /api/plans`, `PATCH /api/plans/{id}`) is `P01-M03-T03`, a separate task and a separate spec if needed.

**Value sourcing**: not applicable, no action/endpoint in this task's scope. The seed values themselves are the sourced data:

| Plan | interest_rate | min_balance | min_age_years | max_age_years | min_holders | max_holders | requires_all_adult |
|---|---|---|---|---|---|---|---|
| Children | 0.1200 | 0.00 | NULL | 12 | 1 | 1 | false |
| Teen | 0.1100 | 500.00 | 13 | 17 | 1 | 1 | false |
| Adult | 0.1000 | 1000.00 | 18 | 59 | 1 | 1 | true |
| Senior | 0.1300 | 1000.00 | 60 | NULL | 1 | 1 | true |
| Joint | 0.0700 | 5000.00 | NULL | NULL | 2 | 4 | true |

Each value's source is BR-03 through BR-07 (rate, min_balance) and the engineer's confirmed age/holder bounds (this spec's design conversation).

**Key invariants**:
- Rates and minimums exactly match BR-03 to BR-07 (a seed-correctness test, not just a constraint).
- `plan_name` is unique; no two plans share eligibility ambiguity.
- Age range and holder range are each internally consistent (`max >= min` where both are set).

**Security model**: not applicable to this task. `savings_plan` is read by any authenticated role (per `docs/05_api-and-pages.md`, `GET /api/plans`) and written only by `ADMIN`/`CENTRAL_OPS` through `PATCH /api/plans/{id}` — enforced in `P01-M03-T03`, not this migration.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: migration runs on a clean database, exactly five plans exist with correct rates/minimums/eligibility columns, verifies **AC-1**, **AC-2**.
- Failure case: insert a duplicate `plan_name` — rejected with `23505`, verifies **AC-3**. Insert `max_age_years < min_age_years` — rejected by `chk_savings_plan_age_range`, verifies **AC-4**. Insert `max_holders < min_holders` — rejected by `chk_savings_plan_holder_range`, verifies **AC-5**.
- Data integrity: `NULL plan_name` and an invalid `status` value are both rejected, verifies **AC-6**. `npm run db:rebuild` succeeds from empty and the migration self-registers via the existing runner (no manual `schema_migration` insert), verifies **AC-7**.

## Build plan

1. Write `database/migrations/0140_p01_m03_savings_plan.sql`: `CREATE TABLE savings_plan` with the columns and checks above, the `set_updated_at` trigger binding, and the five seed rows. Do not manually insert into `schema_migration` — the runner (`scripts/migrate.mjs`) records `(filename, checksum)` itself after applying the file. Satisfies **AC-1**, **AC-2**, **AC-7**.
2. Write `tests/db/savings-plan-constraints.test.mjs` covering: exact seed values (AC-1, AC-2), duplicate `plan_name` (AC-3), age-range check violation (AC-4), holder-range check violation (AC-5), NULL `plan_name` and invalid `status` (AC-6). Satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**.
3. Run `npm run db:rebuild && npm run db:verify && npm test` and confirm all pass. Satisfies **AC-7**.
4. Update `docs/04_database-schema.md`: move the `savings_plan` Part B eligibility columns into Part A as implemented, note the migration number.
5. Update `docs/17_erd-gap-analysis.md`: mark G-13 resolved, linked to migration `0140`.
6. Update `docs/09_task-tracker.md`: set `P01-M03-T01` to `DONE` with the branch/PR reference.

## Consequences

**Positive**:
- Eligibility rules become data `fn_check_plan_eligibility` (`P01-M03-T02`) can join against, with no hardcoded plan-name branching.
- Consistent with the shared domains (`interest_rate`, `money_amount`) as AGENTS.md §8 specifies, rather than repeating `fd_plan`'s raw-numeric deviation.

**Negative / tradeoffs**:
- `requires_all_adult` is set per-plan even for individual plans (Adult, Senior) where the account only ever has one holder; the flag's meaning ("this plan's holder(s) must be an adult") is slightly redundant with `min_age_years >= 18` for those two plans, but keeps the eligibility function uniform across all five plans instead of special-casing Joint.
- No `effective_from`/`effective_to` in this migration means a future savings-plan rate change has no SCD2 trail yet; if that need arrives before a dedicated task addresses it, a new migration adds the columns (never editing this one, per AGENTS.md §8).

**Neutral**:
- `status` uses an inline `CHECK (status IN ('ACTIVE','INACTIVE'))` rather than the broader `record_status` domain (which also allows `SUSPENDED`), matching the personal task breakdown's narrower scope for this table.

## Follow-up

- [ ] If a `savings_plan` rate ever needs effective-dating (BR-19 analogue to `fd_plan`), that is a new migration and a new spec, not a retrofit of `0140`.
- [ ] `P01-M03-T02` (`fn_check_plan_eligibility`) must read `requires_all_adult` as "every holder of this plan must be 18+", not scope it to Joint only — this spec fixes that semantic so the function isn't guessing.
