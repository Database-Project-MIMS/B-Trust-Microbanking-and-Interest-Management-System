# Notes for P2-T01: Seed Sets 1-3

## Overview
This document logs the progress, decisions, and implementations for Phase 2, Task 1 (P02-M05-T01). As the steward of the seed data framework, my goal is to assemble the deterministic seed sets for Organisational Data (Set 1), Customer Data (Set 2), and Account Data (Set 3) using the fixed UUID scheme established in P01-M05-T03.

---

## Step 1 Execution: Collect Seed Data from Members

### What I Did
I audited every migration file in `database/migrations/` and the live database to determine which tables exist and which columns they have. I then cross-referenced this with the task tracker (`docs/09_task-tracker.md`) to confirm what other members have or haven't completed.

### Tables That EXIST (Phase 1 — completed by other members)

#### `role` table (M1 — Nadija, migration `0100`)
| Column | Type | Notes |
|---|---|---|
| `role_id` | `uuid` PK | `DEFAULT gen_random_uuid()` — we override with fixed UUID |
| `role_name` | `varchar(50)` UNIQUE | e.g. 'ADMIN', 'AGENT' |
| `description` | `varchar(255)` | Optional |
| `status` | `varchar(20)` | CHECK: 'ACTIVE' or 'INACTIVE' |
| `created_at` | `timestamptz` | auto |
| `updated_at` | `timestamptz` | auto via trigger |

**Roles already known from the UUID scheme:** ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, CUSTOMER, AUDITOR, SYSTEM (7 total).

#### `app_user` table (M1 — Nadija, migration `0100`)
| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK | `DEFAULT gen_random_uuid()` — we override |
| `role_id` | `uuid` FK → `role` | ON DELETE RESTRICT |
| `username` | `varchar(100)` UNIQUE | Login name |
| `password_hash` | `varchar(255)` | Argon2id hash — we need a valid hash for seed users |
| `status` | `varchar(20)` | CHECK: 'ACTIVE', 'INACTIVE', 'SUSPENDED' |
| `registered_date` | `date` | DEFAULT CURRENT_DATE |
| `last_login` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | auto |
| `updated_at` | `timestamptz` | auto |

**Important:** The `agent` table's PK (`agent_id`) references `app_user(user_id)`. So every agent MUST have a corresponding `app_user` row inserted first. The `password_hash` column requires a valid argon2id hash string.

#### `branch` table (M2 — Vibodha, migration `0120`)
| Column | Type | Notes |
|---|---|---|
| `branch_id` | `uuid` PK | `DEFAULT gen_random_uuid()` — we override |
| `branch_code` | `varchar(20)` UNIQUE | e.g. 'BR-COL' |
| `branch_name` | `varchar(100)` | e.g. 'Colombo Main' |
| `address` | `varchar(255)` | Required |
| `district` | `varchar(100)` | Required |
| `phone` | `varchar(20)` | Required |
| `status` | `record_status` domain | DEFAULT 'ACTIVE' |
| `created_at` | `timestamptz` | auto |
| `updated_at` | `timestamptz` | auto |

#### `agent` table (M2 — Vibodha, migration `0121`)
| Column | Type | Notes |
|---|---|---|
| `agent_id` | `uuid` PK | FK → `app_user(user_id)` ON DELETE RESTRICT (shared PK!) |
| `branch_id` | `uuid` FK → `branch` | ON DELETE RESTRICT |
| `employee_no` | `varchar(30)` UNIQUE | e.g. 'EMP001' |
| `nic_passport_no` | `varchar(50)` UNIQUE | NIC or passport |
| `full_name` | `varchar(150)` | |
| `date_of_birth` | `date` | |
| `gender` | `varchar(20)` | e.g. 'MALE', 'FEMALE' |
| `phone` | `varchar(20)` | |
| `address` | `varchar(255)` | |
| `email` | `varchar(150)` UNIQUE | |
| `hired_date` | `date` | |
| `status` | `record_status` domain | DEFAULT 'ACTIVE' |
| `created_at` | `timestamptz` | auto |
| `updated_at` | `timestamptz` | auto |

**Trigger:** Active agent must belong to an active branch (`fn_validate_agent_active_branch`).
**Critical FK pattern:** `agent_id` = `app_user.user_id`. This means we must insert an `app_user` row first, then insert an `agent` row using the SAME UUID as the `agent_id`.

#### `savings_plan` table (M3 — Nisith, migration `0140`)
Already seeded in the migration itself with 5 plans (Children, Teen, Adult, Senior, Joint). **We do NOT need to seed this table** — the data is baked into the migration.

#### `fd_plan` table (M5 — Selith/me, migration `0180`)
Already seeded in the migration itself with 3 plans (6 Month, 1 Year, 3 Year). **We do NOT need to seed this table** — the data is baked into the migration.

---

### Tables That DO NOT EXIST Yet (Phase 2 — other members have NOT completed)

The following tables are required for Seed Sets 2 and 3 but their migrations have NOT been written yet. No migration files exist for them in `database/migrations/`, and no remote branches contain Phase 2 work.

| Table | Owner | Task ID | Status | What It Blocks |
|---|---|---|---|---|
| `customer` | M2 (Vibodha) | P02-M02-T01 | ❌ TODO | Seed Set 2 — cannot seed customers |
| `customer_agent` | M2 (Vibodha) | P02-M02-T02 | ❌ TODO | Seed Set 2 — cannot assign agents to customers |
| `customer_document` | M2 (Vibodha) | P02-M02-T03 | ❌ TODO | Seed Set 2 — cannot attach documents to customers |
| `account` | M3 (Nisith) | P02-M03-T01 | ❌ TODO | Seed Set 3 — cannot seed accounts |
| `account_holder` | M3 (Nisith) | P02-M03-T02 | ❌ TODO | Seed Set 3 — cannot link customers to accounts |
| `joint_mandate` | M3 (Nisith) | P02-M03-T03 | ❌ TODO | Seed Set 3 — cannot create joint account mandates |
| `transaction` | M4 (Pramudith) | P02-M04-T01 | ❌ TODO | Future Seed Set 4 — cannot seed transactions |

Additionally, `P02-M02-T01` (customer schema) is blocked by **OQ-05** — an unresolved open question about customer identity/login (G-20) that the team and lecturer need to decide on.

---

### What We CAN Seed Right Now

Based on the analysis above, we can immediately create:

1. **`00_roles.sql`** — 7 system roles (ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, CUSTOMER, AUDITOR, SYSTEM)
2. **`01_branches.sql`** — 3 branches (Colombo Main, Kandy City, Galle Fort)
3. **`02_users.sql`** — 9+ app_user rows (1 admin, 2+ branch managers, 6+ agents)
4. **`03_agents.sql`** — 6+ agent profiles linked to their app_user rows

This covers **Seed Set 1 (Organisational Data)** completely.

### What We CANNOT Seed Yet

- **`04_customers.sql`** — Blocked on M2's `P02-M02-T01` (customer schema)
- **`05_customer_agents.sql`** — Blocked on M2's `P02-M02-T02` (customer_agent schema)
- **`06_customer_documents.sql`** — Blocked on M2's `P02-M02-T03` (customer_document schema)
- **`10_accounts.sql`** — Blocked on M3's `P02-M03-T01` (account schema)
- **`11_account_holders.sql`** — Blocked on M3's `P02-M03-T02` (account_holder schema)
- **`12_joint_mandates.sql`** — Blocked on M3's `P02-M03-T03` (joint_mandate schema)

### Why I Did It
Before writing any seed SQL, I must understand the exact column names, types, constraints, and foreign key relationships of every table I'm inserting into. Blindly guessing column names would result in failed INSERTs. Additionally, by documenting what's missing, I create a clear record for the team showing exactly what I'm blocked on and who needs to deliver what. This prevents any finger-pointing later and gives me a concrete "unblocked" checklist.

---

## Step 2 Execution: Create Seed Set 1 (Organisational)
### What I Did
[Pending...]

### Why I Did It
[Pending...]

## Step 3 Execution: Create Seed Set 2 (Customer)
### What I Did
[BLOCKED — waiting on M2 (Vibodha) to complete P02-M02-T01, P02-M02-T02, P02-M02-T03]

### Why I Did It
[N/A — cannot proceed until customer, customer_agent, and customer_document tables exist]

## Step 4 Execution: Create Seed Set 3 (Account)
### What I Did
[BLOCKED — waiting on M3 (Nisith) to complete P02-M03-T01, P02-M03-T02, P02-M03-T03]

### Why I Did It
[N/A — cannot proceed until account, account_holder, and joint_mandate tables exist]
