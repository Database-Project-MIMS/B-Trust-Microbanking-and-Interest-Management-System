# 🔵 Phase 1 — Task 03: Seed Framework
**Task ID:** `P01-M05-T03` · **Branch:** `feat/p01-m05-seed-framework`  
**Status:** READY · **Depends on:** P01-M05-T01  
**Story Points:** ~2 · **Layer:** Database + Scripts  
**⚡ Publishes Integration Point I-8 — ALL 4 OTHER MEMBERS DEPEND ON THIS**

---

## What This Task Is

Build the seed data infrastructure that all five members will use to populate the database with deterministic sample data. You **own** the `database/seed/` directory — other members supply their table's seed rows, and you integrate them into a single, ordered, repeatable load.

---

## What to Build

### 1. Seed Directory Layout

```
database/seed/
├── 00_roles.sql                    # M1 supplies, you integrate
├── 01_branches.sql                 # M2 supplies
├── 02_users.sql                    # M1 supplies
├── 03_agents.sql                   # M2 supplies
├── 04_customers.sql                # M2 supplies
├── 05_customer_agents.sql          # M2 supplies
├── 06_customer_documents.sql       # M2 supplies
├── 07_savings_plans.sql            # M3 supplies (already seeded in migration)
├── 08_fd_plans.sql                 # Already seeded in your migration 0180
├── 09_transaction_channels.sql     # M4 supplies (already seeded)
├── 10_accounts.sql                 # M3 supplies
├── 11_account_holders.sql          # M3 supplies
├── 12_joint_mandates.sql           # M3 supplies
├── 13_transactions.sql             # M4 supplies (Phase 3)
├── 14_fixed_deposits.sql           # You supply (Phase 4)
├── 15_interest_runs.sql            # You supply (Phase 4)
├── _uuids.sql                      # Fixed UUID declarations
└── _load-order.txt                 # Explicit load order
```

### 2. Fixed UUID Scheme (`_uuids.sql`)

Every seed row uses a **fixed, deterministic UUID** — not `gen_random_uuid()`. This guarantees that seeding twice produces identical data.

```sql
-- Fixed UUID scheme for seed data
-- Pattern: 00000000-0000-0000-XXYY-ZZZZZZZZZZZ0
-- XX = entity type, YY = sequence, ZZ = padding

-- Branches
-- 00000000-0000-0000-0101-000000000001  Branch: Colombo Main
-- 00000000-0000-0000-0101-000000000002  Branch: Kandy
-- 00000000-0000-0000-0101-000000000003  Branch: Galle

-- Roles
-- 00000000-0000-0000-0201-000000000001  Role: ADMIN
-- 00000000-0000-0000-0201-000000000002  Role: CENTRAL_OPS
-- ... etc.
```

**Rules:**
- Every UUID is unique across ALL seed files
- Entity type codes are documented in `_uuids.sql`
- New members extending seed data follow the same pattern
- UUIDs are **never** `gen_random_uuid()` in seed files

### 3. Ordered Load Script

Create `scripts/seed.mjs`:

```javascript
// Reads _load-order.txt and executes each SQL file in sequence.
// Respects FK dependencies: branches before agents, agents before customers, etc.
// Wraps the entire load in a single transaction.
```

### 4. Seed Verification Script

Create `scripts/seed-check.mjs`:

```javascript
// Verifies that:
// 1. Row counts match expected minimums (AC-12)
// 2. Seeding twice produces identical row counts
// 3. Financial totals are identical across runs
// 4. FK integrity holds
```

**Minimum counts (from acceptance criteria):**

| Entity | Minimum | Source |
|---|---|---|
| Branches | 3 | FR-ORG-01 |
| Agents | 5 | FR-ORG-01 |
| Customers | 15 | FR-CUS-05 |
| Accounts | 10 | FR-ACC-06 |
| Joint accounts | 2 | FR-ACC-06 |
| FD products | 3 | BR-13 |
| Fixed deposits | 10 | FR-FD-05 |
| Transactions | 100 | FR-TXN-06 |

---

## How to Implement

### Step 1 — Create the UUID Scheme
Write `database/seed/_uuids.sql` with the complete entity-type mapping and initial UUIDs for roles, branches, and FD plans.

### Step 2 — Create the Load Order
Write `database/seed/_load-order.txt`:
```
00_roles.sql
01_branches.sql
02_users.sql
03_agents.sql
...
```

### Step 3 — Write the Seed Script (`scripts/seed.mjs`)

```javascript
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../lib/db/pool.mjs';

const SEED_DIR = join(import.meta.dirname, '..', 'database', 'seed');
const loadOrder = readFileSync(join(SEED_DIR, '_load-order.txt'), 'utf8')
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'));

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of loadOrder) {
      const sql = readFileSync(join(SEED_DIR, file), 'utf8');
      console.log(`Seeding: ${file}`);
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
```

### Step 4 — Write the Verification Script (`scripts/seed-check.mjs`)

Check row counts match minimums. Run the seed twice and compare.

### Step 5 — Write the Handoff (CRITICAL!)

Create `.agent/handoffs/i8-seed-framework.md`:

```markdown
# Integration Point I-8: Seed Framework

## How to add seed data for your tables

1. Create a file in `database/seed/` with the correct number prefix
2. Use fixed UUIDs from `_uuids.sql` — NEVER gen_random_uuid()
3. Follow the FK load order (your file depends on parent tables)
4. Submit your seed file — M5 integrates it into the load order
5. Run `npm run db:seed && npm run db:seed-check` to verify

## UUID scheme
See `database/seed/_uuids.sql` for the pattern.

## Minimum row counts
See the table in this handoff and AC-12.
```

### Step 6 — Write Tests

| Test | What it verifies |
|---|---|
| Seeding once → correct row counts | Minimum data present |
| Seeding twice → identical row counts | Determinism |
| Seeding twice → identical financial totals | No random data |
| FK integrity holds after seed | Referential integrity |

### Step 7 — Update Docs
- Update `docs/06_seed-data-spec.md` with the UUID scheme and load order
- Update task status in `docs/09_task-tracker.md` → `DONE`
- **Publish the I-8 handoff immediately!**

---

## Acceptance Criteria
- [ ] `database/seed/` layout exists with fixed-UUID scheme
- [ ] Seeding twice produces **identical** row counts and financial totals
- [ ] Load order respects FK dependencies
- [ ] `scripts/seed-check.mjs` validates minimum counts (AC-12)
- [ ] Handoff published for other members (I-8)
- [ ] `npm run db:rebuild && npm run db:seed` succeeds from empty
