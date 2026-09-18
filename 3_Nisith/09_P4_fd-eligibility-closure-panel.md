# 🟠 Phase 4 — Tasks 01–03: FD Eligibility, Account Closure & FD Panel
**Task IDs:** `P04-M03-T01`, `P04-M03-T02`, `P04-M03-T03`
**Branch:** `feat/p04-m03-fd-eligibility-closure-panel`
**Status:** TODO
**Depends on:** `P04-M05-T02` (M5's `sp_open_fixed_deposit`, for T01);
`P04-M05-T03` (M5's `fn_calculate_fd_interest`, context for T03)
**Story Points:** ~3 + ~2 + ~2 = ~7 · **Layer:** Database + Backend + Frontend

---

## What This Task Is

Three small, related pieces that all sit on the account side of the FD relationship:
publish the eligibility check M5's FD-opening routine relies on (**I-6**, you are the
producer), enforce the account closure rule (BR-18), and add a read-only FD panel to the
account detail page.

---

## T01 — Account-Side FD Eligibility — Publishes I-6

### `fn_check_account_fd_eligible(p_account_id uuid) RETURNS boolean`

```sql
CREATE OR REPLACE FUNCTION fn_check_account_fd_eligible(
    p_account_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_status varchar(20);
BEGIN
    SELECT status INTO v_status FROM account WHERE account_id = p_account_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN v_status = 'ACTIVE';
END;
$$;
```

**Contract for M5 (write this into the handoff verbatim):**
- M5's `sp_open_fixed_deposit` must `SELECT status, current_balance FROM account WHERE
  account_id = $1 FOR UPDATE` **first** — lock before deciding — then call
  `fn_check_account_fd_eligible(account_id)` and separately compare
  `current_balance >= principal_amount`.
- `false` → `409 ACCOUNT_NOT_ACTIVE`; insufficient balance → `409 INSUFFICIENT_FUNDS`.
  These are two distinct checks — do not collapse them into one function, since they map
  to two different error codes in `docs/05_api-and-pages.md`.
- The one-active-FD-per-account constraint itself (`fixed_deposit` partial unique index,
  G-01) is M5's own table's job, not yours — you only own the account-status/balance
  read contract.

---

## T02 — Account Closure Rule (BR-18)

### `sp_close_account(p_account_id uuid, p_actor_user_id uuid)`

```sql
CREATE OR REPLACE PROCEDURE sp_close_account(
    p_account_id uuid,
    p_actor_user_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance numeric(15,2);
    v_active_fd_count int;
BEGIN
    SELECT current_balance INTO v_balance
    FROM account WHERE account_id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_balance <> 0 THEN
        RAISE EXCEPTION 'BALANCE_NOT_ZERO' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_active_fd_count
    FROM fixed_deposit WHERE account_id = p_account_id AND status = 'ACTIVE';

    IF v_active_fd_count > 0 THEN
        RAISE EXCEPTION 'ACTIVE_FD_EXISTS' USING ERRCODE = 'P0001';
    END IF;

    UPDATE account SET status = 'CLOSED', updated_at = now() WHERE account_id = p_account_id;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, before_value, after_value)
    VALUES (p_actor_user_id, 'USER', 'account', p_account_id, 'CLOSE',
            jsonb_build_object('status', 'ACTIVE'), jsonb_build_object('status', 'CLOSED'));
END;
$$;
```

Now go back and finish `POST /api/accounts/{id}/close` (stubbed in Phase 2, T05) —
`services/account-service.ts`: `closeAccount(accountId, actor)` calling this procedure,
mapped to `409 BALANCE_NOT_ZERO` / `409 ACTIVE_FD_EXISTS`.

---

## T03 — FD Panel on the Account Detail Page

Extend `app/accounts/[id]/page.tsx` (Phase 2/3 work) with a read-only FD section:
- List of FDs on this account (principal, rate at opening, maturity date, status) —
  source the data from M5's `fixed_deposit` table or the linkage view M2 built
  (`vw_customer_fd_summary`, Phase 4 M2 task) if it's easier to reuse than a fresh query
- "Open FD" button linking to `/fixed-deposits/new?accountId=...` (M5's page) — you are
  not building the FD opening UI itself, only linking to it
- If an active FD exists, visually indicate that closure is blocked (supports the T02
  rule without the user having to hit the error first)

---

## How to Implement

### Step 1 — Confirm M5's Dependency for T01
```bash
grep -n "P04-M05-T02" docs/09_task-tracker.md
```

### Step 2 — Write the Migrations
`database/migrations/0440_p04_m03_fn_check_account_fd_eligible.sql`,
`0441_p04_m03_sp_close_account.sql`.

### Step 3 — Write SQL Tests
`tests/db/fn-check-account-fd-eligible.test.mjs`:
1. ✅ `ACTIVE` account → `true`; `FROZEN`/`CLOSED` → `false`; non-existent → `false`

`tests/db/sp-close-account.test.mjs`:
1. ✅ Closing an account with zero balance and no active FD succeeds, sets `status =
   'CLOSED'`, writes audit
2. ✅ Closing with a non-zero balance → `BALANCE_NOT_ZERO`, status unchanged
3. ✅ Closing with an active FD → `ACTIVE_FD_EXISTS`, status unchanged
4. ✅ A matured/closed FD does **not** block closure (only `status = 'ACTIVE'` FDs do)

### Step 4 — Backend & Frontend
1. `services/account-service.ts`: `closeAccount()`
2. `app/api/accounts/[id]/close/route.ts`: replace the Phase 2 stub
3. FD panel on the detail page

### Step 5 — Write Tests
- `tests/api/account-closure.test.mjs`: `409 BALANCE_NOT_ZERO`, `409 ACTIVE_FD_EXISTS`,
  success case; non-`BRANCH_MANAGER` → `403`
- `tests/e2e/account-closure.test.mjs`: attempt closure with a balance, see the error;
  withdraw to zero, close successfully

### Step 6 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 7 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add both routines
- Update `docs/07_business-rules.md` — confirm BR-18's enforcement point is this
  procedure, not just the service
- Publish `.agent/handoffs/i-6-fn-check-account-fd-eligible.md` for M5
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] I-6 handoff published before M5's FD-opening task depends on it
- [ ] Closure is rejected for non-zero balance and for any active FD, each with its own
      error code
- [ ] Closure is a real `sp_close_account` call, not a bare `UPDATE` in the service layer
- [ ] FD panel renders on the account detail page and links to FD opening
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
