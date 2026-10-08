# Handoff: P03-M01-T01 → M4 (`sp_post_withdrawal`)

**From:** Member 1 (Nadija) · `P03-M01-T01`  
**To:** Member 4 (Pramudith) · `P03-M04-T03` (`sp_post_withdrawal`)  
**Date:** 2026-10-08  
**Branch:** `feat/p02-m01-branch-scope-routes` (not yet merged; M4 should wait for dev integration)

---

## What was delivered

Migration `0300_p03_m01_business_rules_helpers.sql` adds three database functions:

| Function | Returns | Purpose |
|---|---|---|
| `fn_get_parameter(key varchar)` | `varchar \| null` | Reads one `system_parameter` value by key. STABLE. |
| `fn_check_business_hours(check_ts timestamptz DEFAULT now())` | `boolean` | Delegates to `fn_is_business_hour`. `false` → reject with `OUTSIDE_BUSINESS_HOURS`. |
| `fn_check_withdrawal_single_limit(amount numeric(15,2))` | `boolean` | `false` when `amount > WITHDRAWAL_SINGLE_LIMIT`. `false` for NULL. |
| `fn_check_withdrawal_daily_limit(account_id uuid, amount numeric(15,2))` | `boolean` | `false` when today's withdrawals + `amount > WITHDRAWAL_DAILY_LIMIT`. Uses Asia/Colombo date. `false` for NULL inputs. |

TypeScript service `services/business-rules-service.ts` exports:

```typescript
// Call OUTSIDE the locked transaction (standalone check, e.g. for deposits at the route layer)
enforceBusinessHours(): Promise<void>
  // throws BusinessRuleError('OUTSIDE_BUSINESS_HOURS', ..., 409)

// Call INSIDE the locked transaction (after SELECT … FOR UPDATE, before ledger INSERT)
enforceWithdrawalLimits(tx, accountId, amount): Promise<void>
  // throws BusinessRuleError('SINGLE_LIMIT_EXCEEDED', ..., 409)
  // throws BusinessRuleError('DAILY_LIMIT_EXCEEDED',  ..., 409)

// Utility
getParameter(key): Promise<string | null>
```

---

## Call order contract for `sp_post_withdrawal` (P03-M04-T03)

```sql
-- Inside sp_post_withdrawal, after acquiring the row lock:
SELECT current_balance, status FROM account WHERE account_id = $1 FOR UPDATE;

-- 1. Check business hours (BR-08)
IF NOT fn_check_business_hours(now()) THEN
    RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS'
        USING ERRCODE = 'P0001', CONSTRAINT = 'ck_withdrawal_business_hours';
END IF;

-- 2. Check single-transaction limit (BR-I2)
IF NOT fn_check_withdrawal_single_limit(p_amount) THEN
    RAISE EXCEPTION 'SINGLE_LIMIT_EXCEEDED'
        USING ERRCODE = 'P0001', CONSTRAINT = 'ck_withdrawal_single_limit';
END IF;

-- 3. Check daily cumulative limit (BR-I2) — must be AFTER locking the account
IF NOT fn_check_withdrawal_daily_limit(p_account_id, p_amount) THEN
    RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED'
        USING ERRCODE = 'P0001', CONSTRAINT = 'ck_withdrawal_daily_limit';
END IF;

-- 4. Check minimum balance (I-4, M3)
IF NOT fn_check_plan_minimum(p_account_id, v_balance - p_amount) THEN
    RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE'
        USING ERRCODE = 'P0001', CONSTRAINT = 'ck_withdrawal_min_balance';
END IF;

-- 5. Check mandate (I-4, M3)
-- fn_check_withdrawal_mandate(p_account_id, p_signer_customer_ids)

-- 6. Insert ledger row
-- 7. Update account balance
-- 8. Insert audit_log row
```

---

## Error codes for M4's `throwTransactionDatabaseError` mapping

Add these constraint names to the error mapping in `services/account-errors.ts` (or a new `transaction-errors.ts`):

| Constraint name | Code | Message | Status |
|---|---|---|---|
| `ck_withdrawal_business_hours` | `OUTSIDE_BUSINESS_HOURS` | "Withdrawals can only be processed during business hours." | 409 |
| `ck_withdrawal_single_limit` | `SINGLE_LIMIT_EXCEEDED` | "Withdrawal exceeds the single-transaction limit." | 409 |
| `ck_withdrawal_daily_limit` | `DAILY_LIMIT_EXCEEDED` | "This withdrawal would exceed the daily withdrawal limit." | 409 |
| `ck_withdrawal_min_balance` | `BELOW_MINIMUM_BALANCE` | "Withdrawal would leave the account below the plan minimum." | 409 |
| `ck_withdrawal_mandate` | `MANDATE_NOT_SATISFIED` | "The withdrawal does not satisfy the account's operating mandate." | 409 |

---

## TypeScript service call from `sp_post_withdrawal`'s TypeScript wrapper

If M4 wraps the procedure call in a TypeScript service (like `account-service.ts` does for `sp_open_savings_account`), call `enforceWithdrawalLimits` **inside** the `withTransaction` callback, after the account lock and before calling the procedure:

```typescript
import { enforceWithdrawalLimits } from '@/services/business-rules-service';

// Inside withTransaction callback, after resolveScope:
await enforceWithdrawalLimits(tx, accountId, amount);
// Then call CALL sp_post_withdrawal(...)
```

---

## What is NOT unblocked

- `P03-M01-T02` (reversal authorization) still depends on `P03-M04-T04` (`sp_reverse_transaction`) — not yet implemented.
- `P03-M01-T03` (financial audit events) depends on `P03-M01-T02`.
