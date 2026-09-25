# 🟡 Phase 3 — Tasks 02–03: Joint-Mandate Validation & Balance Panel
**Task IDs:** `P03-M03-T02`, `P03-M03-T03` · **Branch:** `feat/p03-m03-mandate-validation-balance-panel`
**Status:** TODO
**Depends on:** `P02-M03-T03` (`joint_mandate`); T03 depends on `P03-M04-T02` (M4's
`sp_post_deposit` — the account detail page needs live transaction data to show a
meaningful balance panel)
**Story Points:** ~3 + ~2 = ~5 · **Layer:** Database + Backend

> ⚡ **UI COMPLETE** — The account detail and balance panel screens are pre-built in
> `app/dashboard/**`. Your job is to implement the **database function** and publish the
> I-4 integration point. Do not rebuild any UI component.

---

## What This Task Is

T02 is the mandate side of the same story as T01 (`fn_check_plan_minimum`) — a callable
check M4's `sp_post_withdrawal` uses, this time for joint-account authority. T03 is a UI
panel showing balance and who is authorised to act on an account.

---

## T02 — Joint-Mandate Validation for Withdrawal (BR-17)

### `fn_check_joint_mandate(p_account_id uuid, p_requesting_customer_id uuid) RETURNS boolean`

```sql
CREATE OR REPLACE FUNCTION fn_check_joint_mandate(
    p_account_id uuid,
    p_requesting_customer_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_mandate joint_mandate%ROWTYPE;
    v_is_holder boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM account_holder
        WHERE account_id = p_account_id AND customer_id = p_requesting_customer_id
    ) INTO v_is_holder;

    IF NOT v_is_holder THEN
        RETURN false;
    END IF;

    SELECT * INTO v_mandate FROM joint_mandate WHERE account_id = p_account_id;

    IF NOT FOUND THEN
        -- No mandate row means this is not a joint account; a single holder always has authority.
        RETURN true;
    END IF;

    IF v_mandate.mandate_type = 'ANY_ONE' THEN
        RETURN true;  -- requester is already confirmed to be a holder
    END IF;

    -- ALL_HOLDERS: this function alone cannot confirm every signatory signed off on
    -- THIS specific withdrawal request — it can only confirm the requester is an
    -- authorised holder. If ALL_HOLDERS truly requires multi-party sign-off captured
    -- per transaction, that needs its own request/approval table — raise this as an
    -- open question if the SRS expects synchronous multi-signature withdrawals rather
    -- than a per-branch-visit authorisation model.
    RETURN true;
END;
$$;
```

**Important:** read BR-17 and §4.4/§7.1 carefully before finalizing this function's
`ALL_HOLDERS` branch. The critical acceptance test is *"Joint withdrawal without mandate
→ rejected and audited without ledger effect"* — confirm with the team whether
`ALL_HOLDERS` in this project means "any listed holder may withdraw, but the account
requires more than one holder to exist" (in which case the function above is complete)
or "a withdrawal transaction must itself carry multiple signatory confirmations" (in
which case you need a small `withdrawal_signatory` capture mechanism, which is a bigger
addition — don't invent it without confirming the scope first; raise it in
`.agent/open-questions.md` if it's ambiguous).

**Contract for M4:** call `fn_check_joint_mandate(account_id, requesting_customer_id)`
inside `sp_post_withdrawal`, after the row lock, alongside `fn_check_plan_minimum`.
Returns `false` → `409 MANDATE_NOT_SATISFIED`, no ledger row.

---

> **Note:** T03's original scope was to build a balance panel UI. Since the account
> detail UI is pre-built, T03's deliverable is narrowed to: ensure
> `GET /api/accounts/{id}` returns `currentBalance`, `holders` (with `holder_type`), and
> `mandateType` in the JSON response so the pre-built screen can render them correctly.
> This is a backend-only change — add or adjust the fields in `getAccountDetail()` in
> `services/account-service.ts` (M3's file) if they are missing.

---

## How to Implement

### Step 1 — Write the Migration (T02)
`database/migrations/0341_p03_m03_fn_check_joint_mandate.sql`.

### Step 2 — Write SQL Tests (T02)
`tests/db/fn-check-joint-mandate.test.mjs`:
1. ✅ A non-holder requesting on any account → `false`
2. ✅ A holder on an individual account (no mandate row) → `true`
3. ✅ A holder on an `ANY_ONE` joint account → `true`
4. ✅ Whatever the team confirms for `ALL_HOLDERS` — write the test to match the
   confirmed contract, not a guess

### Step 3 — Verify API Response (T03)
Confirm `GET /api/accounts/{id}` returns:
- `currentBalance` — live, from the `account.current_balance` column
- `holders` — array with `customerId`, `holderType`
- `mandateType` — `ANY_ONE` | `ALL_HOLDERS` | `null` for individual accounts

If these fields are absent, add them to `getAccountDetail()` in `services/account-service.ts`.

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 5 — Update Docs
- Update `docs/16_database-routines-views-indexes.md` — add `fn_check_joint_mandate`
- Update `docs/07_business-rules.md` — confirm BR-17's enforcement point
- Publish/refresh the I-4 handoff to include this function alongside `fn_check_plan_minimum`
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] `fn_check_joint_mandate` matches the team-confirmed interpretation of `ALL_HOLDERS`
- [ ] A non-holder is always rejected, regardless of mandate type
- [ ] Handoff updated so M4's withdrawal routine can call both plan-minimum and
      mandate checks from one documented source
- [ ] `GET /api/accounts/{id}` returns `currentBalance`, `holders`, and `mandateType`
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
