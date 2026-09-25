# 🔵 Phase 1 — Task 04: Sign-in API Integration & Application Shell
**Task ID:** `P01-M01-T04` · **Branch:** `feat/p01-m01-app-shell`  
**Status:** READY · **Depends on:** P01-M01-T02  
**Story Points:** ~2 · **Layer:** Backend + Session wiring  
**📌 Shared file — M1 owns the app shell, everyone uses it**

> ⚡ **UI COMPLETE** — All sign-in pages and the app shell have been pre-built and live in
> `app/sign-in/**` and `components/app-shell/**`. Your job is to wire the **backend session**
> into them: make `/api/auth/login` set the cookie, make the shell read it, and make
> `/api/auth/logout` invalidate it. Do not rebuild any UI component.

---

## What This Task Is

Connect the pre-built sign-in UI to the real session backend. The shell already renders
role-aware navigation items — you must make `requireRole()` / `branchScope()` available
so route handlers and server components can enforce authorization.

---

## Files to Create / Edit (Backend Only)

| File | Purpose |
|---|---|
| `app/api/auth/login/route.ts` | Validate credentials, create session, set `HttpOnly` cookie |
| `app/api/auth/logout/route.ts` | Invalidate session server-side, clear cookie |
| `lib/auth/session.ts` | Read session from cookie; expose typed `AuthContext` |
| `lib/auth/rbac.ts` | `requireRole()`, `branchScope()` — **publishes I-1** |
| `lib/auth/password.ts` | `verifyPassword()` wrapper around `argon2id` |
| `tests/e2e/sign-in.test.mjs` | End-to-end sign-in test |

---

## How to Implement

### Step 1 — Login Route (`app/api/auth/login/route.ts`)

```typescript
// POST /api/auth/login
// Body: { username: string, password: string }
// → 200 + Set-Cookie on success
// → 401 INVALID_CREDENTIALS on failure
// → 429 TOO_MANY_ATTEMPTS if login_attempt threshold exceeded
```

- Look up `app_user` by username
- `verifyPassword(body.password, user.password_hash)`
- On success: insert into `user_session`; set `Secure HttpOnly SameSite=Lax` cookie
- On failure: increment `login_attempt`; never reveal whether the username exists

### Step 2 — Session Helpers (`lib/auth/`)

```typescript
// lib/auth/session.ts
export async function getSession(req: NextRequest): Promise<AuthContext | null>

// lib/auth/rbac.ts
/** Throws NotAuthorizedError if the caller's role is not in allowedRoles. */
export function requireRole(ctx: AuthContext, allowedRoles: Role[]): void

/** Returns a SQL snippet + params that scope a query to the caller's branch. */
export function branchScope(ctx: AuthContext): { sql: string; params: unknown[] }
```

Publish the signatures in `.agent/handoffs/i1-rbac-published.md` as **I-1** once done.

### Step 3 — Logout Route (`app/api/auth/logout/route.ts`)

```typescript
// POST /api/auth/logout
// → Marks user_session as revoked; clears cookie
```

### Step 4 — Wire the Shell

The `components/app-shell/top-bar.tsx` already renders navigation. Make
`app/dashboard/layout.tsx` (or similar) read the session via `getSession()` and redirect
to `/sign-in` if null. Pass the `AuthContext` as a prop so the shell can display the
username, role badge, and branch name.

### Step 5 — Write Tests (`tests/e2e/sign-in.test.mjs`)

| Test | What it verifies |
|---|---|
| Sign-in with valid credentials → redirects to dashboard | Happy path |
| Sign-in with wrong password → shows generic error | No info leak |
| After sign-out → cannot access protected pages | Session invalidation |
| 429 after threshold | Brute-force protection |

### Step 6 — Update Docs
- Update task status in `docs/09_task-tracker.md` → `DONE`
- Publish I-1 handoff in `.agent/handoffs/`

---

## Acceptance Criteria
- [ ] `POST /api/auth/login` sets a `Secure HttpOnly SameSite=Lax` session cookie
- [ ] `POST /api/auth/logout` invalidates the session server-side (cookie alone is not enough)
- [ ] `requireRole()` and `branchScope()` are exported and documented as **I-1**
- [ ] Unauthenticated access to `/dashboard` redirects to `/sign-in`
- [ ] `npm run typecheck && npm test` pass
