# 🟢 Phase 2 — Tasks 04–05: Customer Registration Service & Pages
**Task IDs:** `P02-M02-T04`, `P02-M02-T05` · **Branch:** `feat/p02-m02-customer-registration`
**Status:** TODO
**Depends on:** T03 (`customer_document`), **I-1** (M1 RBAC), **I-2** (M4 `withTransaction`)
**Story Points:** ~5 + ~5 = ~10 · **Layer:** Backend + Frontend — your hardest task this phase

---

## What This Task Is

The full customer onboarding vertical: one atomic service call that inserts the
customer, their documents, their agent assignment and an audit event — then the pages
that drive it. This is the task AGENTS.md §5 and §11 are describing when they say a
financial-adjacent multi-row operation belongs in a single explicit transaction.

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
- **Page** `/customers/new`

```ts
// services/customer-service.ts
/** Registers a customer, their documents, agent assignment and audit event in one transaction. */
export async function registerCustomer(input: RegisterCustomerInput, actor: AuthContext) {
  return withTransaction(async (client) => {
    const customerNumber = await nextCustomerNumber(client);
    const customer = await insertCustomer(client, { ...input, customerNumber });

    for (const doc of input.documents) {
      await insertCustomerDocument(client, { customerId: customer.customerId, ...doc });
    }

    await insertCustomerAgent(client, {
      customerId: customer.customerId,
      agentId: input.agentId,
      isActive: true,
    });

    await writeAudit(client, {
      actor,
      entityType: 'customer',
      entityId: customer.customerId,
      before: null,
      after: customer,
    });

    return customer;
  });
}
```

Also implement the search and detail reads:

| `GET /api/customers` | Search by name, NIC, branch, agent | `AGENT`, `BRANCH_MANAGER`, `CENTRAL_OPS`, `AUDITOR` | Trigram index on `full_name`; identity **masked** for unauthorised roles (FR-CUS-04); sort column via a server-side allow-list |
| `GET /api/customers/{id}` | Profile with accounts and assignment history | as above; `CUSTOMER` for self only | RLS enforces self-access once M1's RLS lands (Phase 2, M1) |

**Identity masking (FR-CUS-04):** decide per role which fields are visible. A minimal
approach: `AUDITOR` and `CENTRAL_OPS` see full detail; roles without a legitimate need
see `nic_passport_no` and `email` redacted (e.g. last 4 digits only) in the service
layer response shaping — **not** hidden only in the UI.

---

## T05 — Registration, Search & Profile Pages

Pages: `app/customers/new/page.tsx`, `app/customers/page.tsx` (search/list),
`app/customers/[id]/page.tsx` (profile).

- **Registration form** (`/customers/new`): multi-step or single form — personal detail,
  branch/agent selection (pre-filled and locked if the caller is an `AGENT`), document
  upload (file path only — actual file storage is out of scope unless a handoff says
  otherwise; store a placeholder path or wire to whatever upload mechanism the team
  agreed on)
- **Search page** (`/customers`): search by name (fuzzy, via the trigram index), NIC,
  branch, agent; results respect masking and branch scope
- **Profile page** (`/customers/[id]`): customer detail, linked accounts (once M3's
  `account_holder` exists — this panel can be a placeholder until then), assignment
  history (all `customer_agent` rows, not just the active one — this is what proves
  FR-CUS-03)

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

### Step 3 — Frontend
1. Registration form as a Client Component (interactive multi-field form with
   validation feedback); submits to `POST /api/customers`
2. Search page as a Server Component with a Client Component search box (debounced)
3. Profile page as a Server Component; assignment history rendered as a timeline/table

### Step 4 — Write Tests
- `tests/api/customers.test.mjs`: registration is atomic (a document insert failure
  rolls back the customer insert too — test by forcing an invalid document row mid-list);
  duplicate NIC → 409; duplicate email → 409; `AGENT` cannot register into another
  branch → 403
- `tests/db/customer-registration-transaction.test.mjs` (if useful at the DB level):
  confirms row counts before/after a forced failure
- `tests/e2e/customer-registration.test.mjs`: fill the form, submit, land on the new
  profile page, see the customer in search results

### Step 5 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches what you built
- Run `/imprint` — registration form, search box, profile layout patterns
- Update task statuses in `docs/09_task-tracker.md` → `DONE`
- Write a handoff in `.agent/handoffs/` — M3's account opening flow (Phase 2) will need
  to look up a customer by ID from this page

---

## Acceptance Criteria
- [ ] Registration is a single atomic transaction — customer + documents + assignment +
      audit all succeed or all roll back
- [ ] Duplicate NIC and duplicate email both return `409`, not `500`
- [ ] `AGENT` role is branch-scoped on both create and search — enforced in SQL
- [ ] Identity fields are masked for roles without a legitimate need (FR-CUS-04)
- [ ] Assignment history on the profile page shows all rows, not just the active one
- [ ] `/imprint` run; `ui-registry.md` updated
- [ ] `npm run typecheck && npm test` pass
