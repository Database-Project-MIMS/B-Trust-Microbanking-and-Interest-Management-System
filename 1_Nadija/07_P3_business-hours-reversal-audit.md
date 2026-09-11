# 🟡 Phase 3 — Member 1 Tasks: Business Hours, Reversal Auth & Financial Audit
**Task IDs:** `P03-M01-T01`, `P03-M01-T02`, `P03-M01-T03`  
**Migration Block:** `0300–0319`  
**Story Points:** ~8 total · **Layer:** Database + Backend + Tests

---

## Overview

Phase 3 is the financial transactions phase — the most important for grading. Your job: enforce business hours/limits from data, authorize reversals (manager-only), and ensure every financial operation writes audit events.

---

## Task 1: Business Hours & Withdrawal Limits (`P03-M01-T01`)
**Branch:** `feat/p03-m01-business-hours-limits`  
**Depends on:** P01-M01-T05

### What to Do
Make `fn_is_business_hour()` callable from deposit/withdrawal paths, and enforce withdrawal limits from `system_parameter`.

### How to Implement

#### Backend Service
```typescript
// services/business-rules-service.ts

export async function checkBusinessHours(): Promise<void> {
  const result = await query(
    "SELECT fn_is_business_hour(now()) AS is_open"
  );
  if (!result.rows[0].is_open) {
    throw new OutsideBusinessHoursError();
  }
}

export async function checkWithdrawalLimits(
  accountId: string, 
  amount: string  // money as string!
): Promise<void> {
  const singleLimit = await getParameter('WITHDRAWAL_SINGLE_LIMIT');
  const dailyLimit = await getParameter('WITHDRAWAL_DAILY_LIMIT');
  
  // Check single transaction limit
  if (parseFloat(amount) > parseFloat(singleLimit)) {
    throw new LimitExceededError('single', singleLimit);
  }
  
  // Check daily total (computed inside the locked transaction!)
  const dailyTotal = await query(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transaction
    WHERE account_id = $1
      AND transaction_type = 'WITHDRAWAL'
      AND transaction_date::date = CURRENT_DATE
  `, [accountId]);
  
  // Note: this check must happen INSIDE sp_post_withdrawal, after the lock
}
```

**Important:** These checks must happen **inside the transaction**, after `FOR UPDATE` lock. Checking before the lock is a race condition!

### Tests
| Test | What it verifies |
|---|---|
| Deposit during business hours → allowed | Happy path |
| Deposit outside business hours → `409 OUTSIDE_BUSINESS_HOURS` | BR-08 |
| Withdrawal over single limit → `409 LIMIT_EXCEEDED` | BR-I2 |
| Withdrawal over daily limit → `409 LIMIT_EXCEEDED` | BR-I2 |
| Limits are read from `system_parameter`, not hardcoded | Data-driven |

---

## Task 2: Manager-Only Reversal Authorization (`P03-M01-T02`)
**Branch:** `feat/p03-m01-reversal-auth`  
**Depends on:** P03-M04-T04 (M4's reversal procedure)

### What to Do
Ensure that **only BRANCH_MANAGER** (or ADMIN) can reverse a transaction. Agents cannot.

### How to Implement

In the reversal route handler (`app/api/transactions/[id]/reverse/route.ts`):
```typescript
export async function POST(request: Request, { params }) {
  const user = await requireUser(request);
  requireRole(user, 'BRANCH_MANAGER', 'ADMIN');
  verifyCsrf(request);
  
  const scope = branchScope(user);
  // Verify the transaction belongs to the user's branch
  // Then call sp_reverse_transaction
}
```

### Tests
| Test | What it verifies |
|---|---|
| BRANCH_MANAGER reverses → `200` | Happy path |
| ADMIN reverses → `200` | Admin can too |
| AGENT attempts reversal → `403` | Explicitly denied |
| CUSTOMER attempts reversal → `403` | Explicitly denied |
| Cross-branch reversal → `403` | Branch scope check |

---

## Task 3: Audit Events for Financial Operations (`P03-M01-T03`)
**Branch:** `feat/p03-m01-financial-audit`  
**Depends on:** P03-M04-T02 (M4's deposit procedure)

### What to Do
Every financial operation must write an audit event — deposits, withdrawals, reversals, and even **rejected** operations.

### How to Implement

Create audit event writers for each operation:

```typescript
// Called by M4's posting services

export async function auditDeposit(params: {
  userId: string;
  accountId: string;
  transactionId: string;
  amount: string;
  balanceAfter: string;
  ipAddress: string;
}): Promise<void> {
  await writeAuditEvent({
    userId: params.userId,
    actorType: 'USER',
    entityType: 'transaction',
    entityId: params.transactionId,
    action: 'DEPOSIT',
    newValues: {
      account_id: params.accountId,
      amount: params.amount,
      balance_after: params.balanceAfter,
    },
    ipAddress: params.ipAddress,
  });
}

// Similar for WITHDRAWAL, REVERSAL, REJECTED_WITHDRAWAL
```

**Key rule:** A rejected withdrawal creates an audit event but **no ledger row** (FR-WD-05, BR-L1).

### Tests
| Test | What it verifies |
|---|---|
| Deposit → audit event with amount and balance | FR-AUD-01 |
| Withdrawal → audit event | FR-AUD-01 |
| Rejected withdrawal → audit event, NO ledger row | FR-WD-05 |
| Reversal → audit event with reason | FR-AUD-01 |
| Interest credit → audit event with `actor_type = 'SYSTEM'` | G-22 |

---

## Acceptance Criteria (All 3 tasks)
- [ ] Business hours enforced from `system_parameter` / `business_calendar`, not hardcoded
- [ ] Withdrawal limits enforced from `system_parameter`
- [ ] Only BRANCH_MANAGER and ADMIN can reverse
- [ ] Every financial operation has an audit event
- [ ] Rejected withdrawals have audit events but no ledger rows
