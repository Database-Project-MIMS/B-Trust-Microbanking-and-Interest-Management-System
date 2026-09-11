# 🔴 Phase 1 — Task 03: RBAC, Branch Scope & CSRF (CRITICAL PATH)
**Task ID:** `P01-M01-T03` · **Branch:** `feat/p01-m01-rbac`  
**Status:** READY · **Depends on:** P01-M01-T02  
**Story Points:** ~3 · **Layer:** Backend only  
**⚡ Publishes Integration Point I-1 — ALL 4 OTHER MEMBERS WAIT ON THIS**

---

## What This Task Is

Build the authorization middleware that every route in the entire system will use. This is the **most critical** task in Phase 1 — ship it early and publish the helper signatures in a handoff BEFORE you finish implementing.

---

## Files to Create

| File | Purpose |
|---|---|
| `lib/auth/rbac.ts` | `requireUser()`, `requireRole()`, `branchScope()` |
| `lib/auth/csrf.ts` | CSRF token issue and verify |
| `tests/api/authorization.test.mjs` | Authorization and scope tests |
| `.agent/handoffs/i1-rbac-helpers.md` | **Handoff: publish signatures for other members** |

---

## How to Implement

### Step 1 — `requireUser()` (Session Validation Middleware)

```typescript
// Reads the session cookie, validates against user_session table
// Returns the authenticated user object or throws 401
export async function requireUser(request: Request): Promise<AuthenticatedUser>

interface AuthenticatedUser {
  userId: string;
  username: string;
  roleId: string;
  roleName: string;
  branchId: string | null;  // null for bank-wide roles
}
```

### Step 2 — `requireRole(...roles)` (Role Authorization)

```typescript
// Checks that the authenticated user has one of the specified roles
// Throws 403 if denied
export function requireRole(
  user: AuthenticatedUser, 
  ...allowedRoles: string[]
): void

// Usage in a route handler:
const user = await requireUser(request);
requireRole(user, 'ADMIN', 'BRANCH_MANAGER');
```

### Step 3 — `branchScope()` (Branch Scope Enforcement)

This is the key security function. It returns a scope object that services apply **inside the SQL WHERE clause**.

```typescript
// Returns { branchId: uuid | null }
// null = bank-wide (ADMIN, CENTRAL_OPS, AUDITOR)
// uuid = restricted to that branch (BRANCH_MANAGER, AGENT)
export function branchScope(user: AuthenticatedUser): BranchScope

interface BranchScope {
  branchId: string | null;
}
```

**How to use in SQL:**
```sql
-- The IS NULL guard means bank-wide roles see everything
SELECT * FROM account 
WHERE ($1::uuid IS NULL OR branch_id = $1)
```

**WRONG way (never do this):**
```typescript
// ❌ Fetching all rows and filtering in JavaScript
const all = await query("SELECT * FROM account");
return all.filter(a => a.branch_id === user.branchId);
```

### Step 4 — CSRF Protection

```typescript
// Issue: generate a token, set it as a cookie
export function issueCsrfToken(response: Response): string

// Verify: check the request header/body against the cookie
export function verifyCsrf(request: Request): void  // throws 403 if invalid
```

**Rules:**
- All state-changing routes (POST, PATCH, DELETE) require CSRF
- Token in a `Secure`/`SameSite=Lax` cookie
- Verified from the `X-CSRF-Token` header or a form field

### Step 5 — Write the Handoff FIRST (Before Finishing Implementation!)

Create `.agent/handoffs/i1-rbac-helpers.md`:

```markdown
# Integration Point I-1: RBAC Helpers

## Published Signatures

### requireUser(request) → AuthenticatedUser
### requireRole(user, ...roles) → void (throws 403)
### branchScope(user) → { branchId: string | null }
### verifyCsrf(request) → void (throws 403)

## How other members use these:
1. Import from 'lib/auth/rbac'
2. Call requireUser() first in every route handler
3. Call requireRole() with the allowed roles
4. Pass branchScope() to your service function
5. Use branchId in your SQL WHERE clause
6. Call verifyCsrf() for all POST/PATCH/DELETE
```

**⚠️ Publish this handoff EARLY so other members can start their API work!**

### Step 6 — Write Tests (`tests/api/authorization.test.mjs`)

| Test | What it verifies |
|---|---|
| Correct role → access granted | Basic RBAC |
| Wrong role → `403` | Role denial |
| No session → `401` | Authentication required |
| Cross-branch access denied (even when URL/body is edited) | AC-11 |
| State change without CSRF token → `403` | NFR-SEC-04 |
| Bank-wide role sees all branches | Scope correctness |
| Branch-scoped role sees only own branch | Scope correctness |

### Step 7 — Update Docs
- Update `docs/15_security-and-rbac.md` with implementation details
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Scope is applied in SQL, never by filtering an already-fetched array
- [ ] Role denied → `403`
- [ ] Cross-branch access denied → `403` (even if URL is tampered)
- [ ] CSRF token required for state changes
- [ ] Handoff published with signatures before implementation complete
