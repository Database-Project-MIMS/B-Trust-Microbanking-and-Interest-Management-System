# 🟠 Phase 4 — Tasks 01–02: Customer↔FD Linkage & Branch-Scoped FD Access
**Task IDs:** `P04-M02-T01`, `P04-M02-T02` · **Branch:** `feat/p04-m02-customer-fd-linkage`
**Migration:** `0420_p04_m02_customer_fd_view.sql` · **Status:** TODO
**Depends on:** `P04-M05-T02` (`sp_open_fixed_deposit`, M5)
**Story Points:** ~3 + ~2 = ~5 · **Layer:** Database + Backend + Frontend

---

## What This Task Is

A thin read-side slice on top of M5's fixed-deposit work: a view joining customers to
their FDs, a listing page, and branch-scoped access control on top of it. No new tables
— you own the view and the page, M5 owns `fixed_deposit` itself.

---

## T01 — Customer↔FD Linkage View & Listing Page

### `vw_customer_fd_summary`

```sql
CREATE VIEW vw_customer_fd_summary AS
SELECT
    c.customer_id,
    c.full_name,
    c.branch_id,
    fd.fd_id,
    fd.fd_plan_id,
    fp.plan_name,
    fd.principal_amount,
    fd.interest_rate_at_opening,
    fd.opened_date,
    fd.maturity_date,
    fd.status
FROM customer c
JOIN account_holder ah ON ah.customer_id = c.customer_id
JOIN account a ON a.account_id = ah.account_id
JOIN fixed_deposit fd ON fd.account_id = a.account_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id;
```

Adjust the join path once M3's `account_holder` and M5's `fixed_deposit` final column
names are confirmed — check `docs/04_database-schema.md` before writing this, the join
keys above are the expected shape but are not authoritative until those tables exist.

### `GET /api/customers/{id}/fixed-deposits`
- **Purpose** List a customer's fixed deposits (active and matured)
- **Roles** `AGENT`, `BRANCH_MANAGER`, `CENTRAL_OPS`, `AUDITOR`; `CUSTOMER` for self
- **SQL** `SELECT ... FROM vw_customer_fd_summary WHERE customer_id = $1` plus branch
  scope
- **Success** `200 { data: { fixedDeposits: [...] } }`
- **Page** FD panel on `app/customers/[id]/page.tsx` (the profile page from Phase 2,
  T05) — add a new section rather than a new route

## T02 — Branch-Scoped FD Access

Apply `branchScope()` (I-1) to the query above and to any other FD read path that
touches customer data you own. This task is really "make sure T01 doesn't leak
cross-branch FD data" — it's a small, focused addition:

- `BRANCH_MANAGER` sees only FDs belonging to customers whose `branch_id` matches their
  own
- `AGENT` sees only FDs for customers currently assigned to them (join through
  `customer_agent WHERE is_active`)
- Apply the scope predicate **inside the SQL `WHERE` clause**, never as a post-fetch
  filter

---

## How to Implement

### Step 1 — Confirm M5's FD Schema Is Ready
```bash
grep -n "P04-M05-T02" docs/09_task-tracker.md
```

### Step 2 — Write the Migration (View Only)
Create file: `database/migrations/0420_p04_m02_customer_fd_view.sql` with the view above,
adjusted to the real column names.

### Step 3 — Backend
`services/customer-service.ts`: add `getCustomerFixedDeposits(customerId, scope)`.

### Step 4 — Frontend
Add an "Fixed Deposits" section to the customer profile page, reusing the existing page
shell from Phase 2.

### Step 5 — Write Tests
- `tests/db/customer-fd-view.test.mjs`: view returns expected rows for a seeded
  customer+FD pair
- `tests/api/customer-fixed-deposits.test.mjs`: `BRANCH_MANAGER` cannot see another
  branch's customer FDs → 403 or empty result per your error convention; `AGENT` sees
  only their currently-assigned customers' FDs

### Step 6 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 7 — Update Docs
- Update `docs/04_database-schema.md` / `docs/16_database-routines-views-indexes.md` —
  add `vw_customer_fd_summary`
- Update `docs/05_api-and-pages.md` — add the new endpoint
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] View joins correctly against M3's and M5's final schemas (verify column names
      before merging, not from this file's example)
- [ ] Branch scope enforced in SQL, not filtered in JavaScript
- [ ] FD panel renders on the existing customer profile page
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
