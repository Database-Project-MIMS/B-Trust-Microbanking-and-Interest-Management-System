# 🟡 Phase 2 — Member 1 Tasks: RLS, Audit Coverage & Branch Scope
**Task IDs:** `P02-M01-T01`, `P02-M01-T02`, `P02-M01-T03`  
**Migration Block:** `0200–0219`  
**Depends on:** P01-M01-T03 (RBAC), P02-M02-T01 (customer schema), P02-M03-T01 (account schema)  
**Story Points:** ~6 total · **Layer:** Database + Backend + Tests

---

## Overview

In Phase 2, you build the **security backstop** for the new customer and account tables that M2 and M3 create. Three tasks:

---

## Task 1: RLS Policies (`P02-M01-T01`)
**Branch:** `feat/p02-m01-rls-policies`  
**Depends on:** P01-M01-T03, P02-M02-T01, P02-M03-T01

### What to Do
Create Row Level Security (RLS) policies on `customer` and `account` tables. RLS is the **database-level backstop** — it holds even if the application has a bug.

### How to Implement

**Migration file:** `0200_p02_m01_rls_policies.sql`

```sql
-- Enable RLS on tables
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;

-- Policy: branch-scoped users see only their branch
CREATE POLICY branch_scope_customer ON customer
    USING (
        current_setting('app.current_branch_id', true)::uuid IS NULL  -- bank-wide
        OR branch_id = current_setting('app.current_branch_id', true)::uuid
    );

CREATE POLICY branch_scope_account ON account
    USING (
        current_setting('app.current_branch_id', true)::uuid IS NULL
        OR branch_id = current_setting('app.current_branch_id', true)::uuid
    );

-- Policy: CUSTOMER role sees only accounts they hold
CREATE POLICY customer_own_accounts ON account
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) != 'CUSTOMER'
        OR account_id IN (
            SELECT ah.account_id FROM account_holder ah
            WHERE ah.customer_id = current_setting('app.current_user_id', true)::uuid
        )
    );
```

**In services:** Set session variables at the start of each transaction:
```sql
SET LOCAL app.current_user_id = $1;
SET LOCAL app.current_branch_id = $2;
SET LOCAL app.current_user_role = $3;
```

### Tests
- Cross-branch customer read → fails via RLS (even bypassing the app)
- Cross-branch account read → fails via RLS
- CUSTOMER can only see accounts they hold
- Bank-wide role can see all rows

---

## Task 2: Audit Coverage (`P02-M01-T02`)
**Branch:** `feat/p02-m01-audit-coverage`  
**Depends on:** P01-M01-T05

### What to Do
Extend audit trigger coverage to customer and account creation events.

### How to Implement

Attach `trg_audit_master_changes` to:
- `customer` table (INSERT, UPDATE)
- `account` table (INSERT, UPDATE)
- `account_holder` table (INSERT, UPDATE, DELETE)

**Important:** Sensitive customer data (NIC, email) must be **masked** in audit `old_values`/`new_values`:
```typescript
// Mask sensitive fields before writing to audit_log
function maskSensitive(values: Record<string, unknown>) {
  if (values.nic_passport_no) {
    values.nic_passport_no = '****' + values.nic_passport_no.slice(-4);
  }
  if (values.email) {
    values.email = values.email[0] + '***@***';
  }
  return values;
}
```

---

## Task 3: Branch-Scope Enforcement on Routes (`P02-M01-T03`)
**Branch:** `feat/p02-m01-branch-scope-routes`  
**Depends on:** P02-M02-T02

### What to Do
Ensure the customer and account API routes (created by M2 and M3) apply branch scope **in the SQL WHERE clause**.

### How to Implement
Review and test that M2's `/api/customers` and M3's `/api/accounts` routes:
1. Call `requireRole()` 
2. Call `branchScope()` to get the scope
3. Pass `scope.branchId` to the SQL query as `$N`
4. SQL includes `($N::uuid IS NULL OR branch_id = $N)`

### Tests
| Test | What it verifies |
|---|---|
| Branch manager queries customers → sees only own branch | Scope enforcement |
| Branch manager queries accounts → sees only own branch | Scope enforcement |
| Editing URL/body to another branch ID → still denied | AC-11 |
| ADMIN/CENTRAL_OPS → sees all branches | Bank-wide scope |

---

## Acceptance Criteria (All 3 tasks)
- [ ] RLS prevents cross-branch reads when the app layer is bypassed
- [ ] Customer and account creation generate audit events
- [ ] Sensitive data is masked in audit logs
- [ ] Branch scope is applied in SQL, never as post-fetch filtering
- [ ] Cross-branch access denied even with URL tampering
