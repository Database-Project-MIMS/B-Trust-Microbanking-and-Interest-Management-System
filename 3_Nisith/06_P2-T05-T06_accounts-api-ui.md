# 🟢 Phase 2 — Tasks 05–06: Accounts API & Opening Wizard
**Task IDs:** `P02-M03-T05`, `P02-M03-T06` · **Branch:** `feat/p02-m03-accounts-api-ui`
**Status:** TODO
**Depends on:** T04 (`sp_open_savings_account`), **I-1** (M1 RBAC)
**Story Points:** ~4 + ~5 = ~9 · **Layer:** Backend + Frontend

---

## What This Task Is

Wrap T04's routine in a service and route handlers, then build the account opening
wizard, detail page, and holder/mandate management UI on top.

---

## T05 — Accounts and Holders APIs

### `POST /api/accounts`
- **Purpose** Open an individual or joint savings account (FR-ACC-01…04)
- **Roles** `AGENT`, `BRANCH_MANAGER`
- **Body** `{ planId, branchId, holders: [{ customerId, holderType }], mandate?: { type, requiredSignatories }, initialDeposit? }`
- **Validation** plan active; 1 holder for individual, 2–4 for joint; every holder's age
  satisfies the plan; joint requires a mandate; `initialDeposit ≥ plan.min_balance` — the
  service pre-validates what it cheaply can before calling the routine, but the routine
  (T04) is the real enforcement point, not the service
- **SQL routine** `CALL sp_open_savings_account(...)`
- **Success** `201 { data: { accountId, accountNumber, currentBalance } }`
- **Errors** `409 PLAN_ELIGIBILITY_FAILED` · `409 BELOW_MINIMUM_BALANCE` ·
  `409 INVALID_HOLDER_COUNT` · `409 MANDATE_REQUIRED` — map each `ERRCODE = 'P0001'`
  message from the routine to its specific code, don't collapse them all into one
  generic `409`
- **Page** `/accounts/new`

| `GET /api/accounts` | List / search, scoped | `AGENT`, `BRANCH_MANAGER`, `CENTRAL_OPS`, `AUDITOR` |
| `GET /api/accounts/{id}` | Detail: plan, holders, mandate, balance, FD | as above; `CUSTOMER` if a holder |
| `POST /api/accounts/{id}/holders` | Add a joint holder and mandate | `BRANCH_MANAGER` |
| `POST /api/accounts/{id}/close` | Close — requires zero balance and no active FD (BR-18) | `BRANCH_MANAGER` — **this route stub only; the real closure rule is Phase 4, T02** |

Note: `POST /api/accounts/{id}/close` appears in the Phase 2 API table but its
enforcement (`sp_close_account`, BR-18) is a Phase 4 task (`P04-M03-T02`). In Phase 2,
either stub the route to return `501 NOT_IMPLEMENTED` or hold it until Phase 4 — don't
half-implement the closure business rule now.

`services/account-service.ts`:
- `openAccount(input, actor)` — calls `sp_open_savings_account`
- `listAccounts(scope, filters)` — branch-scoped
- `getAccountDetail(id, scope)` — includes plan, holders, mandate, balance (FD panel
  added in Phase 4)
- `addHolder(accountId, holderInput, actor)` — inserts an `account_holder` row on an
  existing account; re-triggers `trg_validate_joint_mandate`, so a bad add is rejected by
  the database, not just the service

---

## T06 — Account Opening Wizard, Detail & Holder Management Pages

Pages: `app/accounts/new/page.tsx`, `app/accounts/page.tsx` (list/search),
`app/accounts/[id]/page.tsx` (detail).

- **Opening wizard** (`/accounts/new`): multi-step — plan selection (shows eligibility
  rules from `GET /api/plans`), holder selection (search existing customers via M2's
  `GET /api/customers`), mandate configuration (only shown for plans with
  `min_holders > 1`), optional initial deposit, review & submit
- **List/search page** (`/accounts`): filter by branch, plan, status; branch-scoped
  results
- **Detail page** (`/accounts/[id]`): plan, balance, holders with their `holder_type`,
  mandate summary, "Add holder" action (only enabled where the plan allows more holders
  than currently present)
- Match tokens and patterns from `ui-registry.md`; this is a multi-step form, so check
  whether M1's app shell or any earlier member has already established a wizard/stepper
  pattern before inventing your own

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P02-M03-T04\|P01-M01-T03" docs/09_task-tracker.md
```

### Step 2 — Backend
1. `services/account-service.ts` as above
2. Route handlers: parse → `requireRole([...])` → `branchScope()` → validate → call
   service → map routine error codes → respond
3. CSRF verification on all state-changing routes

### Step 3 — Frontend
1. Opening wizard as a Client Component (multi-step, holds state across steps)
2. List/search page: Server Component with a Client Component filter bar
3. Detail page: Server Component; "Add holder" as a Client Component modal

### Step 4 — Write Tests
- `tests/api/accounts.test.mjs`: open individual account → 201; open joint account with
  mandate → 201; open joint with 1 holder → 409 `INVALID_HOLDER_COUNT`; non-`AGENT`/
  `BRANCH_MANAGER` open attempt → 403; `AGENT` cannot open into another branch → 403
- `tests/api/account-holders.test.mjs`: adding a 5th holder to a Joint account → 409
  (trigger-enforced); adding a duplicate customer to the same account → 409
- `tests/e2e/account-opening.test.mjs`: walk the wizard for an individual account and a
  joint account, land on the detail page, confirm holders and balance display correctly

### Step 5 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches what you built
- Run `/imprint` — wizard, holder list, mandate summary patterns
- Update task statuses in `docs/09_task-tracker.md` → `DONE`
- Write a handoff in `.agent/handoffs/` — M4's transaction/statement pages (Phase 3)
  will link back to the account detail page you just built

---

## Acceptance Criteria
- [ ] All five endpoints implemented, authorized on the server (role **and** branch
      scope)
- [ ] Routine error codes map to specific `409` reasons, not a single generic one
- [ ] `POST /accounts/{id}/close` does not implement BR-18 yet — deferred to Phase 4,
      documented as such
- [ ] Opening wizard produces a working individual account and a working joint account
      end-to-end
- [ ] `/imprint` run; `ui-registry.md` updated
- [ ] `npm run typecheck && npm test` pass
