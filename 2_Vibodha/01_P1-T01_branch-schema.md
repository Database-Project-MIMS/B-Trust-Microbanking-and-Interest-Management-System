# 🔵 Phase 1 — Task 01: Branch Schema
**Task ID:** `P01-M02-T01` · **Branch:** `feat/p01-m02-branch-schema`
**Migration:** `0120_p01_m02_branch.sql` · **Status:** READY
**Depends on:** migration `0000`
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

Create the `branch` table — every other table in your slice (and several owned by other
members) hangs off it. This is your first task and is pure database work with no
dependency on M1's auth. `branch_code` must be unique (§4.2) and branches are
deactivated, never deleted (FR-ORG-05).

---

## Table to Create

### `branch`

| Column | Type | Constraints |
|---|---|---|
| `branch_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `branch_code` | `varchar(20)` | **UNIQUE, NOT NULL** — §4.2 |
| `branch_name` | `varchar(100)` | NOT NULL |
| `address` | `varchar(255)` | |
| `district` | `varchar(100)` | |
| `phone` | `varchar(20)` | |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `agent`, `customer`, `account`, `transaction`,
  `audit_log` (FR-ORG-05, BR-S7). Deactivate instead of deleting.
- **Note:** FR-ORG-01 requires ≥ 3 branches seeded eventually (M5's seed framework
  consumes this table in Phase 2) — your migration itself does not seed data, seeding
  is M5's job, but make sure the schema has no constraint that would block it.

---

## How to Implement

### Step 1 — Write the Migration
Create file: `database/migrations/0120_p01_m02_branch.sql`

```sql
-- Migration 0120: Branch schema (M2)
-- Table: branch — organisational root; referenced by agent, customer, account, transaction

BEGIN;

CREATE TABLE branch (
    branch_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_code   varchar(20) NOT NULL UNIQUE,
    branch_name   varchar(100) NOT NULL,
    address       varchar(255),
    district      varchar(100),
    phone         varchar(20),
    status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz
);

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (120, '0120_p01_m02_branch');

COMMIT;
```

### Step 2 — Write SQL Tests
Create file: `tests/db/branch-constraints.test.mjs`

Test these scenarios:
1. ✅ A branch can be inserted with a unique `branch_code`
2. ✅ Duplicate `branch_code` is rejected (error code `23505`)
3. ✅ NULL `branch_code` or `branch_name` is rejected
4. ✅ Invalid `status` values are rejected by the CHECK constraint
5. ✅ Default `status` is `'ACTIVE'` when omitted
6. ✅ A branch referenced by a foreign key (once `agent` exists in T02) cannot be
   physically deleted — add this case once T02 lands, or stub it with a manual FK insert

### Step 3 — Run & Verify
```bash
npm run db:rebuild    # Should apply all migrations cleanly
npm run db:verify     # Should pass
npm test              # Your new tests should pass
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` Part B row for `branch` (mark `branch_code` as
  implemented)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] `branch_code` is `UNIQUE NOT NULL`
- [ ] Duplicate `branch_code` raises `23505`
- [ ] Delete is `RESTRICT` once referenced (verify once `agent` exists)
- [ ] `status` CHECK constraint rejects anything outside `ACTIVE`/`INACTIVE`
- [ ] `npm run db:rebuild` succeeds from empty
