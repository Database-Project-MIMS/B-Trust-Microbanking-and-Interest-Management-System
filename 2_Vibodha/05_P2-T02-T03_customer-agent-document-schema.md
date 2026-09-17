# 🟢 Phase 2 — Tasks 02–03: Customer-Agent Assignment & Document Schema
**Task IDs:** `P02-M02-T02`, `P02-M02-T03` · **Branch:** `feat/p02-m02-customer-agent-document`
**Migrations:** `0221_p02_m02_customer_agent.sql`, `0222_p02_m02_customer_document.sql`
**Status:** TODO
**Depends on:** T01 (`customer`)
**Story Points:** ~3 + ~3 = ~6 · **Layer:** Database (+ light Backend for T03 verification)

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
- **Invariant (FR-CUS-02, G-10):** exactly one active row per customer. The ERD leaves
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

### Step 1 — Write the Migrations

`database/migrations/0221_p02_m02_customer_agent.sql`:

```sql
-- Migration 0221: Customer-agent assignment (M2)
-- Table: customer_agent — effective-dated, exactly one active row per customer (G-10)

BEGIN;

CREATE TABLE customer_agent (
    cust_agent_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    uuid NOT NULL REFERENCES customer(customer_id) ON DELETE RESTRICT,
    agent_id       uuid NOT NULL REFERENCES agent(agent_id) ON DELETE RESTRICT,
    assigned_date  date NOT NULL DEFAULT CURRENT_DATE,
    end_date       date,
    is_active      boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_agent_dates CHECK (end_date IS NULL OR end_date >= assigned_date)
);

CREATE UNIQUE INDEX ux_customer_agent_one_active
    ON customer_agent(customer_id)
    WHERE is_active;

INSERT INTO schema_migration(version, name)
VALUES (221, '0221_p02_m02_customer_agent');

COMMIT;
```

`database/migrations/0222_p02_m02_customer_document.sql`:

```sql
-- Migration 0222: Customer document schema (M2)
-- Table: customer_document — KYC uploads and verification state

BEGIN;

CREATE TABLE customer_document (
    doc_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     uuid NOT NULL REFERENCES customer(customer_id) ON DELETE RESTRICT,
    doc_type        varchar(50) NOT NULL,
    file_path       varchar(500) NOT NULL,
    uploaded_date   timestamptz NOT NULL DEFAULT now(),
    verified_by     uuid REFERENCES app_user(user_id),
    verified_date   timestamptz,
    CONSTRAINT chk_customer_document_verification
        CHECK ((verified_by IS NULL) = (verified_date IS NULL))
);

CREATE INDEX idx_customer_document_customer ON customer_document(customer_id);

INSERT INTO schema_migration(version, name)
VALUES (222, '0222_p02_m02_customer_document');

COMMIT;
```

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
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` for both tables (mark G-10 partial index as
  implemented)
- Update `docs/16_database-routines-views-indexes.md` — add
  `ux_customer_agent_one_active`
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Both migrations apply to a clean DB without errors
- [ ] `ux_customer_agent_one_active` exists and rejects a second active row (`23505`)
- [ ] `customer_document` verification CHECK rejects a half-set verification
- [ ] `file_path` stores a path only — no test inserts binary content
- [ ] `npm run db:rebuild` succeeds from empty
