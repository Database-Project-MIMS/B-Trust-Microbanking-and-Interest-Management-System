# 🔵 Phase 1 — Task 01: Savings Plan Schema
**Task ID:** `P01-M03-T01` · **Branch:** `feat/p01-m03-savings-plan-schema`
**Migration:** `0140_p01_m03_savings_plan.sql` · **Status:** READY
**Depends on:** migration `0000`; **G-13** approved
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

Create the `savings_plan` table with **eligibility data as columns**, not as logic
buried in a routine. This is the schema half of the single most marks-relevant decision
in your slice: age boundaries and holder-count rules must be readable as data
(`min_age_years`, `max_age_years`, `min_holders`, `max_holders`,
`requires_all_adult`), so that `fn_check_plan_eligibility` (T02) can be a data-driven
join instead of `IF plan_name = 'Children'`.

---

## Table to Create

### `savings_plan`

| Column | Type | Constraints |
|---|---|---|
| `plan_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `plan_name` | `varchar(100)` | **UNIQUE, NOT NULL** — Children / Teen / Adult / Senior / Joint |
| `interest_rate` | `interest_rate` domain (or `numeric(6,4)`) | NOT NULL — fraction, e.g. `0.1200` |
| `min_balance` | `money_amount` domain (or `numeric(15,2)`) | NOT NULL DEFAULT `0` |
| `description` | `varchar(255)` | |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `min_age_years` | `int` | NULL — no lower bound if NULL |
| `max_age_years` | `int` | NULL — no upper bound if NULL |
| `min_holders` | `int` | NOT NULL DEFAULT `1` |
| `max_holders` | `int` | NOT NULL DEFAULT `1` |
| `requires_all_adult` | `boolean` | NOT NULL DEFAULT `false` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `account`.
- **Check:** `max_age_years IS NULL OR min_age_years IS NULL OR max_age_years >=
  min_age_years`
- **Check:** `max_holders >= min_holders`
- **Seed exactly 5 plans per BR-03…BR-07:**

| Plan | Rate | Min balance | Age range | Holders | All adult |
|---|---|---|---|---|---|
| Children | 12% | 0 | < 13 (`max_age_years = 12`) | 1 | false |
| Teen | 11% | 500 | 13–17 | 1 | false |
| Adult | 10% | 1,000 | 18–59 | 1 | true |
| Senior | 13% | 1,000 | 60+ (`min_age_years = 60`) | 1 | true |
| Joint | 7% | 5,000 | none (per-holder rule via `requires_all_adult`) | 2–4 | true |

---

## How to Implement

### Step 1 — Write the Migration
Create file: `database/migrations/0140_p01_m03_savings_plan.sql`

```sql
-- Migration 0140: Savings plan schema with eligibility data (M3, G-13)
-- Table: savings_plan — five products (BR-03..BR-07), age/holder rules as data

BEGIN;

CREATE TABLE savings_plan (
    plan_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name           varchar(100) NOT NULL UNIQUE,
    interest_rate       numeric(6,4) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 1),
    min_balance         numeric(15,2) NOT NULL DEFAULT 0 CHECK (min_balance >= 0),
    description         varchar(255),
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    min_age_years       int,
    max_age_years       int,
    min_holders         int NOT NULL DEFAULT 1,
    max_holders         int NOT NULL DEFAULT 1,
    requires_all_adult  boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz,
    CONSTRAINT chk_savings_plan_age_range
        CHECK (max_age_years IS NULL OR min_age_years IS NULL OR max_age_years >= min_age_years),
    CONSTRAINT chk_savings_plan_holder_range
        CHECK (max_holders >= min_holders)
);

-- Seed the five BR-03..BR-07 products
INSERT INTO savings_plan
    (plan_name, interest_rate, min_balance, description,
     min_age_years, max_age_years, min_holders, max_holders, requires_all_adult)
VALUES
    ('Children', 0.1200,    0.00, 'Children savings — under 13',      NULL, 12,  1, 1, false),
    ('Teen',     0.1100,  500.00, 'Teen savings — 13 to 17',            13,  17,  1, 1, false),
    ('Adult',    0.1000, 1000.00, 'Adult savings — 18 to 59',           18,  59,  1, 1, true),
    ('Senior',   0.1300, 1000.00, 'Senior savings — 60 and above',      60, NULL, 1, 1, true),
    ('Joint',    0.0700, 5000.00, 'Joint savings — 2 to 4 adult holders', NULL, NULL, 2, 4, true);

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (140, '0140_p01_m03_savings_plan');

COMMIT;
```

### Step 2 — Write SQL Tests
Create file: `tests/db/savings-plan-constraints.test.mjs`

Test these scenarios:
1. ✅ Exactly 5 plans exist after migration with the correct rates, minimums and age/
   holder bounds
2. ✅ Duplicate `plan_name` is rejected (`23505`)
3. ✅ `max_age_years < min_age_years` is rejected by the CHECK constraint
4. ✅ `max_holders < min_holders` is rejected
5. ✅ `interest_rate` stored as a fraction (12% = `0.1200`, not `12`)
6. ✅ `min_balance` matches BR-03…BR-07 exactly for each plan
7. ✅ NULL `plan_name` is rejected
8. ✅ Invalid `status` values are rejected

### Step 3 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` — `savings_plan` Part A + Part B eligibility
  columns (mark G-13 implemented)
- Update `docs/17_erd-gap-analysis.md` — mark G-13 resolved, link the migration
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] Exactly the five BR-03…BR-07 products exist with correct rates and minimums
- [ ] Rate is stored as a fraction, not a percentage
- [ ] Age and holder-count columns exist and are populated per plan (G-13)
- [ ] Age-range and holder-range CHECK constraints reject inconsistent bounds
- [ ] `npm run db:rebuild` succeeds from empty
