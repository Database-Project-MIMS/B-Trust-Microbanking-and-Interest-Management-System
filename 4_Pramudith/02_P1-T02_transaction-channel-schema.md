# 🔵 Phase 1 — Task 02: Transaction Channel Schema
**Task ID:** `P01-M04-T02` · **Branch:** `feat/p01-m04-transaction-channel-schema`
**Migration:** `0160_p01_m04_transaction_channel.sql` · **Status:** READY
**Depends on:** migration `0000`
**Story Points:** ~2 · **Layer:** Database only

---

## What This Task Is

A small reference table — the channel a transaction was posted through. Simple, pure
database work, no cross-member dependency. Seeds exactly the three channels the project
needs: `BRANCH_COUNTER`, `ONLINE`, `SYSTEM` (the last one used by the central interest
run in Phase 4).

---

## Table to Create

### `transaction_channel`

| Column | Type | Constraints |
|---|---|---|
| `channel_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `channel_name` | `varchar(100)` | **UNIQUE, NOT NULL** |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE'))` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- **DELETE rule:** `RESTRICT` — referenced by `transaction`.
- **Seed exactly 3 channels:**
  - `BRANCH_COUNTER` — in-person transactions at a branch
  - `ONLINE` — online/self-service transactions
  - `SYSTEM` — used exclusively by the central interest run (Phase 4, `INTEREST_CREDIT`
    rows)

---

## How to Implement

### Step 1 — Write the Migration
Create file: `database/migrations/0160_p01_m04_transaction_channel.sql`

```sql
-- Migration 0160: Transaction channel schema (M4)
-- Table: transaction_channel — seeds BRANCH_COUNTER, ONLINE, SYSTEM

BEGIN;

CREATE TABLE transaction_channel (
    channel_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name  varchar(100) NOT NULL UNIQUE,
    status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO transaction_channel (channel_name)
VALUES ('BRANCH_COUNTER'), ('ONLINE'), ('SYSTEM');

INSERT INTO schema_migration(version, name)
VALUES (160, '0160_p01_m04_transaction_channel');

COMMIT;
```

### Step 2 — Write SQL Tests
Create file: `tests/db/transaction-channel-constraints.test.mjs`

1. ✅ Exactly the three seeded channels exist (`BRANCH_COUNTER`, `ONLINE`, `SYSTEM`)
2. ✅ Duplicate `channel_name` is rejected (`23505`)
3. ✅ Invalid `status` values are rejected
4. ✅ Deleting a channel referenced by a transaction (once `transaction` exists in
   Phase 2) is rejected — stub or defer this specific case to Phase 2

### Step 3 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` — `transaction_channel` table (already listed in
  Part A, confirm it matches exactly)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] Exactly `BRANCH_COUNTER`, `ONLINE`, `SYSTEM` exist after seeding
- [ ] `channel_name` is `UNIQUE NOT NULL`
- [ ] `npm run db:rebuild` succeeds from empty
