# 📋 Member 1 (Nadija) — Complete Work Overview

**Name:** Mansara W.G.N.S · **Index:** 240420D  
**Domain Slice:** Identity, Security, Audit & Reporting Framework  
**Total Story Points:** 54 · **Total Tasks:** 19 across 6 phases

---

## 🗺️ Work Order Summary

| # | File | Phase | Task IDs | What You Build | Points |
|---|---|---|---|---|---|
| 01 | [Identity Schema](01_P1-T01_identity-schema.md) | P1 | T01 | `role`, `app_user`, `user_session`, `login_attempt` tables | ~3 |
| 02 | [Authentication](02_P1-T02_authentication.md) | P1 | T02 | Password hashing, login/logout APIs, session management | ~3 |
| 03 | [RBAC & Scope](03_P1-T03_rbac-branch-scope-csrf.md) | P1 | T03 | `requireRole()`, `branchScope()`, CSRF ⚡ **CRITICAL PATH** | ~3 |
| 04 | [Sign-in & Shell](04_P1-T04_sign-in-app-shell.md) | P1 | T04 | Sign-in page, app shell, role-aware nav | ~2 |
| 05 | [Params & Audit](05_P1-T05_parameters-audit.md) | P1 | T05 | `system_parameter`, `business_calendar`, `audit_log`, triggers | ~2 |
| 06 | [RLS & Scope](06_P2_rls-audit-branchscope.md) | P2 | T01–T03 | Row Level Security, audit coverage, branch scope on routes | ~6 |
| 07 | [Hours & Reversals](07_P3_business-hours-reversal-audit.md) | P3 | T01–T03 | Business hours enforcement, reversal auth, financial audit | ~8 |
| 08 | [Worker Auth](08_P4_worker-auth-cycle-config.md) | P4 | T01–T02 | Interest run auth, cycle configuration | ~6 |
| 09 | [Report Framework](09_P5_report-framework-csv-audit-search.md) | P5 | T01–T04 | Report framework (I-7), CSV export, audit search | ~12 |
| 10 | [Security & Deploy](10_P6_security-testing-deployment.md) | P6 | T01–T04 | SQL injection tests, auth matrix, RLS verification, deployment | ~9 |

---

## 📊 Effort by Phase

```
Phase 1  ████████████████████████████  13 pts  (5 tasks — Foundation)
Phase 2  ████████████                   6 pts  (3 tasks — RLS + Audit)
Phase 3  ████████████████               8 pts  (3 tasks — Financial Rules)
Phase 4  ████████████                   6 pts  (2 tasks — Interest Auth)
Phase 5  ████████████████████████       12 pts (4 tasks — Reports + Audit)
Phase 6  ██████████████████             9 pts  (4 tasks — Testing + Deploy)
                                       ─────
                                       54 pts total
```

---

## 🔗 Integration Points You Publish

| ID | What | Phase | Who Waits |
|---|---|---|---|
| **I-1** | `requireRole()`, `branchScope()`, `verifyCsrf()` | P1 | **ALL 4 members** |
| **I-7** | Report framework: filters, scope, CSV, access audit | P5 | All report owners (M2–M5) |

---

## 🗄️ Database Objects You Own

### Tables (7)
`role`, `app_user`, `user_session`, `login_attempt`, `system_parameter`, `business_calendar`, `audit_log`

### Triggers (2)
`trg_audit_master_changes`, `trg_audit_log_immutable`

### Functions (1)
`fn_is_business_hour(ts)`

### Database Roles & Grants (3)
`mims_owner`, `mims_app`, `mims_readonly` + RLS policies on `customer`, `account`, `transaction`

---

## 📁 Files You Own

| Path | Shared? |
|---|---|
| `lib/auth/**` | No |
| `app/(auth)/**` | No |
| `app/admin/**` | No |
| `database/roles/**` | No |
| `app/layout.tsx` | **Yes — you approve changes** |
| `components/app-shell/**` | **Yes — you approve changes** |
| `components/report/**` | **Yes — you approve changes** |

---

## ⚡ Critical Path Reminder

**You are on the critical path for Phase 1.** Task T03 (RBAC) unblocks all 4 other members' API work. Suggested approach:

1. ✅ Do T01 (schema) first — pure DB work, fast
2. ✅ Do T02 (auth) next — backend only
3. ⚡ Do T03 (RBAC) — publish the handoff BEFORE finishing implementation
4. ✅ Do T04 (UI) and T05 (params/audit) in parallel or either order

---

## 📝 Key Rules to Remember

1. **No ORM** — handwritten parameterized SQL only (`$1, $2, ...`)
2. **Money is NUMERIC(15,2)** — string across API, never a JavaScript float
3. **Branch scope in SQL** — never filter in JavaScript after fetching
4. **Hiding a nav link ≠ access control** — server checks every request
5. **Migration numbers 0100–0119 (P1), 0200–0219 (P2), etc.** — never collide with others
6. **Never edit a merged migration** — write a new one
7. **Don't modify files owned by another member** — write a handoff instead
