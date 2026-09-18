# 🟡 Phase 3 — Task 01: `fn_check_plan_minimum` — Publishes I-4
**Task ID:** `P03-M03-T01` · **Branch:** `feat/p03-m03-fn-check-plan-minimum`
**File:** `database/routines/fn_check_plan_minimum.sql` · **Status:** TODO
**Depends on:** `P02-M03-T01` (`account`)
**Story Points:** ~3 · **Layer:** Database only — **you are the producer of I-4**

---

## What This Task Is

The post-withdrawal minimum-balance rule as a standalone, callable function. M4's
`sp_post_withdrawal` (Phase 3) calls this **inside its own locked transaction** — you do
not call it yourself from a withdrawal path, you only publish it. Get this function
correct and merged early in Phase 3, because M4's withdrawal routine is blocked on it.

---

## Function to Create

### `fn_check_plan_minimum(p_account_id uuid, p_resulting_balance numeric(15,2)) RETURNS boolean`

```sql
CREATE OR REPLACE FUNCTION fn_check_plan_minimum(
    p_account_id uuid,
    p_resulting_balance numeric(15,2)
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_min_balance numeric(15,2);
BEGIN
    SELECT sp.min_balance INTO v_min_balance
    FROM account a
    JOIN savings_plan sp ON sp.plan_id = a.plan_id
    WHERE a.account_id = p_account_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN p_resulting_balance >= v_min_balance;
END;
$$;
```

**Contract for M4 (write this into the handoff verbatim):**
- Call `fn_check_plan_minimum(account_id, current_balance - withdrawal_amount)` **after**
  acquiring `SELECT ... FOR UPDATE` on the account row and **before** inserting the
  ledger row — re-validate against the resulting balance, not the balance read before
  the lock.
- Returns `false` → the withdrawal must be rejected with `409 BELOW_MINIMUM_BALANCE` and
  **no ledger row written**, matching FR-WD-05 (a rejection writes an audit event and no
  ledger effect).
- Reads `min_balance` from `savings_plan` through `account.plan_id` — never
  hardcode a plan's minimum in M4's code; if the function signature or return contract
  ever needs to change, that's a new handoff, not a silent breaking change to an
  existing one.

---

## How to Implement

### Step 1 — Write the Migration
`database/migrations/0340_p03_m03_fn_check_plan_minimum.sql` containing the function
above.

### Step 2 — Write SQL Tests
Create file: `tests/db/fn-check-plan-minimum.test.mjs`

1. ✅ Adult account (min 1,000): resulting balance 1,000 → `true`; 999.99 → `false`
2. ✅ Children account (min 0): resulting balance 0 → `true`; negative is not a valid
   input for this function (that's `current_balance >= 0`'s job, not this function's —
   test that a negative input still returns a deterministic boolean rather than erroring
   strangely)
3. ✅ Non-existent `account_id` → `false`
4. ✅ Changing `savings_plan.min_balance` for a test plan changes the function's answer
   without redeploying it — proves the rule stays data-driven, consistent with
   `fn_check_plan_eligibility`'s design in Phase 1

### Step 3 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs & Publish the Handoff
- Update `docs/16_database-routines-views-indexes.md` — add `fn_check_plan_minimum`
- Update `docs/07_business-rules.md` — confirm the enforcement point for the
  post-withdrawal minimum rule references this function
- **Write `.agent/handoffs/i-4-fn-check-plan-minimum.md`** with the exact function
  signature, the call-order contract above, and a note that M4's `P03-M04-T03`
  (`sp_post_withdrawal`) is now unblocked
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Function signature matches what's documented in the handoff exactly
- [ ] Boundary case (`resulting_balance == min_balance`) returns `true`, one cent below
      returns `false`
- [ ] Function reads the minimum from `savings_plan` via `account.plan_id` — no
      hardcoded amount anywhere
- [ ] Handoff published in `.agent/handoffs/` before this task is marked `DONE`
- [ ] `npm run db:rebuild` succeeds from empty
