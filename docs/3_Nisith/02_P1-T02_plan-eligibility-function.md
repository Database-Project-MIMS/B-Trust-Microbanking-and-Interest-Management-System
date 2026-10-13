# 🔵 Phase 1 — Task 02: Plan Eligibility Function
**Task ID:** `P01-M03-T02` · **Branch:** `feat/p01-m03-plan-eligibility-function`
**File:** `database/routines/fn_check_plan_eligibility.sql` · **Status:** READY
**Depends on:** T01 (`savings_plan`)
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

The function that reads T01's eligibility columns and decides whether a customer can
open a given plan. **This is the task worth the most marks in your entire slice** — it
must be a genuine data-driven join against `savings_plan`, never a hardcoded
`IF plan_name = 'Children' AND age < 13` chain. If you find yourself writing the plan
name as a string literal anywhere in this function, stop — that's the anti-pattern G-13
exists to prevent.

---

## Function to Create

### `fn_check_plan_eligibility(plan_id uuid, date_of_birth date, holder_count int) RETURNS boolean`

Logic, entirely driven by the row in `savings_plan`:

```sql
CREATE OR REPLACE FUNCTION fn_check_plan_eligibility(
    p_plan_id uuid,
    p_date_of_birth date,
    p_holder_count int
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_plan savings_plan%ROWTYPE;
    v_age  int;
BEGIN
    SELECT * INTO v_plan FROM savings_plan WHERE plan_id = p_plan_id AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    v_age := DATE_PART('year', AGE(CURRENT_DATE, p_date_of_birth));

    IF v_plan.min_age_years IS NOT NULL AND v_age < v_plan.min_age_years THEN
        RETURN false;
    END IF;

    IF v_plan.max_age_years IS NOT NULL AND v_age > v_plan.max_age_years THEN
        RETURN false;
    END IF;

    IF p_holder_count < v_plan.min_holders OR p_holder_count > v_plan.max_holders THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;
```

Notes:
- `STABLE` (not `VOLATILE`) — it reads data but does not modify it, and PostgreSQL can
  optimize repeated calls within one statement.
- For **Joint** accounts, this function only checks the *count* of holders — whether
  **every individual holder** is an adult (`requires_all_adult`) is a per-holder check
  that belongs in `sp_open_savings_account` (Phase 2, T04), calling this function once
  per prospective holder plus a holder-count check. Document that split clearly in the
  function's usage comment so the Phase 2 task doesn't re-derive the logic differently.

---

## How to Implement

### Step 1 — Write the Routine File
Create file: `database/routines/fn_check_plan_eligibility.sql` with the function above.
Wrap it in its own migration so it's tracked and re-runnable:

`database/migrations/0141_p01_m03_plan_eligibility_fn.sql`:

```sql
-- Migration 0141: fn_check_plan_eligibility (M3)
-- Data-driven eligibility check against savings_plan — never hardcoded by plan name

BEGIN;

\i database/routines/fn_check_plan_eligibility.sql

INSERT INTO schema_migration(version, name)
VALUES (141, '0141_p01_m03_plan_eligibility_fn');

COMMIT;
```

(If your migration runner does not support `\i` includes, inline the `CREATE OR REPLACE
FUNCTION` body directly in the migration file instead — check `scripts/migrate.mjs`
first.)

### Step 2 — Write SQL Tests
Create file: `tests/db/plan-eligibility-function.test.mjs`

Test these scenarios (BR-03…BR-07 boundary cases — get the edges right):
1. ✅ Child aged 12 → eligible for Children; aged 13 → not eligible for Children
2. ✅ Teen aged 13 → eligible for Teen; aged 12 → not eligible; aged 18 → not eligible
3. ✅ Adult aged 18 → eligible for Adult; aged 17 → not eligible; aged 59 → eligible;
   aged 60 → not eligible for Adult (falls into Senior)
4. ✅ Senior aged 60 → eligible for Senior; aged 59 → not eligible
5. ✅ Joint with 1 holder → not eligible (`min_holders = 2`); with 2 → eligible; with 4
   → eligible; with 5 → not eligible (`max_holders = 4`)
6. ✅ A non-existent or `INACTIVE` `plan_id` → not eligible (returns `false`, not an
   error)
7. ✅ Changing `savings_plan.max_age_years` for a test plan changes the function's
   answer **without redeploying the function** — this is the proof that eligibility is
   genuinely data-driven

### Step 3 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `fn_check_plan_eligibility`
  with its signature and the FR/BR it enforces
- Update `docs/07_business-rules.md` — confirm BR-03…BR-07 enforcement column points to
  this function
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Function reads `min_age_years`, `max_age_years`, `min_holders`, `max_holders`
      entirely from the `savings_plan` row — no plan-name string comparison anywhere
- [ ] All age-boundary and holder-count edge cases from BR-03…BR-07 pass
- [ ] Changing a plan's eligibility columns changes the function's behaviour without a
      code change (proven by a test)
- [ ] `npm run db:rebuild` succeeds from empty
