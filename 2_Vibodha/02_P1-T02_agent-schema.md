# 🔵 Phase 1 — Task 02: Agent Schema
**Task ID:** `P01-M02-T02` · **Branch:** `feat/p01-m02-agent-schema`
**Migration:** `0121_p01_m02_agent.sql` · **Status:** READY
**Depends on:** T01 (`branch`), `P01-M01-T01` (`app_user` from M1)
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

Create the `agent` table as a **subtype of `app_user`** — `agent_id` is both the PK and
an FK into `app_user(user_id)`, so every agent has a login. This table enforces
FR-ORG-02: each active agent belongs to **exactly one active branch** (a single
`branch_id` column on the row, not a many-to-many table — an agent transfers branch by
updating this column, effective-dated per FR-ORG-04).

**Wait for M1's `app_user` table (`P01-M01-T01`) to land before writing the FK** — check
`.agent/handoffs/` or `docs/09_task-tracker.md` for its status. Database work otherwise
has no cross-member dependency.

---

## Table to Create

### `agent`
Subtype of `app_user` — `agent_id` is both PK and FK, so every agent has a login.

| Column | Type | Constraints |
|---|---|---|
| `agent_id` | `uuid` | **PK, FK → app_user(user_id)** |
| `branch_id` | `uuid` | **FK → branch, NOT NULL** |
| `employee_no` | `varchar(30)` | **UNIQUE, NOT NULL** — §4.2 |
| `nic_passport_no` | `varchar(50)` | **UNIQUE, NOT NULL** |
| `full_name` | `varchar(150)` | NOT NULL |
| `date_of_birth` | `date` | |
| `gender` | `varchar(20)` | |
| `phone` | `varchar(20)` | |
| `address` | `varchar(255)` | |
| `email` | `varchar(150)` | **UNIQUE, NOT NULL** |
| `hired_date` | `date` | |
| `status` | `varchar(20)` | NOT NULL DEFAULT `'ACTIVE'`, `CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED'))` — FR-ORG-03 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `account.opened_by_agent_id`,
  `customer_agent`, `transaction.agent_id` (Phase 3).
- **Index:** `(branch_id, status)` for branch-scoped listing.
- **Invariant (FR-ORG-02):** each active agent belongs to exactly one active branch.
  Because `branch_id` is a single column (not a join table), this is automatically true
  by construction — there is nowhere to store a second branch. Branch **transfer**
  simply updates `branch_id`; if you need to preserve *which branch an agent was in when
  a historical transaction happened*, that is what `transaction.branch_id` in Phase 3
  (G-07) is for — do not try to make `agent.branch_id` itself effective-dated unless a
  handoff from the team says otherwise.

---

## How to Implement

### Step 1 — Confirm the Dependency
```bash
grep -n "P01-M01-T01" docs/09_task-tracker.md
```
If it is not `DONE` or `REVIEW`, check `.agent/handoffs/` for M1's `app_user` column
list before writing the FK. If it's genuinely blocking, say so and stop rather than
guessing the column names.

### Step 2 — Write the Migration
Create file: `database/migrations/0121_p01_m02_agent.sql`

```sql
-- Migration 0121: Agent schema (M2)
-- Table: agent — subtype of app_user; every agent has a login

BEGIN;

CREATE TABLE agent (
    agent_id          uuid PRIMARY KEY REFERENCES app_user(user_id) ON DELETE RESTRICT,
    branch_id         uuid NOT NULL REFERENCES branch(branch_id) ON DELETE RESTRICT,
    employee_no       varchar(30) NOT NULL UNIQUE,
    nic_passport_no   varchar(50) NOT NULL UNIQUE,
    full_name         varchar(150) NOT NULL,
    date_of_birth     date,
    gender            varchar(20),
    phone             varchar(20),
    address           varchar(255),
    email             varchar(150) NOT NULL UNIQUE,
    hired_date        date,
    status            varchar(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz
);

CREATE INDEX idx_agent_branch_status ON agent(branch_id, status);

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (121, '0121_p01_m02_agent');

COMMIT;
```

### Step 3 — Write SQL Tests
Create file: `tests/db/agent-constraints.test.mjs`

Test these scenarios:
1. ✅ An agent can be inserted once a matching `app_user` row exists
2. ✅ Duplicate `employee_no` is rejected (`23505`)
3. ✅ Duplicate `nic_passport_no` is rejected (`23505`)
4. ✅ Duplicate `email` is rejected (`23505`)
5. ✅ Inserting an agent with a non-existent `branch_id` is rejected (`23503`)
6. ✅ Inserting an agent with a non-existent `agent_id` (no matching `app_user`) is
   rejected (`23503`)
7. ✅ Deleting a branch referenced by an active agent is rejected (`23503`) — proves the
   T01 `RESTRICT` rule
8. ✅ Invalid `status` values are rejected

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` Part B row for `agent` (`employee_no`, `hired_date`,
  `status` — mark as implemented)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors, after M1's `app_user` migration
- [ ] `employee_no`, `nic_passport_no`, `email` are each `UNIQUE NOT NULL`
- [ ] `branch_id` FK enforced; deleting a referenced branch is rejected
- [ ] `status` CHECK constraint matches FR-ORG-03 (`ACTIVE`/`INACTIVE`/`SUSPENDED`)
- [ ] Index `(branch_id, status)` exists
- [ ] `npm run db:rebuild` succeeds from empty
