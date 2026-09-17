# 🟡 Phase 3 — Task 03: `sp_post_withdrawal`
**Task ID:** `P03-M04-T03` · **Branch:** `feat/p03-m04-sp-post-withdrawal`
**File:** `database/routines/sp_post_withdrawal.sql` · **Status:** TODO
**Depends on:** T02 (`sp_post_deposit`), **I-4** (M3's `fn_check_plan_minimum` and
`fn_check_joint_mandate`)
**Story Points:** ~7 · **Layer:** Database only — **the hardest routine in your slice**

---

## ⚠️ Confirm I-4 First

```bash
grep -n "P03-M03-T01\|P03-M03-T02" docs/09_task-tracker.md
ls .agent/handoffs/ | grep -i mandate
ls .agent/handoffs/ | grep -i plan-minimum
```
Both `fn_check_plan_minimum` and `fn_check_joint_mandate` (M3's Phase 3 tasks) must be
published before you can call them here. If they aren't, say so and hold this task —
don't hardcode a placeholder minimum-balance check.

---

## What This Task Is

The most consequential routine in the project. Everything AGENTS.md §5 and §11 say about
"lock before you decide" exists because of exactly this function. Overdrafts must be
**impossible, including under concurrency** (NFR-SAFE-01, AC-06) — this is what Phase 6's
concurrency tests (M3's `P06-M03-T01`) will hammer against.

---

## Routine to Create

### `sp_post_withdrawal(...)`

```
p_account_id uuid,
p_amount numeric(15,2),
p_channel_id uuid,
p_initiated_by_user_id uuid,
p_requesting_customer_id uuid,   -- for holder-authority / mandate check
p_idempotency_key varchar(80),
p_narration varchar(255),
OUT p_transaction_id uuid,
OUT p_reference_number varchar,
OUT p_balance_after numeric(15,2),
OUT p_posted_at timestamptz
```

Steps, all inside one transaction, **in this exact order**:

1. **Idempotency check first**, same pattern as `sp_post_deposit` — return the original
   result if the key was already used.
2. **Lock the account:** `SELECT current_balance, status, plan_id FROM account WHERE
   account_id = $1 FOR UPDATE`.
3. **Re-validate status** — `ACTIVE`, else `409 ACCOUNT_NOT_ACTIVE`.
4. **Re-validate business hours** against `system_parameter`/`business_calendar` (M1).
5. **Holder authority + mandate** — call `fn_check_joint_mandate(p_account_id,
   p_requesting_customer_id)`. `false` → `409 MANDATE_NOT_SATISFIED`, no ledger row.
6. **Single and daily withdrawal limits (BR-I2)** — read `system_parameter` for the
   LKR 100,000 single / LKR 200,000 daily limits; sum today's `WITHDRAWAL` transactions
   for this account **inside this same locked transaction** (not a separate,
   unlocked read) before comparing. `409 LIMIT_EXCEEDED` if breached, unless a manager
   override flag is present (check with M1's Phase 3 task on manager-only reversal
   authorization for whether an analogous override exists for limits — if unclear, don't
   invent an override path; raise it as an open question).
7. **Sufficient funds check:** `p_amount <= v_balance`. `409 INSUFFICIENT_FUNDS`
   otherwise.
8. **Post-withdrawal minimum balance (BR-09)** — call
   `fn_check_plan_minimum(p_account_id, v_balance - p_amount)`. `false` → `409
   BELOW_MINIMUM_BALANCE`, no ledger row.
9. **Only after every check above passes:** generate reference, insert the ledger row
   with `balance_after = v_balance - p_amount`, update `account.current_balance`, insert
   audit.
10. **Any rejection above (steps 3–8) still writes an audit event** (BR-L1, FR-WD-05) —
    log the attempted withdrawal and the specific rejection reason, but insert **no**
    `transaction` row.

```sql
CREATE OR REPLACE PROCEDURE sp_post_withdrawal(
    p_account_id uuid,
    p_amount numeric(15,2),
    p_channel_id uuid,
    p_initiated_by_user_id uuid,
    p_requesting_customer_id uuid,
    p_idempotency_key varchar,
    p_narration varchar,
    OUT p_transaction_id uuid,
    OUT p_reference_number varchar,
    OUT p_balance_after numeric(15,2),
    OUT p_posted_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance numeric(15,2);
    v_status  varchar(20);
    v_daily_total numeric(15,2);
    v_single_limit numeric(15,2);
    v_daily_limit numeric(15,2);
    v_resulting_balance numeric(15,2);
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT transaction_id, reference_number, balance_after, transaction_date
        INTO p_transaction_id, p_reference_number, p_balance_after, p_posted_at
        FROM transaction WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN RETURN; END IF;
    END IF;

    SELECT current_balance, status INTO v_balance, v_status
    FROM account WHERE account_id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'ACCOUNT_NOT_ACTIVE');
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    IF NOT fn_check_joint_mandate(p_account_id, p_requesting_customer_id) THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'MANDATE_NOT_SATISFIED');
        RAISE EXCEPTION 'MANDATE_NOT_SATISFIED' USING ERRCODE = 'P0001';
    END IF;

    SELECT single_withdrawal_limit, daily_withdrawal_limit
    INTO v_single_limit, v_daily_limit
    FROM system_parameter LIMIT 1;

    IF p_amount > v_single_limit THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'LIMIT_EXCEEDED');
        RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM transaction
    WHERE account_id = p_account_id
      AND transaction_type = 'WITHDRAWAL'
      AND transaction_date::date = CURRENT_DATE;

    IF v_daily_total + p_amount > v_daily_limit THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'LIMIT_EXCEEDED');
        RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

    IF p_amount > v_balance THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'INSUFFICIENT_FUNDS');
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
    END IF;

    v_resulting_balance := v_balance - p_amount;

    IF NOT fn_check_plan_minimum(p_account_id, v_resulting_balance) THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'BELOW_MINIMUM_BALANCE');
        RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE = 'P0001';
    END IF;

    p_reference_number := fn_next_transaction_reference();
    p_balance_after := v_resulting_balance;
    p_posted_at := now();

    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        idempotency_key, balance_after
    ) VALUES (
        p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'WITHDRAWAL', p_amount, p_posted_at, p_narration,
        p_idempotency_key, p_balance_after
    ) RETURNING transaction_id INTO p_transaction_id;

    UPDATE account SET current_balance = p_balance_after, updated_at = now()
    WHERE account_id = p_account_id;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, after_value)
    VALUES (p_initiated_by_user_id, 'USER', 'transaction', p_transaction_id, 'WITHDRAWAL',
            jsonb_build_object('amount', p_amount, 'balance_after', p_balance_after));
END;
$$;
```

`sp_write_rejection_audit(...)` is a small helper procedure you write once and reuse for
every rejection branch — keeps the audit-on-rejection logic (BR-L1) in one place instead
of six copy-pasted `INSERT INTO audit_log` calls.

---

## How to Implement

### Step 1 — Confirm I-4 Is Published (see top of this file)

### Step 2 — Write the Migration
`database/migrations/0362_p03_m04_sp_post_withdrawal.sql`, including
`sp_write_rejection_audit`.

### Step 3 — Write SQL Tests
Create file: `tests/db/sp-post-withdrawal.test.mjs`

1. ✅ A valid withdrawal posts, `balance_after` correct, `current_balance` updated
2. ✅ Withdrawal from an inactive account → `ACCOUNT_NOT_ACTIVE`, audit written, no
   ledger row
3. ✅ Withdrawal exceeding the single limit → `LIMIT_EXCEEDED`
4. ✅ Withdrawal that pushes the daily total over the daily limit → `LIMIT_EXCEEDED`
   (test with two prior same-day withdrawals plus one more)
5. ✅ Withdrawal exceeding the current balance → `INSUFFICIENT_FUNDS`
6. ✅ Withdrawal that would breach the plan minimum → `BELOW_MINIMUM_BALANCE`
7. ✅ Joint withdrawal without a satisfied mandate → `MANDATE_NOT_SATISFIED`, audited,
   no ledger effect (this is the named critical test scenario from G-08)
8. ✅ Repeated `idempotency_key` → original result, no second debit
9. ✅ Every rejection path writes exactly one audit row and zero `transaction` rows
10. ✅ **Concurrency smoke test** (full stress test is Phase 6, M3's task, but sanity
    check here): two withdrawals fired concurrently against a tight balance — exactly
    one succeeds

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `sp_post_withdrawal` and
  `sp_write_rejection_audit` with their full error-code list
- Update `docs/07_business-rules.md` — confirm BR-09, BR-17, BR-I2, BR-L1 enforcement
  points all reference this routine
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Lock acquired before any balance/status decision; every check re-validated inside
      the lock
- [ ] All six rejection reasons (`ACCOUNT_NOT_ACTIVE`, `MANDATE_NOT_SATISFIED`,
      `LIMIT_EXCEEDED`, `INSUFFICIENT_FUNDS`, `BELOW_MINIMUM_BALANCE`, plus idempotent
      replay) are individually tested
- [ ] Every rejection writes an audit row and **zero** ledger rows
- [ ] Repeated `idempotency_key` never produces a second debit
- [ ] `npm run db:rebuild` succeeds from empty
