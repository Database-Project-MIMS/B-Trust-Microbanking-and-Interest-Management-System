# 🔵 Phase 1 — Task 01: FD Product Schema
**Task ID:** `P01-M05-T01` · **Branch:** `feat/p01-m05-fd-plan-schema`  
**Migration:** `0180_p01_m05_fd_plan.sql` · **Status:** DONE  
**Depends on:** migration `0000`; **G-11** approved  
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

Create the `fd_plan` table — the fixed deposit product catalogue. This is your **first task** and purely database work. The three FD products from BR-13 must exist with exactly the right tenures and rates, stored as fractions.

---

## Table to Create

### `fd_plan`
The fixed deposit product definitions (SRS BR-13: three products).

| Column | Type | Constraints |
|---|---|---|
| `fd_plan_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `plan_name` | `varchar(100)` | **UNIQUE, NOT NULL** |
| `tenure_months` | `int` | NOT NULL, `CHECK (tenure_months > 0)` |
| `interest_rate` | `interest_rate` | NOT NULL — stored as a fraction (0.1300 = 13%) |
| `description` | `varchar(255)` | |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `effective_from` | `date` | DEFAULT `CURRENT_DATE` — when this product version becomes effective (G-11) |
| `effective_to` | `date` | NULL — NULL means currently active |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `fixed_deposit`
- **CHECK:** `effective_to IS NULL OR effective_to >= effective_from`
- **Seed** exactly 3 products per BR-13:
  - 6 months / 13% (`tenure_months = 6`, `interest_rate = 0.1300`)
  - 1 year / 14% (`tenure_months = 12`, `interest_rate = 0.1400`)
  - 3 years / 15% (`tenure_months = 36`, `interest_rate = 0.1500`)

---

## How to Implement

### Step 1 — Write the Migration
Create file: `database/migrations/0180_p01_m05_fd_plan.sql`

```sql
-- Migration 0180: FD product schema (M5)
-- Table: fd_plan — three fixed deposit products (BR-13)

BEGIN;

CREATE TABLE fd_plan (
    fd_plan_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name      varchar(100) NOT NULL UNIQUE,
    tenure_months  int NOT NULL CHECK (tenure_months > 0),
    interest_rate  numeric(6,4) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 1),
    description    varchar(255),
    status         varchar(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'INACTIVE')),
    effective_from date DEFAULT CURRENT_DATE,
    effective_to   date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz,
    CONSTRAINT chk_fd_plan_effective_dates 
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Seed the three BR-13 products
INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, description)
VALUES
    ('6 Month FD',  6,  0.1300, 'Fixed deposit — 6-month tenure at 13% per annum'),
    ('1 Year FD',   12, 0.1400, 'Fixed deposit — 12-month tenure at 14% per annum'),
    ('3 Year FD',   36, 0.1500, 'Fixed deposit — 36-month tenure at 15% per annum');

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (180, '0180_p01_m05_fd_plan');

COMMIT;
```

### Step 2 — Write SQL Tests
Create file: `tests/db/fd-plan-constraints.test.mjs`

Test these scenarios:
1. ✅ Exactly 3 FD plans exist after migration with the correct rates and tenures
2. ✅ Duplicate `plan_name` is rejected (error code `23505`)
3. ✅ `tenure_months = 0` or negative is rejected by CHECK constraint
4. ✅ `interest_rate > 1` is rejected (rate must be a fraction, not a percentage)
5. ✅ `effective_to < effective_from` is rejected by CHECK constraint
6. ✅ Rate is stored as a fraction: 13% = `0.1300`, not `13` or `13.00`
7. ✅ NULL `plan_name` is rejected
8. ✅ Invalid `status` values are rejected

### Step 3 — Run & Verify
```bash
npm run db:rebuild    # Should apply all migrations cleanly
npm run db:verify     # Should pass
npm test              # Your new tests should pass
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` Part B rows for `fd_plan` (mark as implemented)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] Exactly the three BR-13 products exist with correct rates and tenures
- [ ] Rate is stored as a fraction (0.1300, not 13)
- [ ] `tenure_months > 0` enforced by CHECK
- [ ] Effective-dating columns present (G-11)
- [ ] `npm run db:rebuild` succeeds from empty
