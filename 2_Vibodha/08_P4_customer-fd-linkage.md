# 🟠 Phase 4 — Tasks 01–02: Customer↔FD Linkage & Branch-Scoped FD Access
**Task IDs:** `P04-M02-T01`, `P04-M02-T02` · **Branch:** `feat/p04-m02-customer-fd-linkage`
**Migrations:** `0420_p04_m02_customer_fd_view.sql`, `0421_p04_m02_customer_fd_scope_guard.sql` · **Status:** T01 DONE (PR #60); T02 local REVIEW (ADR-0019)
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
    fd.start_date,
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
- [x] View joins correctly against M3's and M5's final schemas (verify column names
      before merging, not from this file's example)
- [x] Branch scope enforced in SQL, not filtered in JavaScript
- [x] FD panel renders on the existing customer profile page
- [x] `npm run db:rebuild` succeeds from empty (disposable 29-migration rebuild)
- [x] Typecheck and full test suite pass (612 tests /57 suites)

## Implementation contract — 2026-10-08

Vibodha authorized T01's read-side start against the real 0480 schema; M5 T02
is partial and remains an integration dependency. The view is caller-security
(security_invoker/security_barrier); baseline branch/assignment/self restrictions
are enforced in SQL and FD SELECT RLS. This is needed for safe T01 listing, and
does not mark T02's broader FD access integration complete.

0420 defines the owner-only view installer: bind immediately on an existing FD
schema, or through database/views/customer-fd-summary.sql after 0480 on a clean
rebuild. No merged migration/shared runner/auth/grant file is edited. No FD writes.
Dates use actual start_date; money/rates are exact strings. API roles are the same
as the profile, unknown/out-of-scope customer uniform404, no query parameters.
Panel has loading/empty/error/retry states and internally scrolling history table.
Checks and three-layer review: complete. Full verify:phase1 PASS: 612 tests /57
suites, zero failures/skips, clean isolated 29-migration rebuild/checksums,
typecheck/lint/production build. Browser verifies actual snapshot amounts/rates,
all statuses, empty result, safe failure/retry and mobile internal scrolling.
T01 is DONE through PR #60 (dev e9291dc). T02 is authorized separately by ADR-0019.
See .agent/handoffs/p04-m02-customer-fd-listing.md for integration and review evidence.

## T02 implementation contract — 2026-10-08

T01 already supplied the parameterized customer/account branch, current assignment
and optional self-link predicates. T02 audits the only live M2 FD read path and
adds a restrictive SELECT-only stored-actor RLS guard in new 0421. Missing identity,
inactive stored user/role/profile/branch and forged/stale role or branch context
cannot read base FD rows or the invoker view. Existing row scope remains ANDed.
Bankwide/self roles are independent of retained inactive staff profiles. Live
sessions follow branch/role/self-link changes; local context clears on transaction
end. This validates trusted context consistency; session authentication stays required.
No new API/UI, table columns, write grants or another member's read path is added.
No merged migration is edited. Cross-owner security review is handed to M1/M5.
Verification and three-layer /review complete: 630 tests /60 suites, clean isolated
31-migration rebuild/checksums, typecheck/lint/production build pass. 14 new DB10/API4
scope cases plus existing T01 regressions. Initial branch-test process failure passed
isolated/full reruns, recorded in the handoff. Local REVIEW awaits user publication
and M1/M5 policy review; user retains all Git publication control.

- [x] Current branch, assignment and self predicates audited in all live M2 FD reads
- [x] Direct runtime RLS rejects missing, forged, inactive and stale stored actor context
- [x] Live-session role/branch/self-link changes and transaction context cleanup tested
- [x] Clean combined rebuild/full tests/typecheck/lint/build and three-layer review pass
