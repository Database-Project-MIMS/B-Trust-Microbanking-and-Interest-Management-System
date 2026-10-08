# Handoff: P02-M01 RLS, audit coverage and branch scope

**From:** M1 (Nadija) → M2, M3, M4 · **Tasks:** P02-M01-T01/T02/T03

## What exists
| Migration | Content |
|---|---|
| `0200_p02_m01_audit_coverage.sql` | `fn_mask_audit_values`, upgraded `fn_audit_master_changes` (masks customer NIC/e-mail, records actor from `app.current_user_id`) |
| `0201_p02_m01_rls_policies.sql` | `fn_rls_*` helper functions (fail-closed) |
| `0261_p02_m01_rls_audit_bind.sql` | audit triggers on `customer`/`account`; RLS enabled + policies on both |

`0261` is outside M1's 0200–0219 block: 0200/0201 run before `customer` (0220) and `account`
(0240) exist. Recorded in `.agent/open-questions.md`. `database/roles/01_app_grants.sql` now
grants `SELECT, INSERT, UPDATE` on `customer` (no DELETE).

## Rules for every service touching `customer` / `account` as `mims_app`
RLS is **fail-closed**: with no context you see and write nothing. Inside `withTransaction`:

```ts
import { setRlsContext } from "@/lib/db/rls-context";
await setRlsContext(tx, { userId: user.userId, branchId: scope.branchId, roleName: user.roleName });
```
- Read: ADMIN/CENTRAL_OPS/AUDITOR bank-wide; AGENT/BRANCH_MANAGER own branch; CUSTOMER own customer row.
- Write: ADMIN/CENTRAL_OPS, or AGENT/BRANCH_MANAGER in own branch. AUDITOR is read-only.
- Still add `($N::uuid IS NULL OR branch_id = $N)` to route SQL (RLS is the backstop, not the filter).

## M3 TODO (account_holder not yet present at 0261)
In the `account_holder` migration add:
```sql
CREATE TRIGGER trg_audit_account_holder AFTER INSERT OR UPDATE OR DELETE ON account_holder
  FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();
CREATE POLICY account_select_customer_own ON account FOR SELECT USING (
  fn_rls_role() = 'CUSTOMER' AND EXISTS (SELECT 1 FROM account_holder ah
    JOIN customer c ON c.customer_id = ah.customer_id
    WHERE ah.account_id = account.account_id AND c.app_user_id = fn_rls_user_id()));
```
The audit function already resolves `holder_id`/`account_holder_id`; adjust if the PK differs.

## Edits to other members' files (minimal, RLS fallout)
- `services/customer-document-service.ts`: uses `setRlsContext` (adds role).
- `tests/db/customer-constraints.test.mjs`: grant expectation updated (read/insert true, delete false).
- `tests/db/transaction-immutability.test.mjs`: fixture account created under ADMIN context.

## T03 status
`/api/customers` and `/api/accounts` do not exist yet. Contract + SQL-predicate test are in
`tests/db/rls-audit.test.mjs`; M2/M3 must add route-level tests when routes land.
