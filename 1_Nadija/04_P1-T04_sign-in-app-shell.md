# 🔵 Phase 1 — Task 04: Sign-in Page & Application Shell
**Task ID:** `P01-M01-T04` · **Branch:** `feat/p01-m01-app-shell`  
**Status:** READY · **Depends on:** P01-M01-T02  
**Story Points:** ~2 · **Layer:** Frontend only  
**📌 Shared file — M1 owns the app shell, everyone uses it**

---

## What This Task Is

Build the sign-in page and the authenticated application shell (header, navigation, session indicator, sign-out). This is the shared UI that all 4 other members' pages will sit inside.

---

## Files to Create

| File | Purpose |
|---|---|
| `app/(auth)/sign-in/page.tsx` | Sign-in page |
| `app/layout.tsx` | Replace with authenticated shell |
| `components/app-shell/header.tsx` | App header with session indicator |
| `components/app-shell/nav.tsx` | Role-aware navigation sidebar |
| `components/app-shell/sign-out-button.tsx` | Sign-out button |
| `tests/e2e/sign-in.test.mjs` | End-to-end sign-in test |

---

## How to Implement

### Step 1 — Sign-in Page (`app/(auth)/sign-in/page.tsx`)

A simple, clean sign-in form:
- Username field
- Password field
- Submit button
- Error message area (generic errors only!)
- **Read `ui-registry.md` FIRST** for design tokens

**Form submission:**
```typescript
// POST to /api/auth/login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
```

- On success → redirect to dashboard
- On failure → show generic error message
- On throttle (429) → show "Too many attempts, please wait"

### Step 2 — Application Shell (`app/layout.tsx`)

Replace the existing layout with an authenticated shell:

```
┌──────────────────────────────────────────────┐
│  HEADER: Logo │ System Name │ User │ Sign Out │
├────────┬─────────────────────────────────────┤
│        │                                     │
│  NAV   │         PAGE CONTENT                │
│ (role  │                                     │
│ aware) │                                     │
│        │                                     │
├────────┴─────────────────────────────────────┤
│  FOOTER (optional)                           │
└──────────────────────────────────────────────┘
```

**Key rules:**
- If user is NOT authenticated → redirect to `/sign-in`
- If user IS authenticated → show the shell with content

### Step 3 — Role-Aware Navigation (`components/app-shell/nav.tsx`)

Navigation items are shown based on the user's role. But remember: **hiding a nav link is NOT access control** (FR-AUTH-02) — the server still checks authorization on every request.

| Nav Item | Visible to Roles |
|---|---|
| Dashboard | All |
| Branches | ADMIN, BRANCH_MANAGER |
| Agents | ADMIN, BRANCH_MANAGER |
| Customers | ADMIN, BRANCH_MANAGER, AGENT, AUDITOR |
| Plans | All authenticated |
| Accounts | ADMIN, BRANCH_MANAGER, AGENT |
| Transactions | ADMIN, BRANCH_MANAGER, AGENT |
| Fixed Deposits | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT |
| Interest Runs | ADMIN, CENTRAL_OPS |
| Reports | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR |
| Audit Log | ADMIN, AUDITOR |
| Admin (Users, Params) | ADMIN |
| System Health | ADMIN |

### Step 4 — Session Indicator & Sign-Out

In the header, show:
- Username
- Role badge
- Branch name (if branch-scoped)
- Sign-out button

**Sign-out flow:**
1. `POST /api/auth/logout`
2. Clear the session cookie
3. Redirect to `/sign-in`

### Step 5 — Write Tests (`tests/e2e/sign-in.test.mjs`)

| Test | What it verifies |
|---|---|
| Sign-in with valid credentials → redirects to dashboard | Happy path |
| Sign-in with wrong password → shows generic error | No info leak |
| After sign-out → cannot access protected pages | Session invalidation |
| Nav shows only permitted sections per role | UI authorization |

### Step 6 — Run `/imprint`
This creates the **first entries** in `ui-registry.md`:
- App Shell component
- Sign-in Card component
- Button component
- Form Field component

### Step 7 — Update Docs
- Update `docs/11_ui-rules.md` with implementation details
- Update `ui-registry.md` via `/imprint`
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Nav shows only permitted sections per role
- [ ] Server still authorizes every request (hiding nav ≠ access control)
- [ ] Sign-in works with session cookie
- [ ] Sign-out invalidates session server-side
- [ ] Matches the design tokens in `ui-registry.md`
- [ ] `/imprint` run — first component entries created
