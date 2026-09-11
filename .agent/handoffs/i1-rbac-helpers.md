# Integration Point I-1: RBAC Helpers

**Published by:** Member 1 — Nadija  
**Status:** READY — import and use these in all your route handlers.

---

## Import

```typescript
import { requireUser, requireRole, branchScope, AuthenticatedUser, BranchScope } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
```

## Functions

### `requireUser(request)` ? `AuthenticatedUser`
Call this **first** in every route handler. Returns the logged-in user or throws 401.

### `requireRole(user, ...roles)` ? `void` (throws 403)
Call after `requireUser`. Pass the allowed role names.

### `branchScope(user)` ? `{ branchId: string | null }`
Pass this into your service. Use `branchId` inside SQL:
```sql
WHERE ($1::uuid IS NULL OR branch_id = $1)
```
`null` = bank-wide (ADMIN sees all). UUID = restricted to that branch.

### `verifyCsrf(request)` ? `void` (throws 403)
Call on all POST / PATCH / DELETE routes **before** doing any DB work.

---

## Example Route Handler

```typescript
import { requireUser, requireRole, branchScope } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";

export async function POST(request: NextRequest) {
  try {
    verifyCsrf(request);                          // 1. CSRF check
    const user = await requireUser(request);       // 2. Auth check
    requireRole(user, "BRANCH_MANAGER", "ADMIN"); // 3. Role check
    const scope = branchScope(user);              // 4. Get scope

    // 5. Pass scope to your service
    const result = await myService.doSomething(scope.branchId);
    return NextResponse.json({ data: result });

  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
```
