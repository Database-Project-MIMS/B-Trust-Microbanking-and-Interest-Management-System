# 🟢 Phase 2 — Tasks 04–05: Customer Registration Service
**Task IDs:** `P02-M02-T04`, `P02-M02-T05` · **Branch:** `feat/p02-m02-customer-registration`
**Status:** T04 DONE (technical implementation locally); T05 BLOCKED pending M1 runtime security
**Depends on:** T03 (`customer_document`), **I-1** (M1 RBAC), **I-2** (M4 `withTransaction`)
**Story Points:** ~5 + ~5 = ~10 · **Layer:** Backend only

> **2026-10-05 verification:** Customer screens are prototypes in
> `components/mims/workflow-screen.tsx`, not completed `app/dashboard/**` bindings.
> T04 implements services only; T05 must connect real data through authenticated,
> authorized, CSRF-protected API routes after M1 scoped grants/RLS/audit integration.
> Existing UI components were not rebuilt in T04.

T04 contract and `/review`: [handoff](../.agent/handoffs/p02-m02-t04-customer-registration.md).
`npm run verify:customer-registration`: 181 tests pass, zero failures/skips; clean
14-migration rebuild/reapply/verify, typecheck and lint pass. No new migration.

---

## What This Task Is

The full customer onboarding vertical: one atomic service call that inserts the
customer, their documents, their agent assignment and an audit event. This is the task
AGENTS.md §5 and §11 are describing when they say a financial-adjacent multi-row
operation belongs in a single explicit transaction.

---

## T04 — Registration Service

### `POST /api/customers`
- **Purpose** Register a customer (FR-CUS-01…05).
- **Roles** `AGENT`, `BRANCH_MANAGER`
- **Body** `{ fullName, nicPassportNo, dateOfBirth, gender, phone, address, email, branchId, agentId, documents[] }`
- **Validation** NIC/passport format; `dateOfBirth` in the past; email format; `branchId`
  within the caller's scope (an `AGENT` can only register into their own branch)
- **SQL / routine** one transaction:
  `INSERT customer` → `INSERT customer_document` (each) → `INSERT customer_agent
  (is_active = true)` → `INSERT audit_log`
- **Transaction** all four, atomic (§4.3: "Customer, documents, assignment and audit
  event are inserted in one database transaction")
- **Success** `201 { data: { customerId, customerNumber } }`
- **Errors** `409 DUPLICATE_IDENTITY` (unique `nic_passport_no`), `409 DUPLICATE_EMAIL`

```ts
// services/customer-service.ts
/** Registers a customer, their documents, agent assignment and audit event in one transaction. */
export async function registerCustomer(input: RegisterCustomerInput, actor: AuthContext) {
  return withTransaction(async (client) => {
    const customerNumber = await nextCustomerNumber(client);

Implemented signatures in `services/customer-service.ts` use authenticated actor
context and strict schemas from `lib/validation/customer.ts`. Audit includes only
customer number, branch, agent and document count, not the full customer object.
Customer numbering follows ADR-0013. Registration documents start unverified and
may be empty; required verified documentation belongs to M3 account opening.

Also implement the search and detail reads:

| `GET /api/customers` | Search by name, NIC, branch, agent | `AGENT`, `BRANCH_MANAGER`, `CENTRAL_OPS`, `AUDITOR` | Trigram index on `full_name`; identity **masked** for unauthorised roles (FR-CUS-04); sort column via a server-side allow-list |
| `GET /api/customers/{id}` | Profile with accounts and assignment history | as above; `CUSTOMER` for self only | RLS enforces self-access once M1's RLS lands (Phase 2, M1) |

**Identity masking (FR-CUS-04):** decide per role which fields are visible. A minimal
approach: `AUDITOR` and `CENTRAL_OPS` see full detail; roles without a legitimate need
see `nic_passport_no` and `email` redacted (e.g. last 4 digits only) in the service
layer response shaping — **not** hidden only in the UI.

---

## T05 — API Endpoints for Registration, Search & Profile

| Endpoint | Purpose |
|---|---|
| `POST /api/customers` | Register (see T04 above) |
| `GET /api/customers` | Search with masking and branch scope |
| `GET /api/customers/{id}` | Profile including account links and assignment history |

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P01-M01-T03\|P01-M04-T01" docs/09_task-tracker.md
```
Both I-1 (RBAC) and I-2 (`withTransaction`) should be `DONE` or `REVIEW` before you
start the service layer.

### Step 2 — Backend
1. `services/customer-service.ts`: `registerCustomer()`, `searchCustomers(query, scope)`,
   `getCustomerProfile(id, scope)`
2. Route handlers: parse → `requireRole([...])` → `branchScope()` → validate → call
   service → map errors → respond
3. Error mapping: `23505` on `nic_passport_no` → `409 DUPLICATE_IDENTITY`; `23505` on
   `email` → `409 DUPLICATE_EMAIL`

### Step 3 — Write Tests
- `tests/api/customers.test.mjs`: registration is atomic (a document insert failure
  rolls back the customer insert too — test by forcing an invalid document row mid-list);
  duplicate NIC → 409; duplicate email → 409; `AGENT` cannot register into another
  branch → 403
- `tests/db/customer-registration-transaction.test.mjs` (if useful at the DB level):
  confirms row counts before/after a forced failure

### Step 4 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches what you built
- Update task statuses in `docs/09_task-tracker.md` → `DONE`
- Write a handoff in `.agent/handoffs/` — M3's account opening flow (Phase 2) will need
  to look up a customer by ID

---

## Acceptance Criteria
- [x] Registration is a single atomic transaction — customer + documents + assignment +
      audit all succeed or all roll back
- [x] Duplicate NIC/email produce typed errors mapping to `409`; HTTP endpoint coverage is T05
- [x] `AGENT` role is branch-scoped on both create and search — enforced in SQL
- [x] Identity fields are masked for roles without a legitimate need (FR-CUS-04)
- [ ] `GET /api/customers/{id}` returns assignment history (all rows, not just active)
- [x] Profile service returns all assignment history; accounts are unavailable (null) pending M3 account_holder
- [x] Safe `npm run verify:customer-registration` passes 181 selected tests, rebuild, typecheck/lint
- [ ] T05 session/CSRF/HTTP/UI integration and runtime RLS checks pass

Do not run the legacy full migration-runner tests against development data: they reset
the configured database and edit an existing migration. Use the disposable harness.
