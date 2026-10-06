# 🟢 Phase 2 — Task 01: Customer Schema
**Task ID:** `P02-M02-T01` · **Branch:** `feat/p02-m02-customer-schema`
**Migration:** `0220_p02_m02_customer.sql` · **Status:** DONE — verified; PR #34 open, user-controlled merge pending
**Depends on:** ADR-0007 (G-20 resolved), `P01-M02-T02` (`agent`)
**Story Points:** ~4 · **Layer:** Database only

---

## ✅ Identity Decision — Approved

OQ-05 was resolved on 2026-09-29 by ADR-0007. Customers are primarily agent-managed,
so customer login is optional. Vibodha approved Phase 2 entry and explicitly requested
this task. The 2026-10-06 PR #34 conflict resolution preserves the implemented schema
and restores the closeout repairs from `dev`. See the [checkpoint](../.agent/checkpoints/phase-01-checkpoint.md).

The current ERD models `customer` as a subtype of `user` (`customer_id` is `PK,FK` into
`app_user`), which forces every one of the 15+ seeded customers to have login
credentials. The approved G-20 change makes `customer_id` an **independent surrogate
PK** with an optional `app_user_id uuid NULL UNIQUE FK → app_user`, so customer
self-service login is possible later without being mandatory now.

---

## Table to Create

### `customer` — independent identity with optional login (ADR-0007)

| Column | Type | Constraints |
|---|---|---|
| `customer_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** — independent surrogate |
| `app_user_id` | `uuid` | **NULL, UNIQUE, FK → app_user** — set only if self-service login is later enabled |
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
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now(), maintained by shared trigger |

**Keep these invariants:**
- **DELETE rule:** `RESTRICT` — referenced by `customer_agent`, `customer_document`,
  `account_holder` (Phase 2, M3).
- **Indexes:** `nic_passport_no` UNIQUE (duplicate-identity detection, SRS §6.7);
  `(branch_id)`; **trigram index** on `full_name` for search (`GET /api/customers`
  search).
- **Invariant:** `date_of_birth` in the past; ≥ 15 customers eventually seeded
  (FR-CUS-05, M5's job in Phase 2 seed sets).

---

## How to Implement

### Step 1 — Confirm the approved identity contract
Read ADR-0007 and G-20. Use an independent `customer_id` and nullable unique
`app_user_id`; do not restore the ERD subtype design.

### Step 2 — Write the Migration
Create file: `database/migrations/0220_p02_m02_customer.sql` using the approved
independent-surrogate-PK design:

```sql
-- Migration 0220: Customer schema (M2)
-- Table: customer — independent surrogate PK; optional link to app_user (G-20)

BEGIN;

CREATE TABLE customer (
    customer_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id       uuid UNIQUE REFERENCES app_user(user_id) ON DELETE RESTRICT,
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

-- The runner records filename/checksum; do not insert version/name into the ledger.

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
npm run verify:customer-schema  # disposable rebuild, customer + organization tests, typecheck/lint
```

This invokes db:rebuild only inside its own temporary cluster. The present checkout's
legacy migration-runner test resets mims_dev and edits a real migration, so it is
excluded. Normal development DB verification can use `npm run db:verify` after the
additive migration. Do not run the legacy rebuild as an ordinary test against your data.

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` §B.4 — mark the identity decision as resolved,
  update the `customer` table definition
- Update `.agent/open-questions.md` — OQ-05 resolved
- Update task status in `docs/09_task-tracker.md` → `DONE`
- **Write a handoff in `.agent/handoffs/`** — M3's `account_holder` (P02-M03-T02) and
  M1's RLS policies (P02-M01-T01) both depend on this table's final shape

---

## Acceptance Criteria
- [x] OQ-05 resolved and recorded as ADR-0007 before the migration is written
- [x] Migration applies to a clean DB without errors
- [x] `nic_passport_no`, `email`, `customer_number` are each `UNIQUE NOT NULL`
- [x] Duplicate NIC raises `23505` (FR-CUS-04)
- [x] Trigram index exists on `full_name`
- [x] `date_of_birth` CHECK rejects future dates and today
- [x] Handoff written for M1 and M3
- [x] `npm run db:rebuild` succeeds from empty inside the disposable verification cluster

Implemented source: [0220 migration](../database/migrations/0220_p02_m02_customer.sql).
The example above is illustrative; the actual migration uses named constraints,
`ix_customer_branch`/`ix_customer_full_name_trgm` and the shared timestamp trigger.
Verification: `npm run verify:customer-schema` — 65 tests pass (27 customer), clean
rebuild, typecheck and lint pass. Local 0220 application/verification also passes.
Handoff: [customer schema](../.agent/handoffs/p02-m02-t01-customer-schema.md).
No customer API/UI is part of T01. No commit, merge or PR was created.
