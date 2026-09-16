# 🟡 Phase 3 — Task 02: `sp_post_deposit`
**Task ID:** `P03-M04-T02` · **Branch:** `feat/p03-m04-sp-post-deposit`
**File:** `database/routines/sp_post_deposit.sql` · **Status:** TODO
**Depends on:** T01 (reference/idempotency indexes)
**Story Points:** ~6 · **Layer:** Database only

---

## What This Task Is

The simpler of your two posting routines — get the lock-then-decide and idempotency
pattern exactly right here before withdrawal (T03) adds its extra validation layers on
top of the same skeleton. Every other financial routine in the project (withdrawal,
reversal, interest credit) follows this shape.

---

## Routine to Create

### `sp_post_deposit(...)`

```
p_account_id uuid,
p_amount numeric(15,2),
p_channel_id uuid,
p_initiated_by_user_id uuid,
p_idempotency_key varchar(80),   -- NULL for system-generated deposits (e.g. account opening)
p_narration varchar(255),
OUT p_transaction_id uuid,
OUT p_reference_number varchar,
OUT p_balance_after numeric(15,2),
OUT p_posted_at timestamptz
```

Steps, all inside one transaction:

1. **Idempotency check first, before the lock:** if `p_idempotency_key` is not NULL,
   `SELECT transaction_id, reference_number, balance_after, transaction_date FROM
   transaction WHERE idempotency_key = $1`. If found, **return the existing row's values
   and stop** — do not re-post. This must happen before acquiring the account lock, since
   a duplicate request should be cheap and non-blocking.
2. **Lock the account:** `SELECT current_balance, status FROM account WHERE account_id =
   $1 FOR UPDATE`.
3. **Re-validate inside the lock:** `status = 'ACTIVE'` (reject `409
   ACCOUNT_NOT_ACTIVE` otherwise); business-hours check against `system_parameter`/
   `business_calendar` (M1's data, BR-08) — re-check here, not just in the service layer,
   because the service's check happened before the lock and is therefore stale by the
   time this routine runs.
4. **Generate the reference:** `fn_next_transaction_reference()`.
5. **Insert the ledger row** with `balance_after = current_balance + p_amount`.
6. **Update `account.current_balance`.**
7. **Insert `audit_log`.**
8. Return the new transaction's values.

```sql
CREATE OR REPLACE PROCEDURE sp_post_deposit(
    p_account_id uuid,
    p_amount numeric(15,2),
    p_channel_id uuid,
    p_initiated_by_user_id uuid,
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
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT transaction_id, reference_number, balance_after, transaction_date
        INTO p_transaction_id, p_reference_number, p_balance_after, p_posted_at
        FROM transaction
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    SELECT current_balance, status INTO v_balance, v_status
    FROM account WHERE account_id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    -- Business-hours re-check against system_parameter/business_calendar goes here
    -- (call M1's helper once published; do not hardcode 08:30-16:30).

    p_reference_number := fn_next_transaction_reference();
    p_balance_after := v_balance + p_amount;
    p_posted_at := now();

    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        idempotency_key, balance_after
    ) VALUES (
        p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'DEPOSIT', p_amount, p_posted_at, p_narration,
        p_idempotency_key, p_balance_after
    ) RETURNING transaction_id INTO p_transaction_id;

    UPDATE account SET current_balance = p_balance_after, updated_at = now()
    WHERE account_id = p_account_id;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, after_value)
    VALUES (p_initiated_by_user_id, 'USER', 'transaction', p_transaction_id, 'DEPOSIT',
            jsonb_build_object('amount', p_amount, 'balance_after', p_balance_after));
END;
$$;
```

**Race note on the idempotency check:** the pre-lock read-then-insert has a narrow
race window if two identical retries arrive at the exact same instant — both could pass
the initial `SELECT` before either inserts. The partial unique index
(`ux_transaction_idempotency`, T01) is what actually closes this gap: catch `23505` on
that specific constraint in the calling service and re-fetch the row that won, rather
than trying to make the function itself perfectly race-free with more locking than it
needs.

---

## How to Implement

### Step 1 — Write the Migration
`database/migrations/0361_p03_m04_sp_post_deposit.sql`.

### Step 2 — Write SQL Tests
Create file: `tests/db/sp-post-deposit.test.mjs`

1. ✅ A valid deposit posts, `balance_after` and `account.current_balance` agree exactly
2. ✅ Depositing into an `INACTIVE`/`FROZEN`/`CLOSED` account → `ACCOUNT_NOT_ACTIVE`, no
   ledger row written
3. ✅ Repeating the exact same `idempotency_key` returns the **original** transaction's
   values — `balance_after` does not change, no second ledger row is created
4. ✅ Two deposits with `idempotency_key IS NULL` both post independently (no false
   dedup)
5. ✅ A deposit made outside configured business hours is rejected once M1's parameter
   check is wired in (if M1's helper isn't ready yet, write this test as a stub/TODO
   referencing the blocking task, don't skip documenting it)
6. ✅ **Atomicity**: force a failure after the ledger insert but before the balance
   update (e.g. inject a constraint violation in a test double) and confirm neither
   survives

### Step 3 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `sp_post_deposit`
- Update `docs/07_business-rules.md` — confirm BR-I1/FR-DEP-04 enforcement point
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Deposit locks the account row before deciding, and re-validates status inside the
      lock
- [ ] A repeated `idempotency_key` returns the original result with **no** second credit
- [ ] `balance_after` and `account.current_balance` always agree after a successful post
- [ ] A rejected deposit (inactive account) writes no ledger row
- [ ] `npm run db:rebuild` succeeds from empty
