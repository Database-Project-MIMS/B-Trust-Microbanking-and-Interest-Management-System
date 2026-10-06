# 🟢 Phase 2 — Tasks 02–03: Customer-Agent Assignment & Document Schema
**Task IDs:** `P02-M02-T02`, `P02-M02-T03` · **Branch:** `feat/p02-m02-customer-agent-document`
**Migrations:** `0221_p02_m02_customer_agent.sql`, `0222_p02_m02_customer_document.sql`
**Status:** DONE — technical implementation verified locally; team review/publication pending
**Depends on:** T01 (`customer`)
**Story Points:** ~3 + ~3 = ~6 · **Layer:** Database (+ light Backend for T03 verification)

**Implemented 2026-10-05:** 0221/0222, 46 SQL constraint/history tests and 23 service/
concurrency tests. With 65 existing customer/organization regressions, 134 pass (no
failures/skips), clean 14-migration rebuild/reapply/verify, typecheck and lint pass.
See [handoff](../.agent/handoffs/p02-m02-t02-t03-customer-agent-document.md).

Implementation corrections to the illustrative SQL below: lifecycle timestamps/shared
triggers per AGENTS.md §8; named RESTRICT FKs including verifier; runner-owned
filename/checksum migration recording. The partial index guarantees **at most one**
active assignment; T04/future reassignment must guarantee existence. Verification is
server-only with scoped active staff, row locks, first-verifier preservation and atomic
minimal audit. No runtime grants/RLS or verification endpoint are introduced here.

---

## What This Task Is

Two small, related tables: `customer_agent` tracks which agent currently serves which
customer (with history preserved), and `customer_document` tracks uploaded KYC documents
and their verification state. Both are pure additions once `customer` exists.

---

## T02 — `customer_agent`

Effective-dated customer-to-agent assignment; preserves history (FR-CUS-03).

| Column | Type | Constraints |
|---|---|---|
| `cust_agent_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `customer_id` | `uuid` | **FK → customer, NOT NULL** |
| `agent_id` | `uuid` | **FK → agent, NOT NULL** |
| `assigned_date` | `date` | NOT NULL DEFAULT `CURRENT_DATE` |
| `end_date` | `date` | NULL while current |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- **Check:** `end_date IS NULL OR end_date >= assigned_date`
- **Invariant (FR-CUS-02, G-10):** at most one active row enforced here; registration
  supplies existence. The ERD leaves
  this unenforced — you must add a **partial unique index**:

```sql
CREATE UNIQUE INDEX ux_customer_agent_one_active
    ON customer_agent(customer_id)
    WHERE is_active;
```

This is the load-bearing part of this task. Without it, a double-insert silently
produces two active agents for one customer and breaks RPT-01/RPT-05 attribution later.

## T03 — `customer_document`

| Column | Type | Constraints |
|---|---|---|
| `doc_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `customer_id` | `uuid` | **FK → customer, NOT NULL** |
| `doc_type` | `varchar(50)` | NOT NULL |
| `file_path` | `varchar(500)` | NOT NULL — path only, **no file contents in the database** |
| `uploaded_date` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `verified_by` | `uuid` | **FK → app_user**, NULL until verified |
| `verified_date` | `timestamptz` | NULL until verified |

- **Check:** `(verified_by IS NULL) = (verified_date IS NULL)` — both set together, or
  neither.
- Documentation is required to open an account (ERD Assumption 3), but that rule is
  enforced in `sp_open_savings_account` (M3's routine in Phase 2), **not** by a
  constraint here — this table only records what was uploaded and whether it was
  verified.
- Light backend piece: a `verifyDocument(docId, verifierUserId)` service function that
  sets both `verified_by` and `verified_date` together, used by the registration flow in
  the next task file.

---

## How to Implement

### Step 1 — Implemented Migrations

The executable SQL is maintained in:

- `database/migrations/0221_p02_m02_customer_agent.sql`
- `database/migrations/0222_p02_m02_customer_document.sql`

Use those files and docs/04 B.4a as the exact contract. The historical illustrative
SQL was removed because its version/name ledger insert did not match the runner.
Both migrations use named RESTRICT FKs and shared timestamp triggers. The runner
records filename/checksum. Additional indexes serve full assignment history, agent
FK/assignment lookup and customer document lookup. Neither migration grants broad
runtime access.

### Step 2 — Write SQL Tests

`tests/db/customer-agent-constraints.test.mjs`:
1. ✅ A customer can have one active assignment
2. ✅ A second active assignment for the same customer is rejected by
   `ux_customer_agent_one_active` (`23505`) — this is the exact scenario G-10 exists to
   prevent
3. ✅ A customer **can** have a second assignment if the first is set `is_active = false`
   with an `end_date`
4. ✅ `end_date < assigned_date` is rejected by the CHECK constraint

`tests/db/customer-document-constraints.test.mjs`:
1. ✅ A document can be inserted unverified (`verified_by` and `verified_date` both NULL)
2. ✅ Setting only `verified_by` without `verified_date` is rejected by the CHECK
3. ✅ Setting both together succeeds
4. ✅ Deleting a customer referenced by a document is rejected (`23503`)

### Step 3 — Run & Verify
```bash
npm run verify:customer-agent-document
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` for both tables (mark G-10 partial index as
  implemented)
- Update `docs/16_database-routines-views-indexes.md` — add
  `ux_customer_agent_one_active`
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [x] Both migrations apply to a clean DB without errors
- [x] `ux_customer_agent_one_active` exists and rejects a second active row (`23505`)
- [x] `customer_document` verification CHECK rejects a half-set verification
- [x] `file_path` stores a path only — no test inserts binary content
- [x] Existing db:rebuild succeeds from empty in the disposable verification cluster
