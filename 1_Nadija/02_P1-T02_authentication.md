# 🔵 Phase 1 — Task 02: Authentication, Sessions & Password Hashing
**Task ID:** `P01-M01-T02` · **Branch:** `feat/p01-m01-authentication`  
**Status:** READY · **Depends on:** P01-M01-T01  
**Story Points:** ~3 · **Layer:** Backend only

---

## What This Task Is

Build the authentication system — password hashing, login/logout endpoints, session management, and failed-login throttling. No frontend yet (that's T04).

---

## Files to Create

| File | Purpose |
|---|---|
| `lib/auth/password.ts` | Password hashing (argon2id) and verification |
| `lib/auth/session.ts` | Session creation, validation, and revocation |
| `app/api/auth/login/route.ts` | `POST /api/auth/login` endpoint |
| `app/api/auth/logout/route.ts` | `POST /api/auth/logout` endpoint |
| `services/auth-service.ts` | Business logic for authentication |
| `tests/api/auth.test.mjs` | API-level tests |

---

## How to Implement

### Step 1 — Password Hashing (`lib/auth/password.ts`)

```typescript
// Use argon2id (preferred) or bcrypt cost >= 12
// Two functions:
export async function hashPassword(plaintext: string): Promise<string>
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean>
```

**Rules:**
- argon2id is preferred (install `argon2` package)
- If argon2 is unavailable, use `bcrypt` with cost ≥ 12
- Password is NEVER logged, NEVER returned by any API
- The hash is NEVER returned by any endpoint

### Step 2 — Session Management (`lib/auth/session.ts`)

```typescript
// Generate a random session token → hash it → store the HASH in user_session
// Cookie carries the opaque token, NOT the hash
export async function createSession(userId: string, ip: string, userAgent: string): Promise<{ token: string; expiresAt: Date }>
export async function validateSession(token: string): Promise<SessionData | null>
export async function revokeSession(sessionId: string): Promise<void>
```

**Session rules:**
- Store only the **token hash** in the database (reading the DB won't let you impersonate)
- Cookie: `Secure`, `HttpOnly`, `SameSite=Lax`
- Idle timeout: 20 minutes
- Absolute timeout: 8 hours
- On sign-out: set `revoked_at` (real invalidation, not just cookie clearing)

### Step 3 — Login Endpoint (`POST /api/auth/login`)

**Flow:**
1. Parse input: `{ username, password }` — both required, username ≤ 100 chars
2. Query: `SELECT user_id, password_hash, status, role_id FROM app_user WHERE username = $1`
3. Verify password with `verifyPassword()`
4. Check account is ACTIVE
5. **On success:** Create session, record login attempt (success), update `last_login`
6. **On failure:** Record login attempt (failed), return generic error
7. **All in one transaction:** session insert + attempt log + `last_login` update

**Response on success:**
```json
{
  "data": {
    "user": { "id": "...", "username": "...", "role": "...", "branchId": "..." }
  }
}
```
+ Set `Secure`/`HttpOnly`/`SameSite=Lax` cookie

**Response on failure:**
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password" } }
```
- **CRITICAL:** Same message whether username doesn't exist OR password is wrong (FR-AUTH-03)
- Never reveal if a username exists!

### Step 4 — Failed-Login Throttling

Check recent failed attempts for the username:
```sql
SELECT COUNT(*) FROM login_attempt 
WHERE username_attempted = $1 
  AND success = false 
  AND attempted_at > now() - interval '15 minutes'
```
- If count ≥ 5 → return `429 TOO_MANY_ATTEMPTS`
- This prevents brute-force attacks

### Step 5 — Logout Endpoint (`POST /api/auth/logout`)

```sql
UPDATE user_session 
SET revoked_at = now() 
WHERE session_id = $1
```
- Return `204 No Content`
- Server-side invalidation — not just clearing the cookie (FR-AUTH-04)

### Step 6 — Write Tests (`tests/api/auth.test.mjs`)

| Test | What it verifies |
|---|---|
| Valid login → sets `Secure`/`HttpOnly`/`SameSite` cookie | FR-AUTH-01 |
| Invalid password → generic error (same as wrong username) | FR-AUTH-03 |
| Non-existent username → same generic error | FR-AUTH-03 |
| 5 failed attempts → `429 TOO_MANY_ATTEMPTS` | FR-AUTH-03 |
| Logout → session revoked server-side | FR-AUTH-04 |
| Revoked session → rejected on next request | FR-AUTH-04 |
| Hash is NEVER returned in any response | NFR-SEC |

### Step 7 — Update Docs
- Update `docs/15_security-and-rbac.md` with implementation details
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] FR-AUTH-01: Valid login creates session with proper cookie
- [ ] FR-AUTH-03: Failed login message is generic (no username leak)
- [ ] Hash is never returned by any endpoint or written to a log
- [ ] 5 failures trigger throttling
- [ ] Logout invalidates session server-side
