# 🔵 Phase 1 — Task 03: Plan API & Administration Page
**Task ID:** `P01-M03-T03` · **Branch:** `feat/p01-m03-plan-api-admin`
**Status:** READY
**Depends on:** T02 (`fn_check_plan_eligibility`), **I-1** (M1 RBAC)
**Story Points:** ~3 · **Layer:** Backend + Frontend

---

## What This Task Is

A read-mostly product page: list the five savings plans with their rates, minimums and
eligibility rules, and let `ADMIN`/`CENTRAL_OPS` edit them (effective-dated, matching the
`fd_plan` pattern M5 already built in their Phase 1 task — read it for a reference
implementation before you start).

---

## API

| Method & path | Purpose | Roles | Notes |
|---|---|---|---|
| `GET /api/plans` | Savings plans with rates, minimums, eligibility | any authenticated | |
| `PATCH /api/plans/{id}` | Update plan (effective-dated) | `ADMIN`, `CENTRAL_OPS` | Non-privileged role → `403` |

`services/plan-service.ts`:
- `listPlans()` — returns all plans, active and inactive, with every eligibility column
  so the admin page can display them
- `updatePlan(id, input, actor)` — updates rate/minimum/eligibility columns; write an
  audit row; **do not physically remove the old row** if you're treating this as
  effective-dated the way `fd_plan` does (check whether `savings_plan` picked up
  `effective_from`/`effective_to` in T01 — if not, a plain `UPDATE` plus an audit trail
  entry is acceptable for Phase 1, since G-13 only asked for eligibility columns, not
  effective-dating; raise it in `.agent/open-questions.md` if you think Phase 1 needs
  effective-dating too, rather than silently adding columns beyond docs/04_database-schema.md)

---

## Frontend

`app/plans/page.tsx` — Server Component, read-mostly product view:
- Table: plan name, rate, minimum balance, age range, holder range, status
- Edit action gated to `ADMIN`/`CENTRAL_OPS` — hidden for other roles **and** the PATCH
  route itself re-checks the role server-side regardless of what the UI shows
- No "delete" action — plans are `RESTRICT`-protected and deactivated only

---

## How to Implement

### Step 1 — Confirm I-1 Is Published
```bash
grep -n "P01-M01-T03" docs/09_task-tracker.md
```

### Step 2 — Backend
1. `services/plan-service.ts`: `listPlans()`, `updatePlan(id, input, actor)`
2. `app/api/plans/route.ts` (GET), `app/api/plans/[id]/route.ts` (PATCH): parse →
   `requireRole([...])` for PATCH only (GET is any authenticated user) → validate → call
   service → respond

### Step 3 — Frontend
`app/plans/page.tsx` — table view; edit as a modal or inline form for privileged roles.

### Step 4 — Write Tests
- `tests/api/plans.test.mjs`: `GET` returns all 5 plans to any authenticated role;
  `PATCH` by `AGENT` → `403`; `PATCH` by `ADMIN` succeeds and is reflected in a
  subsequent `GET`; audit row is written on update
- `tests/e2e/plans.test.mjs`: view plan list, edit a rate as `ADMIN`, confirm the new
  rate displays

### Step 5 — Run & Verify
```bash
npm run typecheck && npm test
```

### Step 6 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches the built endpoints
- Run `/imprint` — capture the product table/edit-form pattern (useful precedent for M5's
  parallel `fd-products` page if it hasn't already set the pattern first)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] `GET /api/plans` returns all 5 plans with full eligibility data to any
      authenticated user
- [ ] `PATCH /api/plans/{id}` is rejected with `403` for non-`ADMIN`/`CENTRAL_OPS` roles
- [ ] Plan edits are audited
- [ ] No delete path exists for plans
- [ ] `/imprint` run; `ui-registry.md` updated
- [ ] `npm run typecheck && npm test` pass
