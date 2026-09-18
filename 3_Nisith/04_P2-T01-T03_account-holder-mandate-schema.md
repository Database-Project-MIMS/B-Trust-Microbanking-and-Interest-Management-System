# 🟢 Phase 2 — Tasks 01–03: Account, Holder & Joint Mandate Schema
**Task IDs:** `P02-M03-T01`, `P02-M03-T02`, `P02-M03-T03`
**Branch:** `feat/p02-m03-account-holder-mandate-schema`
**Migrations:** `0240_p02_m03_account.sql`, `0241_p02_m03_account_holder.sql`,
`0242_p02_m03_joint_mandate.sql` · **Status:** TODO (gated)
**Depends on:** `P01-M03-T01` (`savings_plan`), **G-06** approved; T01 depends on M2's
`branch`; T02 depends on M2's `customer` (**OQ-05** gate); T03 depends on **G-08**
approved
**Story Points:** ~4 + ~3 + ~3 = ~10 · **Layer:** Database only

---

## ⚠️ Gates — Read First

- **G-06** (account needs `branch_id`) and **G-08** (joint mandate needs a table) must
  both be approved before this task starts — check `.agent/open-questions.md` and
  `docs/phases/phase-02-customers-and-accounts.md` entry criteria.
- T02 additionally needs M2's `customer` table, which is itself gated on **OQ-05**. If
  `P02-M02-T01` is not `DONE`, you can still write and test T01 (`account`) in
  isolation, but stop before T02.

---

## T01 — `account`

| Column | Type | Constraints |
|---|---|---|
| `account_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `plan_id` | `uuid` | **FK → savings_plan, NOT NULL** |
| `branch_id` | `uuid` | **FK → branch, NOT NULL** — G-06, owning branch fixed at opening, RLS anchor (FR-ACC-01) |
| `opened_by_agent_id` | `uuid` | **FK → agent, NOT NULL** |
| `account_number` | `varchar(50)` | **UNIQUE, NOT NULL** (SRS §6.7) |
| `opened_date` | `date` | NOT NULL DEFAULT `CURRENT_DATE` |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','FROZEN','CLOSED'))` |
| `current_balance` | `numeric(15,2)` | NOT NULL DEFAULT `0`, **`CHECK (current_balance >= 0)`** — G-18, last line of defence behind row locking |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `transaction`, `account_holder`,
  `fixed_deposit`.
- **Indexes:** `account_number` unique; `(plan_id)`; `(status)`; `(branch_id)` — the
  branch index is what makes RLS/branch-scope queries fast, not just correct.
- **Why `branch_id` is stored, not derived (G-06):** deriving it from
  `opened_by_agent → agent.branch_id` breaks the moment that agent transfers branch
  (FR-ORG-04 explicitly allows it) — every account that agent ever opened would silently
  migrate to the new branch, changing historical report totals and RLS visibility
  retroactively. Fix it at opening time and never touch it again.

## T02 — `account_holder`

Intersection resolving the many-to-many between customers and accounts — what makes
joint accounts possible (SRS §6.3).

| Column | Type | Constraints |
|---|---|---|
| `account_holder_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `account_id` | `uuid` | **FK → account, NOT NULL** |
| `customer_id` | `uuid` | **FK → customer, NOT NULL** |
| `joined_date` | `date` | NOT NULL DEFAULT `CURRENT_DATE` |
| `holder_type` | `varchar(20)` | NOT NULL, `CHECK (holder_type IN ('PRIMARY','JOINT'))` — G-08 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- **UNIQUE (account_id, customer_id)** — prevents the same customer being added twice to
  one account.
- **Invariant (unenforced here, see T03):** an individual account has exactly one
  `PRIMARY` holder; a joint account has 2–4 `JOINT` holders. Row-level constraints
  cannot count sibling rows — that's what `trg_validate_joint_mandate` in T03 is for.

## T03 — `joint_mandate` + `trg_validate_joint_mandate`

| Column | Type | Constraints |
|---|---|---|
| `mandate_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `account_id` | `uuid` | **FK → account, UNIQUE, NOT NULL** — one mandate per account |
| `mandate_type` | `varchar(20)` | NOT NULL, `CHECK (mandate_type IN ('ANY_ONE','ALL_HOLDERS'))` |
| `required_signatories` | `int` | NOT NULL DEFAULT `1` |
| `effective_from` | `date` | NOT NULL DEFAULT `CURRENT_DATE` |
| `effective_to` | `date` | NULL |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

### `trg_validate_joint_mandate` — statement-level, transition tables

The 2–4 adult holder rule **spans rows** (you must count how many `account_holder` rows
exist for an `account_id` after an `INSERT`), so it cannot be a row-level `CHECK`. Use a
statement-level `AFTER INSERT` trigger with a transition table (L08 material):

```sql
CREATE OR REPLACE FUNCTION trg_fn_validate_joint_mandate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    v_holder_count int;
    v_plan_id uuid;
    v_min_holders int;
    v_max_holders int;
BEGIN
    FOR r IN SELECT DISTINCT account_id FROM new_holders LOOP
        SELECT COUNT(*) INTO v_holder_count
        FROM account_holder WHERE account_id = r.account_id;

        SELECT a.plan_id, sp.min_holders, sp.max_holders
        INTO v_plan_id, v_min_holders, v_max_holders
        FROM account a
        JOIN savings_plan sp ON sp.plan_id = a.plan_id
        WHERE a.account_id = r.account_id;

        IF v_holder_count < v_min_holders OR v_holder_count > v_max_holders THEN
            RAISE EXCEPTION 'INVALID_HOLDER_COUNT: account % has % holders, plan requires %-%',
                r.account_id, v_holder_count, v_min_holders, v_max_holders
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_validate_joint_mandate
    AFTER INSERT ON account_holder
    REFERENCING NEW TABLE AS new_holders
    FOR EACH STATEMENT
    EXECUTE FUNCTION trg_fn_validate_joint_mandate();
```

This validates holder **count** against the plan's `min_holders`/`max_holders` — it does
**not** validate that every holder is an adult (`requires_all_adult`); that per-holder
age check happens in `sp_open_savings_account` (next task file) by calling
`fn_check_plan_eligibility` once per holder, since the trigger only sees IDs, not dates
of birth without an extra join you'd rather keep in the routine.

---

## How to Implement

### Step 1 — Confirm Gates
```bash
grep -n "G-06\|G-08" .agent/open-questions.md
grep -n "P02-M02-T01" docs/09_task-tracker.md
```

### Step 2 — Write the Three Migrations
`database/migrations/0240_p02_m03_account.sql`, `0241_p02_m03_account_holder.sql`,
`0242_p02_m03_joint_mandate.sql` — following the column specs above. Keep them as three
separate files even though they land in one PR/branch, so each is independently
re-runnable and reviewable.

### Step 3 — Write SQL Tests

`tests/db/account-constraints.test.mjs`:
1. ✅ `current_balance < 0` is rejected by the CHECK constraint
2. ✅ Duplicate `account_number` is rejected (`23505`)
3. ✅ Inserting with a non-existent `branch_id`/`plan_id`/`opened_by_agent_id` is
   rejected (`23503`)
4. ✅ Default `current_balance` is `0`

`tests/db/account-holder-constraints.test.mjs`:
1. ✅ The same customer cannot be added twice to one account (`23505` on the composite
   unique key)
2. ✅ Invalid `holder_type` is rejected

`tests/db/joint-mandate-trigger.test.mjs` — the important one:
1. ✅ Inserting a single `PRIMARY` holder on an individual-plan account succeeds
2. ✅ Inserting 2 holders on a Joint-plan account succeeds
3. ✅ Inserting **1** holder on a Joint-plan account is rejected by the trigger
4. ✅ Inserting **5** holders on a Joint-plan account is rejected by the trigger
5. ✅ A second `joint_mandate` row for the same `account_id` is rejected (`23505` on the
   UNIQUE constraint)
6. ✅ Invalid `mandate_type` is rejected

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` — `account` (G-06, G-18 resolved),
  `account_holder` (`holder_type` added), `joint_mandate` (new table, G-08 resolved)
- Update `docs/16_database-routines-views-indexes.md` — add `trg_validate_joint_mandate`
- Update `docs/17_erd-gap-analysis.md` — mark G-06, G-08, G-18 implemented
- Update task statuses in `docs/09_task-tracker.md` → `DONE`
- **Write a handoff in `.agent/handoffs/`** — M4's posting routines (Phase 3) read
  `account.status`/`current_balance` under lock (**I-3**); tell them the final column
  names and lock behaviour you expect

---

## Acceptance Criteria
- [ ] All three migrations apply to a clean DB without errors
- [ ] `current_balance` CHECK rejects negative values (G-18)
- [ ] `account.branch_id` is fixed at opening and never derived (G-06)
- [ ] 1-holder and 5-holder joint accounts are both rejected by
      `trg_validate_joint_mandate`
- [ ] `joint_mandate.account_id` is UNIQUE — one mandate per account
- [ ] Handoff written for M4 (I-3)
- [ ] `npm run db:rebuild` succeeds from empty
