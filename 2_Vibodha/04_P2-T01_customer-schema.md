# 🟢 Phase 2 — Task 01: Customer Schema
**Task ID:** `P02-M02-T01` · **Branch:** `feat/p02-m02-customer-schema`
**Migration:** `0220_p02_m02_customer.sql` · **Status:** TODO (gated)
**Depends on:** **OQ-05** (G-20 customer identity decision), `P01-M02-T02` (`agent`)
**Story Points:** ~4 · **Layer:** Database only

---

## ⚠️ Blocking Gate — Read First

`P02-M02-T01` **cannot start** until **OQ-05** is resolved. Check
`.agent/open-questions.md` and `docs/17_erd-gap-analysis.md` (**G-20**) before writing
any migration.

The current ERD models `customer` as a subtype of `user` (`customer_id` is `PK,FK` into
`app_user`), which forces every one of the 15+ seeded customers to have login
credentials. **G-20** proposes instead making `customer_id` an **independent surrogate
PK** with an optional `user_id uuid NULL UNIQUE FK → app_user`, so customer
self-service login is possible later without being mandatory now.

Two possible schemas follow from the two answers. **Do not guess — ask the team/lecturer
and record the decision in an ADR (`.agent/decisions/`) before writing the migration.**

---

## Table to Create (pending OQ-05)

### `customer` — if self-service login is **not** required (G-20 proposal, likely path)

| Column | Type | Constraints |
|---|---|---|
| `customer_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** — independent surrogate |
| `user_id` | `uuid` | **NULL, UNIQUE, FK → app_user** — set only if self-service login is later enabled |
| `branch_id` | `uuid` | **FK → branch, NOT NULL** — home branch (FR-CUS-02) |
| `customer_number` | `varchar(30)` | **UNIQUE, NOT NULL** — FR-CUS-01 |
| `nic_passport_no` | `varchar(50)` | **UNIQUE, NOT NULL** |
| `full_name` | `varchar(150)` | NOT NULL |
| `date_of_birth` | `date` | NOT NULL, `CHECK (date_of_birth < CURRENT_DATE)` — drives plan eligibility (FR-ACC-02) |
| `gender` | `varchar(20)` | |
| `phone` | `varchar(20)` | |
| `address` | `varchar(255)` | |
| `email` | `varchar(150)` | **UNIQUE, NOT NULL** |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

### `customer` — if self-service login **is** required (subtype pattern, matches ERD as-is)

Same as `agent` in T02: `customer_id uuid PRIMARY KEY REFERENCES app_user(user_id)`, plus
the same columns minus `user_id`. Only use this shape if the team/lecturer confirms every
customer needs a login.

**Whichever shape is chosen, keep these invariants:**
- **DELETE rule:** `RESTRICT` — referenced by `customer_agent`, `customer_document`,
  `account_holder` (Phase 2, M3).
- **Indexes:** `nic_passport_no` UNIQUE (duplicate-identity detection, SRS §6.7);
  `(branch_id)`; **trigram index** on `full_name` for search (`GET /api/customers`
  search).
- **Invariant:** `date_of_birth` in the past; ≥ 15 customers eventually seeded
  (FR-CUS-05, M5's job in Phase 2 seed sets).

---

## How to Implement

### Step 1 — Resolve OQ-05
1. Read `.agent/open-questions.md` entry for OQ-05 and `docs/17_erd-gap-analysis.md`
   G-20 in full.
2. Run `/architect` — this is exactly the kind of load-bearing decision it exists to
   pin down before code.
3. Write the decision to `.agent/decisions/` as an ADR. Update
   `.agent/open-questions.md` to mark OQ-05 resolved.

### Step 2 — Write the Migration
Create file: `database/migrations/0220_p02_m02_customer.sql`. Example assuming the
independent-surrogate-PK path (most likely outcome per G-20's own recommendation):

```sql
-- Migration 0220: Customer schema (M2)
-- Table: customer — independent surrogate PK; optional link to app_user (G-20)

BEGIN;

CREATE TABLE customer (
    customer_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid UNIQUE REFERENCES app_user(user_id) ON DELETE RESTRICT,
    branch_id         uuid NOT NULL REFERENCES branch(branch_id) ON DELETE RESTRICT,
    customer_number   varchar(30) NOT NULL UNIQUE,
    nic_passport_no   varchar(50) NOT NULL UNIQUE,
    full_name         varchar(150) NOT NULL,
    date_of_birth     date NOT NULL CHECK (date_of_birth < CURRENT_DATE),
    gender            varchar(20),
    phone             varchar(20),
    address           varchar(255),
    email             varchar(150) NOT NULL UNIQUE,
    status            varchar(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz
);

CREATE INDEX idx_customer_branch ON customer(branch_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_customer_full_name_trgm ON customer USING gin (full_name gin_trgm_ops);

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (220, '0220_p02_m02_customer');

COMMIT;
```

### Step 3 — Write SQL Tests
Create file: `tests/db/customer-constraints.test.mjs`

1. ✅ A customer can be inserted with a unique `nic_passport_no`, `email`,
   `customer_number`
2. ✅ Duplicate `nic_passport_no` is rejected (`23505`) — this is the duplicate-identity
   detection SRS §6.7 requires
3. ✅ Duplicate `email` is rejected (`23505`)
4. ✅ `date_of_birth` in the future is rejected by the CHECK constraint
5. ✅ Inserting a customer with a non-existent `branch_id` is rejected (`23503`)
6. ✅ Trigram index exists and a `similarity()`/`%` search returns fuzzy matches
7. ✅ Deleting a branch referenced by a customer is rejected (`23503`)

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` §B.4 — mark the identity decision as resolved,
  update the `customer` table definition
- Update `.agent/open-questions.md` — OQ-05 resolved
- Update task status in `docs/09_task-tracker.md` → `DONE`
- **Write a handoff in `.agent/handoffs/`** — M3's `account_holder` (P02-M03-T02) and
  M1's RLS policies (P02-M01-T01) both depend on this table's final shape

---

## Acceptance Criteria
- [ ] OQ-05 resolved and recorded as an ADR before the migration is written
- [ ] Migration applies to a clean DB without errors
- [ ] `nic_passport_no`, `email`, `customer_number` are each `UNIQUE NOT NULL`
- [ ] Duplicate NIC raises `23505` (FR-CUS-04)
- [ ] Trigram index exists on `full_name`
- [ ] `date_of_birth` CHECK rejects future dates
- [ ] Handoff written for M1 and M3
- [ ] `npm run db:rebuild` succeeds from empty
