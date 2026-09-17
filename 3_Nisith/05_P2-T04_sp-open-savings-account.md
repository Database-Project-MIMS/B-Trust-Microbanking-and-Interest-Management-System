# 🟢 Phase 2 — Task 04: `sp_open_savings_account`
**Task ID:** `P02-M03-T04` · **Branch:** `feat/p02-m03-sp-open-savings-account`
**File:** `database/routines/sp_open_savings_account.sql` · **Status:** TODO
**Depends on:** T03 (`joint_mandate`), `P02-M04-T01` (`transaction` schema, M4)
**Story Points:** ~6 · **Layer:** Database — your hardest task this phase

---

## What This Task Is

The single atomic routine that opens a savings account: account row, holder row(s),
mandate (if joint), and an **optional** initial deposit — all in one transaction, or
none of it happens. This is the routine AGENTS.md §5 and §11 mean by "posting an
account opening runs inside a single explicit transaction."

Wait for M4's `transaction` table (`P02-M04-T01`) before wiring the optional deposit
path — the account and holder pieces can be built and tested independently first.

---

## Routine to Create

### `sp_open_savings_account(...)`

Parameters (adjust exact order/names to match your service layer call site, but keep
this shape):
```
p_plan_id uuid,
p_branch_id uuid,
p_opened_by_agent_id uuid,
p_holders jsonb,        -- [{ customer_id, holder_type }]
p_mandate jsonb,        -- { mandate_type, required_signatories } or NULL for individual
p_initial_deposit numeric(15,2), -- NULL or 0 to skip
p_channel_id uuid,      -- required if p_initial_deposit is set
p_actor_user_id uuid
```

Steps, all inside one transaction:

1. **Validate holder count** matches the plan's `min_holders`/`max_holders` (redundant
   with the statement-level trigger, but fail fast with a clear error before the
   trigger fires)
2. **Validate each holder's eligibility** — call `fn_check_plan_eligibility(p_plan_id,
   customer.date_of_birth, holder_count)` once per holder; if the plan
   `requires_all_adult`, additionally confirm every holder's age ≥ 18 regardless of the
   plan's own age bounds (a Joint plan has no age bounds of its own — `requires_all_adult`
   is the mechanism that keeps every joint holder an adult)
3. **Generate `account_number`** via `fn_next_account_number()` (see below)
4. **Insert `account`** with `current_balance = 0` initially
5. **Insert `account_holder`** rows for each holder — this fires
   `trg_validate_joint_mandate` as a statement-level check
6. **Insert `joint_mandate`** if the plan requires one (`min_holders > 1`) — reject with
   `MANDATE_REQUIRED` if a joint plan has holders but no mandate payload
7. **If `p_initial_deposit` is provided:**
   - Validate `p_initial_deposit >= savings_plan.min_balance`
   - Call `sp_post_deposit` (M4's routine, once it exists) or, if M4's routine isn't
     ready yet, insert the ledger row and update `current_balance` directly **inside
     this same transaction** — but prefer calling M4's routine once available so there
     is exactly one code path that ever writes a deposit
8. **Insert `audit_log`** row for the account creation
9. Return `account_id`, `account_number`, `current_balance`

```sql
CREATE OR REPLACE PROCEDURE sp_open_savings_account(
    p_plan_id uuid,
    p_branch_id uuid,
    p_opened_by_agent_id uuid,
    p_holders jsonb,
    p_mandate jsonb,
    p_initial_deposit numeric(15,2),
    p_channel_id uuid,
    p_actor_user_id uuid,
    OUT p_account_id uuid,
    OUT p_account_number varchar,
    OUT p_current_balance numeric(15,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan savings_plan%ROWTYPE;
    v_holder_count int := jsonb_array_length(p_holders);
    v_holder jsonb;
BEGIN
    SELECT * INTO v_plan FROM savings_plan WHERE plan_id = p_plan_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_holder_count < v_plan.min_holders OR v_holder_count > v_plan.max_holders THEN
        RAISE EXCEPTION 'INVALID_HOLDER_COUNT' USING ERRCODE = 'P0001';
    END IF;

    FOR v_holder IN SELECT * FROM jsonb_array_elements(p_holders) LOOP
        PERFORM 1
        FROM customer c
        WHERE c.customer_id = (v_holder->>'customer_id')::uuid
          AND fn_check_plan_eligibility(p_plan_id, c.date_of_birth, v_holder_count);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'PLAN_ELIGIBILITY_FAILED' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    IF p_initial_deposit IS NOT NULL AND p_initial_deposit > 0
       AND p_initial_deposit < v_plan.min_balance THEN
        RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE = 'P0001';
    END IF;

    IF v_plan.min_holders > 1 AND p_mandate IS NULL THEN
        RAISE EXCEPTION 'MANDATE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    p_account_number := fn_next_account_number();

    INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, current_balance)
    VALUES (p_plan_id, p_branch_id, p_opened_by_agent_id, p_account_number, 0)
    RETURNING account_id INTO p_account_id;

    FOR v_holder IN SELECT * FROM jsonb_array_elements(p_holders) LOOP
        INSERT INTO account_holder (account_id, customer_id, holder_type)
        VALUES (p_account_id, (v_holder->>'customer_id')::uuid, v_holder->>'holder_type');
    END LOOP;

    IF p_mandate IS NOT NULL THEN
        INSERT INTO joint_mandate (account_id, mandate_type, required_signatories)
        VALUES (p_account_id, p_mandate->>'mandate_type', (p_mandate->>'required_signatories')::int);
    END IF;

    IF p_initial_deposit IS NOT NULL AND p_initial_deposit > 0 THEN
        -- Prefer CALL sp_post_deposit(...) once M4's routine exists.
        UPDATE account SET current_balance = current_balance + p_initial_deposit
        WHERE account_id = p_account_id;
        -- INSERT INTO transaction (...) goes here, matching M4's ledger contract exactly.
    END IF;

    SELECT current_balance INTO p_current_balance FROM account WHERE account_id = p_account_id;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, after_value)
    VALUES (p_actor_user_id, 'USER', 'account', p_account_id, 'CREATE',
            jsonb_build_object('account_number', p_account_number, 'plan_id', p_plan_id));
END;
$$;
```

Also create `fn_next_account_number()` — a simple sequence-backed or formatted
generator (`ACC-` + zero-padded sequence, or whatever convention
`docs/04_database-schema.md` implies for `account_number`'s format). Keep it a small,
separate function so it's independently testable.

---

## How to Implement

### Step 1 — Confirm M4's `transaction` Table Status
```bash
grep -n "P02-M04-T01" docs/09_task-tracker.md
```
If not ready, build and test everything except step 7 (the deposit) first, then add the
deposit path once M4's table and (ideally) `sp_post_deposit` exist.

### Step 2 — Write the Migration
`database/migrations/0243_p02_m03_sp_open_savings_account.sql` containing
`fn_next_account_number()` and `sp_open_savings_account(...)`.

### Step 3 — Write SQL Tests
`tests/db/sp-open-savings-account.test.mjs`:
1. ✅ Opens an individual account with one adult holder, no initial deposit
2. ✅ Opens a joint account with 2–4 adult holders and a mandate
3. ✅ Rejects a joint account with only 1 holder (`INVALID_HOLDER_COUNT`)
4. ✅ Rejects a joint account with 5 holders (`INVALID_HOLDER_COUNT`)
5. ✅ Rejects an ineligible holder by age (`PLAN_ELIGIBILITY_FAILED`)
6. ✅ Rejects an initial deposit below `savings_plan.min_balance`
   (`BELOW_MINIMUM_BALANCE`)
7. ✅ Rejects a joint account with holders but no mandate payload (`MANDATE_REQUIRED`)
8. ✅ **Atomicity**: force a failure partway through (e.g. an invalid holder in a list of
   3) and confirm **no** `account`, `account_holder`, `joint_mandate` or `transaction`
   row was left behind
9. ✅ With a valid initial deposit, `current_balance` and the ledger row agree exactly

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `sp_open_savings_account`
  and `fn_next_account_number` with their error codes
- Update task status in `docs/09_task-tracker.md` → `DONE`
- Write/refresh the I-3 handoff if the account row shape changed since T01–T03

---

## Acceptance Criteria
- [ ] Individual and joint account opening both succeed end-to-end
- [ ] All five documented error conditions (`PLAN_NOT_FOUND`, `INVALID_HOLDER_COUNT`,
      `PLAN_ELIGIBILITY_FAILED`, `BELOW_MINIMUM_BALANCE`, `MANDATE_REQUIRED`) are tested
- [ ] A forced mid-routine failure leaves **zero** partial rows in any of the four
      tables it touches
- [ ] Initial deposit, when present, matches `current_balance` exactly (no float drift)
- [ ] `npm run db:rebuild` succeeds from empty
