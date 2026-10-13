# 🟡 Phase 2 — Member 5 Task: Seed Sets 1–3
**Task ID:** `P02-M05-T01`  
**Branch:** `feat/p02-m05-seed-sets-1-3`  
**Migration Block:** `0280–0299`  
**Depends on:** P02-M03-T04 (`sp_open_savings_account`), P01-M05-T03 (seed framework)  
**Story Points:** ~6 · **Layer:** Database

---

## Overview

Phase 2 is when the system gets its first real data: branches, agents, customers, accounts, and two joint accounts. Your job is to **assemble** everyone's seed contributions into a deterministic, loadable data set. Other members supply their table's seed rows; you integrate, assign UUIDs, and verify.

---

## What to Do

Create seed SQL files for the first three data sets covering all the tables that exist by the end of Phase 2.

### Seed Set 1 — Organisational Data
- **3+ branches** with fixed UUIDs (FR-ORG-01)
- **6+ agents** spread across branches, each linked to an `app_user`
- Agents have unique `employee_no`, `nic_passport_no`, `email`

### Seed Set 2 — Customer Data
- **15+ customers** registered at branches (FR-CUS-05)
- Each customer has at least one `customer_document`
- Each customer has exactly one active `customer_agent` assignment
- Mix of ages: children (< 12), teens (12–17), adults (18–59), seniors (60+) for eligibility testing

### Seed Set 3 — Account Data
- **10+ savings accounts** across all five plan types (FR-ACC-06)
- **2+ joint accounts** with 2–4 adult holders and `joint_mandate` records
- At least one account per plan type
- Initial balances that will support Phase 3 transactions and Phase 4 FD opening

---

## How to Implement

### Step 1 — Collect Seed Data from Members

| Member | Tables They Supply | Status |
|---|---|---|
| M1 | `role`, `app_user`, `user_session` (optional) | Wait for their rows |
| M2 | `branch`, `agent`, `customer`, `customer_agent`, `customer_document` | Wait for their rows |
| M3 | `savings_plan` (already migrated), `account`, `account_holder`, `joint_mandate` | Wait for their rows |
| M4 | `transaction_channel` (already migrated) | Already done |
| M5 (you) | `fd_plan` (already migrated) | Already done |

### Step 2 — Assign Fixed UUIDs

Use the UUID scheme from `_uuids.sql`. Extend it for all new entities:

```sql
-- Customers (entity type 04)
-- 00000000-0000-0000-0401-000000000001  Nimal Perera (Adult)
-- 00000000-0000-0000-0401-000000000002  Kamala Silva (Senior)
-- 00000000-0000-0000-0401-000000000003  Saman Jayawardena (Adult)
-- ... etc.

-- Accounts (entity type 05)
-- 00000000-0000-0000-0501-000000000001  Children account
-- 00000000-0000-0000-0501-000000000002  Teen account
-- 00000000-0000-0000-0501-000000000003  Adult account #1
-- ... etc.
```

### Step 3 — Write the Seed Files

Update the files in `database/seed/` with real data. Each file uses `INSERT ... ON CONFLICT DO NOTHING` for idempotency:

```sql
-- database/seed/04_customers.sql
INSERT INTO customer (customer_id, branch_id, nic_passport_no, full_name, 
                      date_of_birth, gender, phone, address, email)
VALUES
    ('00000000-0000-0000-0401-000000000001', 
     '00000000-0000-0000-0101-000000000001', -- Colombo Main
     '199012345678', 'Nimal Perera',
     '1990-05-15', 'MALE', '0771234567',
     '123 Galle Road, Colombo 03', 'nimal@example.com')
    -- ... 14 more customers
ON CONFLICT DO NOTHING;
```

### Step 4 — Verify

```bash
npm run db:rebuild
npm run db:seed
npm run db:seed-check
```

Check:
- ≥ 3 branches
- ≥ 5 agents  
- ≥ 15 customers
- ≥ 10 accounts
- ≥ 2 joint accounts (with mandates)
- All five plan types represented
- Balances sufficient for Phase 3 and Phase 4

### Step 5 — Update Docs
- Update `docs/06_seed-data-spec.md` with data set descriptions
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] ≥ 15 customers across ≥ 3 branches with mixed ages
- [ ] ≥ 10 accounts covering all 5 savings plan types
- [ ] ≥ 2 joint accounts with 2–4 holders and `joint_mandate` records
- [ ] All UUIDs are fixed (deterministic)
- [ ] Seeding twice produces identical data
- [ ] `npm run db:seed-check` reports all minimums met
- [ ] FK integrity holds — no orphan records
