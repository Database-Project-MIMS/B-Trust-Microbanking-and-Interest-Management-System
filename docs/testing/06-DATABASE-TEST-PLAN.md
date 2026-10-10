# 06 — Database Test Plan

How to prove, directly in PostgreSQL, that every important constraint, function,
procedure, trigger, view, RLS policy and grant does what it should. Each test has
ready-to-run SQL, including the cases that **must be rejected**.

The definitions come from `database/migrations/*.sql`, `database/routines/*.sql`,
`database/views/*.sql` and `database/roles/01_app_grants.sql`. Where a later migration
replaces an object, the **final** definition is tested. Column meanings are the same as
in 04.

---

## 0. How to run these tests

### 0.1 Connections

| Label | Connect as | Use for | Why |
|---|---|---|---|
| **owner** | `psql "$DATABASE_MIGRATION_URL"` (role `mims_owner`) | Constraints, triggers, procedures, views | The owner owns every table, so **RLS is bypassed** (no table uses `FORCE ROW LEVEL SECURITY`). Constraints and triggers still apply |
| **app** | `psql "$DATABASE_URL"` (role `mims_app`) | Grants, RLS, anything the website does | The website runs as `mims_app` |

`mims_readonly` does **not** exist, although some docs mention it.

### 0.2 Rules

1. Every block starts with `BEGIN;` and ends with `ROLLBACK;`, so **nothing is saved**.
2. For a **negative** test the error message *is* the expected result. After an error the
   transaction is aborted. Type `ROLLBACK;` and continue.
3. In psql turn **off** `ON_ERROR_STOP` (`\set ON_ERROR_STOP off`). In pgAdmin turn off
   auto-commit.
4. Run against a freshly seeded `mims_dev` (`npm run db:rebuild -- --reset`), or straight
   after the 04 session if you want to see its data.
5. PostgreSQL does not allow subqueries as `CALL` arguments, so procedure calls are wrapped
   in `DO $$ … $$` blocks with variables. That also works in pgAdmin.

### 0.3 Reusable snippets

**Open business hours for today, inside the test transaction only** (posting routines
refuse outside 08:30–17:00 Colombo):

```sql
INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, true, '00:00', '23:59:59', 'db test window')
ON CONFLICT (calendar_date) DO UPDATE
  SET is_business_day = true, open_time = '00:00', close_time = '23:59:59';
```

**Set the RLS / actor context** (what `lib/db/rls-context.ts` does for each request).
Replace the three values as needed:

```sql
SELECT set_config('app.current_user_id',   '00000000-0000-0000-0401-000000000011', true),  -- agent_c1
       set_config('app.current_branch_id', '00000000-0000-0000-0101-000000000001', true),  -- Colombo
       set_config('app.current_user_role', 'AGENT', true);
```

| Context | user_id | branch_id | role |
|---|---|---|---|
| agent_c1 | `…0401-000000000011` | Colombo `…0101-000000000001` | `AGENT` |
| agent_k1 | `…0401-000000000013` | Kandy `…0101-000000000002` | `AGENT` |
| bm_colombo | `…0401-000000000002` | Colombo | `BRANCH_MANAGER` |
| bm_kandy | `…0401-000000000003` | Kandy | `BRANCH_MANAGER` |
| central_ops | `…0401-000000000021` | `''` (empty) | `CENTRAL_OPS` |
| admin | `…0401-000000000001` | `''` | `ADMIN` |
| customer_adult_one | `…0401-000000000023` | `''` | `CUSTOMER` |

(`…` = `00000000-0000-0000-`.)

---

## 1. Seed data for testers

Run as **owner** right after a rebuild. Expected values come from `database/seed/*.sql`.

```sql
-- DB-SEED-01: row counts
SELECT 'role' t, count(*) FROM role UNION ALL
SELECT 'app_user', count(*) FROM app_user UNION ALL
SELECT 'branch', count(*) FROM branch UNION ALL
SELECT 'agent (incl. managers)', count(*) FROM agent UNION ALL
SELECT 'customer', count(*) FROM customer UNION ALL
SELECT 'account', count(*) FROM account UNION ALL
SELECT 'account_holder', count(*) FROM account_holder UNION ALL
SELECT 'joint_mandate', count(*) FROM joint_mandate UNION ALL
SELECT 'transaction', count(*) FROM transaction UNION ALL
SELECT 'fixed_deposit', count(*) FROM fixed_deposit UNION ALL
SELECT 'interest_run', count(*) FROM interest_run UNION ALL
SELECT 'interest_payout', count(*) FROM interest_payout UNION ALL
SELECT 'savings_plan', count(*) FROM savings_plan UNION ALL
SELECT 'fd_plan', count(*) FROM fd_plan UNION ALL
SELECT 'transaction_channel', count(*) FROM transaction_channel UNION ALL
SELECT 'system_parameter', count(*) FROM system_parameter;
```

Expected counts:

| Table | Count | Table | Count |
|---|---|---|---|
| role | 7 | account | 10 |
| app_user | 14 | account_holder | 13 (8 single-holder accounts + 2 on BR-COL-00000005 + 3 on BR-KAN-00000001) |
| branch | 3 | joint_mandate | 2 |
| agent (incl. managers) | 9 (6 agents + 3 managers) | transaction | ≈191 (AC-12 needs ≥100) |
| customer | 15 | fixed_deposit | 12 (10 ACTIVE, 2 MATURED) |
| savings_plan | 5 | interest_run | 3 (2026-02-01, 2026-03-03, 2026-04-02) |
| fd_plan | 3 | interest_payout | 30 |
| transaction_channel | 3 | system_parameter | 9 |

```sql
-- Handy overview of the seeded accounts
SELECT a.account_id, a.account_number, p.plan_name, b.branch_code, a.status, a.current_balance,
       string_agg(c.full_name || ' (' || h.holder_type || ')', ', ' ORDER BY h.holder_type DESC) AS holders,
       jm.mandate_type,
       (SELECT count(*) FROM fixed_deposit f WHERE f.account_id = a.account_id AND f.status = 'ACTIVE') AS active_fds
FROM account a
JOIN savings_plan p ON p.plan_id = a.plan_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN account_holder h ON h.account_id = a.account_id
JOIN customer c ON c.customer_id = h.customer_id
LEFT JOIN joint_mandate jm ON jm.account_id = a.account_id
GROUP BY a.account_id, p.plan_name, b.branch_code, jm.mandate_type
ORDER BY a.account_number;
```

**Fixtures the plan relies on:**

| Account | Plan | Holders |
|---|---|---|
| `…0801-…003` BR-COL-00000003 | Adult | customer 03, the CUSTOMER login |
| `…0801-…002` BR-COL-00000002 | Teen | min 500 |
| `…0801-…005` BR-COL-00000005 | Joint **ANY_ONE** | 03 + 04 |
| `…0801-…006` BR-KAN-00000001 | Joint **ALL_HOLDERS** | 08 + 09 + 10, required 3 |

- Every seeded account has an ACTIVE FD; FDs `…0901-…011/012` are MATURED.
- All 15 customers have a verified document.
- Agent assignments: agent_c1 → customers 01–04, agent_c2 → 05.
- Savings plan, FD plan and channel IDs are **random per rebuild**. Look them up by name.

---

## 2. Setup and schema health

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-SETUP-01 | `scripts/db-rebuild.mjs`, `verify-setup.mjs` | Schema rebuilds from empty and passes checks | Empty or `--reset` DB | `npm run db:rebuild -- --reset` then `npm run db:verify` | Both succeed; verify reports PG ≥15, all migrations recorded with matching checksums, 4 domains, no float money, PK on every table | SQL + npm | Covered by existing test (`tests/db/migration-runner.test.mjs`) | Pramudith | Selith | Not run | Wipes `mims_dev` |
| DB-SETUP-02 | `schema_migration` | Every migration file recorded once | After rebuild | `SELECT count(*), max(filename) FROM schema_migration;` | 51 rows; max `0620_p06_m02_interest_reference.sql` | SQL | Covered by existing test (`tests/db/migration-runner.test.mjs`) | Pramudith | Selith | Not run | Routines/views are **not** in the ledger (F-31) |
| DB-SETUP-03 | Domains / money types | No float money; money uses NUMERIC(15,2) | — | Block DB-SETUP-03 | 0 rows from the float query; 4 domains listed | SQL | Covered by existing test (`scripts/verify-setup.mjs` via `db:verify`) | Nadija & Selith (scaffold) | Nisith | Not run | |
| DB-SEED-01 | Seed | Counts match the seed spec and AC-12 | Fresh rebuild | §1 query | Counts as in §1 | SQL | Covered by existing test (`tests/db/seed-validation.test.mjs`, `seed-validation-org-customers.test.mjs`) | Selith (steward); FD/interest seed completed by Vibodha | Nadija | Not run | |
| DB-SEED-02 | Seed determinism | Re-seeding changes nothing | Fresh rebuild | `npm run db:seed-check` | "unchanged" result, exit 0 | npm | Covered by existing test (`tests/db/seed-validation.test.mjs`) | Selith | Nadija | Not run | Re-runs the seed on `mims_dev` |

```sql
-- DB-SETUP-03 (owner)
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND data_type IN ('real', 'double precision');      -- expect 0 rows
SELECT domain_name, data_type, numeric_precision, numeric_scale FROM information_schema.domains
WHERE domain_schema = 'public' ORDER BY 1;  -- interest_rate 6,4 · money_amount 15,2 · positive_money 15,2 · record_status
```

---

## 3. Identity, parameters and audit (Member 1 — Nadija)

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-ID-01 | `app_user.username` UNIQUE | Duplicate username rejected | owner | Block DB-ID-01 | `23505` duplicate key `app_user_username_key` | SQL | Covered by existing test (`tests/db/identity-constraints.test.mjs`) | Nadija & Selith (scaffold, Nadija's task) | Vibodha | Not run | |
| DB-ID-02 | `app_user_status_check`, `role` FK RESTRICT | Bad status rejected; a referenced role cannot be deleted | owner | Block DB-ID-02 | `23514` …`app_user_status_check`; `23503` …`app_user_role_id_fkey` | SQL | Covered by existing test (`tests/db/identity-constraints.test.mjs`) | Nadija | Vibodha | Not run | |
| DB-ID-03 | `password_hash` | Only argon2id hashes stored; no plaintext column | owner | `SELECT username, left(password_hash,9) FROM app_user LIMIT 3;` and `SELECT column_name FROM information_schema.columns WHERE table_name='app_user';` | Every hash starts `$argon2id`; no `password` column | SQL | Covered by existing test (`tests/db/identity-constraints.test.mjs`) | Nadija | Vibodha | Not run | |
| DB-ID-04 | `trg_audit_log_immutable` + grants | Audit rows cannot be changed or deleted | owner, then app | Block DB-ID-04 | owner: `P0001` "audit_log rows are immutable…"; app: `42501` permission denied (UPDATE, DELETE, TRUNCATE) | SQL | Covered by existing test (`tests/db/audit-trigger.test.mjs`) | Nadija | Vibodha | Not run | |
| DB-ID-05 | `audit_log_actor_type_check` | actor_type only USER/SYSTEM | owner | `INSERT INTO audit_log (actor_type, entity_type, action) VALUES ('ROBOT','x','y');` | `23514` | SQL | Manual only | Nadija | Vibodha | Not run | |
| DB-ID-06 | `trg_audit_system_parameter` → `fn_audit_master_changes` | Parameter change writes before/after audit, with real actor when context set | owner | Block DB-ID-06 | 1 audit row, action `UPDATE`, old 100000.00 → new 100001.00; `actor_type` USER with the context id; without context → SYSTEM | SQL | Covered by existing test (`tests/db/audit-trigger.test.mjs`) | Nadija | Vibodha | Not run | The API path never sets context (F-11) |
| DB-ID-07 | `fn_mask_audit_values` | Customer NIC/email masked, password/token hashes removed | owner | Block DB-ID-07 | NIC `****0004`-style, email `a***@***`; `password_hash` key absent | SQL | Covered by existing test (`tests/db/rls-audit.test.mjs`, `organization-audit.test.mjs`) | Nadija | Vibodha | Not run | |
| DB-ID-08 | `fn_is_business_hour` + `business_calendar` | Data-driven hours; calendar overrides; boundaries inclusive | owner | Block DB-ID-08 | true / false / true / false as commented | SQL | Covered by existing test (`tests/db/business-hours-limits.test.mjs`, `audit-trigger.test.mjs`) | Nadija | Vibodha | Not run | No weekend logic by design |
| DB-ID-09 | 0300 helpers `fn_get_parameter`, `fn_check_withdrawal_single_limit`, `fn_check_withdrawal_daily_limit` | Read limits from data | owner | Block DB-ID-09 | `100000.00`; true/false at 100000.00/100000.01 | SQL | Covered by existing test (`tests/db/business-hours-limits.test.mjs`) | Nadija | Vibodha | Not run | Not used by the posting SP (F-41) |

```sql
-- DB-ID-01 (owner)
BEGIN;
INSERT INTO app_user (role_id, username, password_hash)
SELECT role_id, 'agent_c1', 'x' FROM role WHERE role_name = 'AGENT';           -- 23505
ROLLBACK;

-- DB-ID-02 (owner)
BEGIN;
UPDATE app_user SET status = 'DELETED' WHERE username = 'agent_c2';             -- 23514
ROLLBACK;
BEGIN;
DELETE FROM role WHERE role_name = 'AGENT';                                     -- 23503
ROLLBACK;

-- DB-ID-04 (owner)
BEGIN;
UPDATE audit_log SET action = 'TAMPER' WHERE log_id = (SELECT log_id FROM audit_log LIMIT 1);  -- P0001
ROLLBACK;
BEGIN;
DELETE FROM audit_log WHERE log_id = (SELECT log_id FROM audit_log LIMIT 1);                   -- P0001
ROLLBACK;
-- DB-ID-04 (app)
BEGIN; UPDATE audit_log SET action = 'TAMPER' WHERE false; ROLLBACK;   -- 42501
BEGIN; DELETE FROM audit_log WHERE false;                  ROLLBACK;   -- 42501
BEGIN; TRUNCATE audit_log;                                 ROLLBACK;   -- 42501

-- DB-ID-06 (owner)
BEGIN;
SELECT set_config('app.current_user_id', '00000000-0000-0000-0401-000000000001', true);  -- admin
UPDATE system_parameter SET param_value = '100001.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT';
SELECT actor_type, user_id, action, old_values->>'param_value' AS old, new_values->>'param_value' AS new
FROM audit_log WHERE entity_type = 'system_parameter'
  AND entity_id = (SELECT param_id FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT')
ORDER BY logged_at DESC LIMIT 1;                                  -- USER, admin id, UPDATE, 100000.00, 100001.00
ROLLBACK;

-- DB-ID-07 (owner)
SELECT fn_mask_audit_values('customer',
  '{"nic_passport_no":"198500000004","email":"a2@example.com","full_name":"Adult Two"}'::jsonb);
SELECT fn_mask_audit_values('app_user', '{"username":"x","password_hash":"$argon2id$..."}'::jsonb);

-- DB-ID-08 (owner)
BEGIN;
SELECT fn_is_business_hour(timestamptz '2026-10-08 10:00 Asia/Colombo');   -- true  (Thu, 08:30–17:00)
SELECT fn_is_business_hour(timestamptz '2026-10-08 17:00:01 Asia/Colombo');-- false (after close)
SELECT fn_is_business_hour(timestamptz '2026-10-08 08:30 Asia/Colombo');   -- true  (inclusive)
INSERT INTO business_calendar (calendar_date, is_business_day, description) VALUES ('2026-10-08', false, 'test holiday')
ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = false;
SELECT fn_is_business_hour(timestamptz '2026-10-08 10:00 Asia/Colombo');   -- false (holiday row)
ROLLBACK;

-- DB-ID-09 (owner)
SELECT fn_get_parameter('WITHDRAWAL_SINGLE_LIMIT');                        -- 100000.00
SELECT fn_check_withdrawal_single_limit(100000.00), fn_check_withdrawal_single_limit(100000.01);  -- t, f
SELECT fn_check_withdrawal_daily_limit('00000000-0000-0000-0801-000000000003', 1.00);             -- t
```

---

## 4. Organisation and customers (Member 2 — Vibodha)

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-ORG-01 | `uq_branch_branch_code`, `record_status` domain, branch FK RESTRICT | Unique code, valid status, referenced branch not deletable | owner | Block DB-ORG-01 | `23505`; `23514` (record_status_check); `23503` | SQL | Covered by existing test (`tests/db/branch-constraints.test.mjs`, `master-data-integrity.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-02 | `trg_branch_prevent_deactivation_with_active_agents` | Branch with active agents cannot be deactivated | owner | Block DB-ORG-02 | `23514` "A branch with active agents cannot be deactivated" | SQL | Covered by existing test (`tests/db/agent-constraints.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-03 | `uq_agent_employee_no` / `nic_passport_no` / `email`; `trg_validate_agent_active_branch` | Agent identity unique; active agent needs active branch | owner | Block DB-ORG-03 | `23505` ×1; `23514` "An active agent must belong to an active branch" | SQL | Covered by existing test (`tests/db/agent-constraints.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-04 | `customer` uniques + `ck_customer_birth_date_past` + `ck_customer_status` | Duplicate NIC/email/number rejected; DOB in past | owner | Block DB-ORG-04 | `23505` uq_customer_nic_passport_no; `23514` ck_customer_birth_date_past | SQL | Covered by existing test (`tests/db/customer-constraints.test.mjs`) | Vibodha | Nadija | Not run | Email uniqueness is case-sensitive in the DB; the service lower-cases first |
| DB-ORG-05 | `ux_customer_agent_one_active`, `ck_customer_agent_dates` | One active assignment per customer; end ≥ start | owner | Block DB-ORG-05 | `23505`; `23514` | SQL | Covered by existing test (`tests/db/customer-agent-constraints.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-06 | `ck_customer_document_verification` | verified_by and verified_date set together | owner | Block DB-ORG-06 | `23514` | SQL | Covered by existing test (`tests/db/customer-document-constraints.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-07 | Customer RLS (`customer_select_scope`, `customer_insert_scope`) | Staff see own branch; insert only into own branch; no context sees nothing | **app** | Block DB-ORG-07 | agent_k1: only Kandy rows; no context: 0; insert Colombo customer as agent_k1: `42501` "new row violates row-level security policy" | SQL | Covered by existing test (`tests/db/rls-audit.test.mjs`) | Nadija (RLS) / Vibodha (table) | Pramudith | Not run | |
| DB-ORG-08 | Child RLS (`customer_document_insert_scope`) | App may insert only **unverified** documents | **app** | Block DB-ORG-08 | `42501` RLS violation | SQL | Covered by existing test (`tests/db/customer-child-access.test.mjs`) | Vibodha | Nisith | Not run | Root cause of F-07 |
| DB-ORG-09 | `ix_customer_full_name_trgm` | Name search can use the trigram index | owner | `EXPLAIN SELECT customer_id FROM customer WHERE full_name ILIKE '%dult%';` | Plan may show `Bitmap Index Scan on ix_customer_full_name_trgm` (with 15 rows the planner may pick Seq Scan — then `SET enable_seqscan=off;` first) | SQL | Partially covered (`tests/db/customer-constraints.test.mjs`) | Vibodha | Nadija | Not run | |
| DB-ORG-10 | `trg_audit_branch`, `trg_audit_agent` | Master changes audited; agent NIC removed from audit JSON | owner | Block DB-ORG-10 | 1 audit row each; `nic_passport_no` absent in agent JSON | SQL | Covered by existing test (`tests/db/organization-audit.test.mjs`) | Vibodha | Nadija | Not run | |

```sql
-- DB-ORG-01 (owner)
BEGIN; INSERT INTO branch (branch_code, branch_name, address, district, phone) VALUES ('BR-COL','Dup','a','b','c'); ROLLBACK;  -- 23505
BEGIN; UPDATE branch SET status = 'CLOSED' WHERE branch_code = 'BR-GAL'; ROLLBACK;                                            -- 23514
BEGIN; DELETE FROM branch WHERE branch_code = 'BR-GAL'; ROLLBACK;                                                             -- 23503

-- DB-ORG-02 (owner)
BEGIN; UPDATE branch SET status = 'INACTIVE' WHERE branch_code = 'BR-COL'; ROLLBACK;                                          -- 23514

-- DB-ORG-03 (owner)
BEGIN;
UPDATE agent SET employee_no = 'EMP002' WHERE employee_no = 'EMP001';                                                          -- 23505
ROLLBACK;
BEGIN;
INSERT INTO branch (branch_code, branch_name, address, district, phone, status) VALUES ('BR-TST','Test','a','b','c','INACTIVE');
UPDATE agent SET branch_id = (SELECT branch_id FROM branch WHERE branch_code = 'BR-TST') WHERE employee_no = 'EMP001';          -- 23514
ROLLBACK;

-- DB-ORG-04 (owner)
BEGIN;
INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
VALUES ('00000000-0000-0000-0101-000000000001','CUS-TEST-0001','198500000004','Dup NIC','1990-01-01','dup@example.com');     -- 23505
ROLLBACK;
BEGIN;
INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
VALUES ('00000000-0000-0000-0101-000000000001','CUS-TEST-0002','299900000001','Future','2099-01-01','f@example.com');        -- 23514
ROLLBACK;

-- DB-ORG-05 (owner)
BEGIN;
INSERT INTO customer_agent (customer_id, agent_id) VALUES
 ('00000000-0000-0000-0501-000000000003','00000000-0000-0000-0401-000000000012');                                            -- 23505 (03 already active with agent_c1)
ROLLBACK;
BEGIN;
UPDATE customer_agent SET end_date = assigned_date - 1 WHERE customer_id = '00000000-0000-0000-0501-000000000003';             -- 23514
ROLLBACK;

-- DB-ORG-06 (owner)
BEGIN;
UPDATE customer_document SET verified_date = NULL
WHERE doc_id = (SELECT doc_id FROM customer_document WHERE verified_by IS NOT NULL LIMIT 1);                                   -- 23514
ROLLBACK;

-- DB-ORG-07 (app)
BEGIN;
SELECT count(*) FROM customer;                                                   -- 0 (no context)
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000013',true),
       set_config('app.current_branch_id','00000000-0000-0000-0101-000000000002',true),
       set_config('app.current_user_role','AGENT',true);
SELECT DISTINCT branch_id FROM customer;                                        -- only …0101-000000000002
INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
VALUES ('00000000-0000-0000-0101-000000000001','CUS-TEST-0003','200100000099','RLS probe','2001-01-01','rls@example.com');  -- 42501
ROLLBACK;

-- DB-ORG-08 (app)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000011',true),
       set_config('app.current_branch_id','00000000-0000-0000-0101-000000000001',true),
       set_config('app.current_user_role','AGENT',true);
INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date)
VALUES ('00000000-0000-0000-0501-000000000003','NIC','/x.pdf','00000000-0000-0000-0401-000000000011', now());              -- 42501
ROLLBACK;

-- DB-ORG-10 (owner)
BEGIN;
UPDATE branch SET phone = '0919999999' WHERE branch_code = 'BR-GAL';
UPDATE agent SET phone = '0779999999' WHERE employee_no = 'EMP005';
SELECT entity_type, action, new_values ? 'nic_passport_no' AS has_nic FROM audit_log
WHERE entity_type IN ('branch','agent') ORDER BY logged_at DESC LIMIT 2;          -- has_nic = false for agent
ROLLBACK;
```

---

## 5. Plans, accounts and joint ownership (Member 3 — Nisith)

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-ACC-01 | `savings_plan` seed + CHECKs + `interest_rate` domain | 5 plans with BR-03…07 values; bad ranges rejected | owner | Block DB-ACC-01 | Children 0.1200/0.00, Teen 0.1100/500.00, Adult 0.1000/1000.00, Senior 0.1300/1000.00, Joint 0.0700/5000.00 (2–4 holders); then `23514` ×4 | SQL | Covered by existing test (`tests/db/savings-plan-constraints.test.mjs`, `constraint-suite-plans-accounts.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-02 | `fn_check_plan_eligibility` | Data-driven age and holder rules | owner | Block DB-ACC-02 | t, f, t, f, t, f, t, f, f as commented | SQL | Covered by existing test (`tests/db/plan-eligibility-function.test.mjs`) | Nisith | Pramudith | Not run | Checks the primary applicant only |
| DB-ACC-03 | `account` CHECKs, `uq_account_account_number`, `trg_account_prevent_branch_change` | Balance ≥ 0, valid status, unique number, branch fixed | owner | Block DB-ACC-03 | `23514` ×3, `23505` | SQL | Covered by existing test (`tests/db/account-constraints.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-04 | `account_holder` uniques + `trg_validate_joint_mandate` | Unique holder, one PRIMARY, count and adult rules | owner | Block DB-ACC-04 | `23505` ×2; `INVALID_HOLDER_COUNT`; `UNDERAGE_HOLDER`; 4th joint holder OK, 5th `INVALID_HOLDER_COUNT`; `required_signatories` synced to 4 | SQL | Covered by existing test (`tests/db/joint-mandate-trigger.test.mjs`, `account-holder-constraints.test.mjs`) | Nisith | Pramudith | Not run | Statement-level trigger with transition tables |
| DB-ACC-05 | `joint_mandate` CHECKs + `trg_joint_mandate_fit` | ANY_ONE = 1 signer; 1–4; only multi-holder plans | owner | Block DB-ACC-05 | `23514` ×2; `P0001 MANDATE_NOT_ALLOWED` | SQL | Covered by existing test (`tests/db/joint-mandate-trigger.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-06 | `sp_open_savings_account` (final 0541) | Opens account + holder + deposit atomically, with `balance_after` | owner, hours open | Block DB-ACC-06 | NOTICE with new `BR-COL-…` number, balance 1500.00; 1 OPEN- deposit row with `balance_after` 1500.00; audit rows | SQL | Covered by existing test (`tests/db/sp-open-savings-account.test.mjs`) | Nisith | Pramudith | Not run | Deposit has no agent attribution (F-10) |
| DB-ACC-07 | `sp_open_savings_account` rejections | Each business rule raises its code; nothing is left behind | owner | Block DB-ACC-07 (run each DO separately) | `PLAN_ELIGIBILITY_FAILED`, `BELOW_MINIMUM_BALANCE`, `INVALID_HOLDER_COUNT`, `DOCUMENTS_NOT_VERIFIED`, `OUTSIDE_BUSINESS_HOURS`, `MANDATE_REQUIRED` | SQL | Covered by existing test (`tests/db/sp-open-savings-account.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-08 | `sp_open_savings_account` joint | Joint ALL_HOLDERS → required_signatories = holder count | owner, hours open | Block DB-ACC-08 | 2 holders, mandate ALL_HOLDERS, `required_signatories` 2 | SQL | Covered by existing test (`tests/db/sp-open-savings-account.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-09 | `account_opening_request` CHECKs/UNIQUE | Key format and per-user uniqueness | owner | Block DB-ACC-09 | `23514` ck_account_opening_request_key_format | SQL | Covered by existing test (`tests/db/account-opening-request.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-10 | `fn_next_account_number` | `CODE-00000001` format, skips numbers in use | owner | `BEGIN; SELECT fn_next_account_number('BR-COL'), fn_next_account_number('br-col'); ROLLBACK;` | Two distinct `BR-COL-000000NN` values not already in `account` | SQL | Covered by existing test (`tests/db/sp-open-savings-account.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-11 | `sp_add_account_holder` | Adds a JOINT holder with checks | owner | Block DB-ACC-11 | holder count 3; duplicate → `23505`; Adult account → `INVALID_HOLDER_COUNT` | SQL | Covered by existing test (`tests/db/sp-add-account-holder.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-12 | `fn_check_plan_minimum` (I-4) | resulting ≥ plan minimum | owner | Block DB-ACC-12 | t, f, f | SQL | Covered by existing test (`tests/db/fn-check-plan-minimum.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-13 | `fn_withdrawal_mandate_verdict` / `fn_check_withdrawal_mandate` (I-4) | Mandate decisions | owner | Block DB-ACC-13 | OK, MANDATE_NOT_SATISFIED, OK, SIGNER_NOT_HOLDER, NO_SIGNERS | SQL | Covered by existing test (`tests/db/fn-check-withdrawal-mandate.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-14 | `fn_check_account_fd_eligible` / `fn_fd_funding_verdict` (I-6) | FD funding reasons | owner | Block DB-ACC-14 | t; ACTIVE_FD_EXISTS; INVALID_PRINCIPAL; ACCOUNT_NOT_FOUND | SQL | Covered by existing test (`tests/db/fn-check-account-fd-eligible.test.mjs`) | Nisith | Pramudith | Not run | Verdict unused by `sp_open_fixed_deposit` (F-30) |
| DB-ACC-15 | `sp_close_account` + `trg_account_close_guard` (BR-18) | Close only with zero balance and no active FD | owner, hours open | Block DB-ACC-15 | `BALANCE_NOT_ZERO` (SP and direct UPDATE); new empty account closes; second close `ACCOUNT_ALREADY_CLOSED`; audit `CLOSE` | SQL | Covered by existing test (`tests/db/sp-close-account.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-ACC-16 | Account RLS (`account_select_scope`, `account_select_customer_own`, `account_update_scope`) | Branch / own-account visibility | **app** | Block DB-ACC-16 | no context 0; agent_k1 sees only Kandy; customer_adult_one sees exactly 003 and 005; agent_k1 UPDATE of a Colombo account affects 0 rows | SQL | Covered by existing test (`tests/db/rls-audit.test.mjs`) | Nadija (RLS) / Nisith (table) | Pramudith | Not run | |

```sql
-- DB-ACC-01 (owner)
SELECT plan_name, interest_rate, min_balance, min_age_years, max_age_years, min_holders, max_holders, requires_all_adult
FROM savings_plan ORDER BY plan_name;
BEGIN; UPDATE savings_plan SET min_age_years = 60, max_age_years = 18 WHERE plan_name = 'Adult'; ROLLBACK;   -- 23514 chk_savings_plan_age_range
BEGIN; UPDATE savings_plan SET min_holders = 3, max_holders = 2 WHERE plan_name = 'Joint'; ROLLBACK;         -- 23514 chk_savings_plan_holder_range
BEGIN; UPDATE savings_plan SET min_balance = -1 WHERE plan_name = 'Teen'; ROLLBACK;                         -- 23514 chk_savings_plan_min_balance_nonneg
BEGIN; UPDATE savings_plan SET interest_rate = 1.5 WHERE plan_name = 'Teen'; ROLLBACK;                      -- 23514 interest_rate_check

-- DB-ACC-02 (owner)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Children'), DATE '2015-05-15', 1);  -- t (age 11)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Adult'),    DATE '2015-05-15', 1);  -- f
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Teen'),     DATE '2010-06-16', 1);  -- t (16)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Adult'),    (CURRENT_DATE - interval '18 years' + interval '1 day')::date, 1);  -- f (one day short of 18)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Adult'),    (CURRENT_DATE - interval '18 years')::date, 1);  -- t (18 today)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Joint'),    DATE '1990-07-17', 1);  -- f (needs 2–4)
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Joint'),    DATE '1990-07-17', 2);  -- t
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Joint'),    DATE '1990-07-17', 5);  -- f
SELECT fn_check_plan_eligibility((SELECT plan_id FROM savings_plan WHERE plan_name='Adult'),    NULL, 1);               -- f

-- DB-ACC-03 (owner)
BEGIN; UPDATE account SET current_balance = -0.01 WHERE account_id = '00000000-0000-0000-0801-000000000003'; ROLLBACK;  -- 23514 ck_account_balance_non_negative
BEGIN; UPDATE account SET status = 'DORMANT' WHERE account_id = '00000000-0000-0000-0801-000000000003'; ROLLBACK;      -- 23514 ck_account_status
BEGIN; UPDATE account SET branch_id = '00000000-0000-0000-0101-000000000002' WHERE account_id = '00000000-0000-0000-0801-000000000003'; ROLLBACK;  -- 23514 ck_account_branch_immutable
BEGIN; UPDATE account SET account_number = 'BR-COL-00000001' WHERE account_id = '00000000-0000-0000-0801-000000000002'; ROLLBACK;  -- 23505

-- DB-ACC-04 (owner)
BEGIN; INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000005','00000000-0000-0000-0501-000000000003','JOINT'); ROLLBACK;   -- 23505 uq_account_holder_account_customer
BEGIN; INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000005','00000000-0000-0000-0501-000000000005','PRIMARY'); ROLLBACK; -- 23505 uq_account_holder_one_primary
BEGIN; INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000003','00000000-0000-0000-0501-000000000004','JOINT'); ROLLBACK;   -- P0001 INVALID_HOLDER_COUNT (Adult = 1 holder)
BEGIN; INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000005','00000000-0000-0000-0501-000000000001','JOINT'); ROLLBACK;   -- P0001 UNDERAGE_HOLDER
BEGIN;
INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000006','00000000-0000-0000-0501-000000000004','JOINT');  -- OK: 4 holders
SELECT required_signatories FROM joint_mandate WHERE account_id = '00000000-0000-0000-0801-000000000006';                                                         -- 4 (ALL_HOLDERS synced)
INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ('00000000-0000-0000-0801-000000000006','00000000-0000-0000-0501-000000000005','JOINT');  -- P0001 INVALID_HOLDER_COUNT (5 > 4)
ROLLBACK;

-- DB-ACC-05 (owner)
BEGIN; UPDATE joint_mandate SET required_signatories = 2 WHERE account_id = '00000000-0000-0000-0801-000000000005'; ROLLBACK;  -- 23514 ck_joint_mandate_any_one_single
BEGIN; UPDATE joint_mandate SET required_signatories = 5 WHERE account_id = '00000000-0000-0000-0801-000000000006'; ROLLBACK;  -- 23514 ck_joint_mandate_signatories_range
BEGIN; INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES ('00000000-0000-0000-0801-000000000003','ANY_ONE',1); ROLLBACK;  -- P0001 MANDATE_NOT_ALLOWED

-- DB-ACC-06 (owner)
BEGIN;
INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, true, '00:00', '23:59:59', 'db test window')
ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = true, open_time = '00:00', close_time = '23:59:59';
DO $$
DECLARE p uuid; ch uuid; acc uuid; num varchar; bal numeric;
BEGIN
  SELECT plan_id INTO p FROM savings_plan WHERE plan_name = 'Adult';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER';
  CALL sp_open_savings_account(p, '00000000-0000-0000-0101-000000000001', '00000000-0000-0000-0401-000000000011',
       '[{"customer_id":"00000000-0000-0000-0501-000000000004","holder_type":"PRIMARY"}]'::jsonb,
       NULL, 1500.00, ch, '00000000-0000-0000-0401-000000000011', acc, num, bal);
  RAISE NOTICE 'opened % % balance %', acc, num, bal;
END $$;
SELECT reference_number, transaction_type, amount, balance_after, agent_id
FROM transaction WHERE reference_number LIKE 'OPEN-%' ORDER BY ledger_seq DESC LIMIT 1;   -- DEPOSIT 1500.00, balance_after 1500.00, agent_id NULL
ROLLBACK;

-- DB-ACC-07 (owner) — run each DO block in its own BEGIN … ROLLBACK, after the business-hours snippet
-- a) child into Adult                → PLAN_ELIGIBILITY_FAILED
DO $$ DECLARE p uuid; ch uuid; a uuid; n varchar; b numeric; BEGIN
  SELECT plan_id INTO p FROM savings_plan WHERE plan_name='Adult';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_open_savings_account(p,'00000000-0000-0000-0101-000000000001','00000000-0000-0000-0401-000000000011',
    '[{"customer_id":"00000000-0000-0000-0501-000000000001","holder_type":"PRIMARY"}]'::jsonb, NULL, 1500.00, ch,
    '00000000-0000-0000-0401-000000000011', a, n, b); END $$;
-- b) Adult with 500.00                → BELOW_MINIMUM_BALANCE   (same block, customer 04, deposit 500.00)
-- c) Joint with one holder            → INVALID_HOLDER_COUNT    (plan 'Joint', mandate '{"mandate_type":"ANY_ONE"}', deposit 6000.00)
-- d) Joint, 2 holders, mandate NULL   → MANDATE_REQUIRED
-- e) Unverified customer              → DOCUMENTS_NOT_VERIFIED  (first INSERT a customer + customer_agent row in the same transaction, no document)
-- f) Holiday today                    → OUTSIDE_BUSINESS_HOURS  (instead of the window snippet, insert today's calendar row with is_business_day=false; deposit 1500.00)

-- DB-ACC-08 (owner, after the business-hours snippet)
DO $$ DECLARE p uuid; ch uuid; a uuid; n varchar; b numeric; BEGIN
  SELECT plan_id INTO p FROM savings_plan WHERE plan_name='Joint';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_open_savings_account(p,'00000000-0000-0000-0101-000000000001','00000000-0000-0000-0401-000000000002',
    '[{"customer_id":"00000000-0000-0000-0501-000000000004","holder_type":"PRIMARY"},
      {"customer_id":"00000000-0000-0000-0501-000000000005","holder_type":"JOINT"}]'::jsonb,
    '{"mandate_type":"ALL_HOLDERS"}'::jsonb, 6000.00, ch, '00000000-0000-0000-0401-000000000002', a, n, b);
  RAISE NOTICE 'joint % %', a, n;
  PERFORM 1 FROM joint_mandate WHERE account_id = a AND mandate_type = 'ALL_HOLDERS' AND required_signatories = 2;
  IF NOT FOUND THEN RAISE EXCEPTION 'mandate not synced'; END IF;
END $$;

-- DB-ACC-09 (owner)
BEGIN;
INSERT INTO account_opening_request (user_id, idempotency_key, request_hash, account_id)
VALUES ('00000000-0000-0000-0401-000000000011','bad key!', repeat('a',64), '00000000-0000-0000-0801-000000000003');   -- 23514
ROLLBACK;

-- DB-ACC-11 (owner)
BEGIN;
DO $$ DECLARE h uuid; c int; BEGIN
  CALL sp_add_account_holder('00000000-0000-0000-0801-000000000005','00000000-0000-0000-0501-000000000005',
                             '00000000-0000-0000-0401-000000000002', h, c);
  RAISE NOTICE 'holder % count %', h, c;                                         -- count 3
END $$;
ROLLBACK;
BEGIN;
DO $$ DECLARE h uuid; c int; BEGIN
  CALL sp_add_account_holder('00000000-0000-0000-0801-000000000003','00000000-0000-0000-0501-000000000004',
                             '00000000-0000-0000-0401-000000000002', h, c); END $$;   -- INVALID_HOLDER_COUNT
ROLLBACK;

-- DB-ACC-12 (owner)
SELECT fn_check_plan_minimum('00000000-0000-0000-0801-000000000002', 500.00),   -- t (Teen min 500)
       fn_check_plan_minimum('00000000-0000-0000-0801-000000000002', 499.99),   -- f
       fn_check_plan_minimum('00000000-0000-0000-0000-000000000000', 1.00);     -- f (unknown account)

-- DB-ACC-13 (owner)
SELECT fn_withdrawal_mandate_verdict('00000000-0000-0000-0801-000000000005', ARRAY['00000000-0000-0000-0501-000000000003']::uuid[]);  -- OK (ANY_ONE)
SELECT fn_withdrawal_mandate_verdict('00000000-0000-0000-0801-000000000006', ARRAY['00000000-0000-0000-0501-000000000008']::uuid[]);  -- MANDATE_NOT_SATISFIED
SELECT fn_withdrawal_mandate_verdict('00000000-0000-0000-0801-000000000006', ARRAY['00000000-0000-0000-0501-000000000008',
       '00000000-0000-0000-0501-000000000009','00000000-0000-0000-0501-000000000010']::uuid[]);                                        -- OK
SELECT fn_withdrawal_mandate_verdict('00000000-0000-0000-0801-000000000003', ARRAY['00000000-0000-0000-0501-000000000004']::uuid[]);  -- SIGNER_NOT_HOLDER
SELECT fn_withdrawal_mandate_verdict('00000000-0000-0000-0801-000000000003', ARRAY[]::uuid[]);                                         -- NO_SIGNERS

-- DB-ACC-14 (owner)
SELECT fn_check_account_fd_eligible('00000000-0000-0000-0801-000000000003');            -- t
BEGIN;
SELECT fn_fd_funding_verdict('00000000-0000-0000-0801-000000000003', 1000.00);         -- ACTIVE_FD_EXISTS (seed FD)
SELECT fn_fd_funding_verdict('00000000-0000-0000-0801-000000000003', 0);               -- INVALID_PRINCIPAL
SELECT fn_fd_funding_verdict('00000000-0000-0000-0000-000000000000', 10.00);           -- ACCOUNT_NOT_FOUND
ROLLBACK;

-- DB-ACC-15 (owner, after the business-hours snippet)
DO $$ DECLARE t timestamptz; BEGIN
  CALL sp_close_account('00000000-0000-0000-0801-000000000003','00000000-0000-0000-0401-000000000002', t); END $$;   -- BALANCE_NOT_ZERO
-- new transaction:
BEGIN;
UPDATE account SET status = 'CLOSED' WHERE account_id = '00000000-0000-0000-0801-000000000003';                     -- P0001 BALANCE_NOT_ZERO (guard trigger)
ROLLBACK;
BEGIN;
DO $$ DECLARE p uuid; ch uuid; a uuid; n varchar; b numeric; t timestamptz; BEGIN
  SELECT plan_id INTO p FROM savings_plan WHERE plan_name='Senior';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_open_savings_account(p,'00000000-0000-0000-0101-000000000001','00000000-0000-0000-0401-000000000012',
    '[{"customer_id":"00000000-0000-0000-0501-000000000005","holder_type":"PRIMARY"}]'::jsonb, NULL, NULL, ch,
    '00000000-0000-0000-0401-000000000012', a, n, b);                       -- no deposit, balance 0
  CALL sp_close_account(a, '00000000-0000-0000-0401-000000000002', t);
  RAISE NOTICE 'closed % at %', n, t;
  CALL sp_close_account(a, '00000000-0000-0000-0401-000000000002', t);      -- ACCOUNT_ALREADY_CLOSED
END $$;
ROLLBACK;

-- DB-ACC-16 (app)
BEGIN;
SELECT count(*) FROM account;                                                    -- 0 (no context)
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000013',true),
       set_config('app.current_branch_id','00000000-0000-0000-0101-000000000002',true),
       set_config('app.current_user_role','AGENT',true);
SELECT DISTINCT branch_id FROM account;                                          -- only Kandy
UPDATE account SET current_balance = current_balance WHERE account_id = '00000000-0000-0000-0801-000000000003';  -- UPDATE 0
ROLLBACK;
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000023',true),
       set_config('app.current_branch_id','',true),
       set_config('app.current_user_role','CUSTOMER',true);
SELECT account_number FROM account ORDER BY 1;                                    -- BR-COL-00000003, BR-COL-00000005
ROLLBACK;
```

---

## 6. Transactions and ledger (Member 4 — Pramudith)

Implementation note:

- **Pramudith built:** `transaction`, `transaction_channel`, `0360` references and
  idempotency index, `sp_post_deposit`.
- **Selith built (on Pramudith's behalf):** `0362` withdrawal, `0363` reversal, `0460`
  interest credit.
- **Vibodha built:** `0363` withdrawal repair and `0620`.
- **Nisith built:** `0542` `ledger_seq`.

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-TXN-01 | `transaction` CHECKs, `ux_transaction_reference`, `ux_transaction_idempotency` | amount > 0, valid type, unique reference, unique key | owner | Block DB-TXN-01 | `23514` ×2; `23505` ×2 | SQL | Covered by existing test (`tests/db/transaction-immutability.test.mjs`, `transaction-reference-idempotency.test.mjs`) | Pramudith | Selith | Not run | |
| DB-TXN-02 | `trg_financial_transaction_immutable` + grants | Posted rows can't be updated/deleted | owner, then app | Block DB-TXN-02 | owner `P0001 TRANSACTION_IMMUTABLE…` ×2; app `42501` ×2 | SQL | Covered by existing test (`tests/db/transaction-immutability.test.mjs`) | Pramudith | Selith | Not run | |
| DB-TXN-03 | `sp_post_deposit` | Lock → ledger → balance → audit | owner, hours open | Block DB-TXN-03 | NOTICE balance_after = old + 500.00; `account.current_balance` equal; 1 audit `DEPOSIT`; `ledger_seq` greater than previous; **agent_id/branch_id NULL** | SQL | Covered by existing test (`tests/db/sp-post-deposit.test.mjs`) | Pramudith | Selith | Not run | Attribution gap F-10 |
| DB-TXN-04 | `sp_post_deposit` idempotency | Same key → same row; different body with same key should be rejected | owner, hours open | Block DB-TXN-04 | 2nd call returns the **same** transaction id; 1 row with that key; 3rd call (different amount) should raise | SQL | Partially covered (`tests/db/sp-post-deposit.test.mjs`) | Pramudith | Selith | Not run | **Known issue — 3rd call returns the old row silently (F-04)** |
| DB-TXN-05 | `sp_post_deposit` rejections | Inactive account, holiday, bad channel, zero amount | owner | Block DB-TXN-05 | `ACCOUNT_NOT_ACTIVE`, `OUTSIDE_BUSINESS_HOURS`, `CHANNEL_UNAVAILABLE`, `INVALID_DEPOSIT_AMOUNT` | SQL | Covered by existing test (`tests/db/sp-post-deposit.test.mjs`) | Pramudith | Selith | Not run | |
| DB-TXN-06 | `sp_post_withdrawal(… uuid[] …)` | Locks, checks, debits, attributes, audits | owner + agent_c1 context, hours open | Block DB-TXN-06 | NOTICE balance −100.00; row has `agent_id` = agent_c1, `branch_id` Colombo; audit `WITHDRAWAL` with `signer_customer_ids` | SQL | Covered by existing test (`tests/db/sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Selith on Pramudith's behalf; repaired by Vibodha. Passing here and failing in WF-TXN-05 proves F-01 is in the service call |
| DB-TXN-07 | `sp_try_post_withdrawal` + `sp_write_rejection_audit` | Business rejection → no ledger row, audit `WITHDRAWAL_REJECTED` | owner + agent_c1 context, hours open | Block DB-TXN-07 | `rejection_code` = `BELOW_MINIMUM_BALANCE`; ledger count unchanged; 1 audit `WITHDRAWAL_REJECTED` | SQL | Covered by existing test (`tests/db/sp-post-withdrawal.test.mjs`, `financial-audit.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Selith on Pramudith's behalf; the API does not use this routine (F-06) |
| DB-TXN-08 | `sp_post_withdrawal` rules | Insufficient funds, single limit, mandate, wrong agent | owner, contexts as noted | Block DB-TXN-08 | `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `MANDATE_NOT_SATISFIED`, `WITHDRAWAL_NOT_AUTHORIZED` | SQL | Covered by existing test (`tests/db/sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Selith on Pramudith's behalf |
| DB-TXN-09 | Withdrawal idempotency | Replay returns original; changed payload → `IDEMPOTENCY_KEY_REUSED` | owner + agent_c1, hours open | Block DB-TXN-09 | Same id on replay; `IDEMPOTENCY_KEY_REUSED` on change | SQL | Covered by existing test (`tests/db/sp-post-withdrawal.test.mjs`) | Pramudith | Nisith | Not run | Repair by Vibodha |
| DB-TXN-10 | `sp_reverse_transaction`, `transaction_reversal` UNIQUE | Compensating entry; original untouched; once only | owner, hours open | Block DB-TXN-10 | Balance restored; original row unchanged; `ALREADY_REVERSED`; `CANNOT_REVERSE_A_REVERSAL` | SQL | Covered by existing test (`tests/db/sp-reverse-transaction.test.mjs`) | Pramudith | Vibodha | Not run | Implemented by Selith on Pramudith's behalf |
| DB-TXN-11 | `sp_reverse_transaction` scope | Another branch's manager must be refused | **app** + bm_kandy context | Block DB-TXN-11 | Should raise (not found / not authorized) and insert nothing | SQL | Manual only | Pramudith | Vibodha | Not run | **Known issue — Critical F-02:** expect NOTICE with `balance_after` NULL. Rolled back |
| DB-TXN-12 | `ledger_seq` (0542) | Unique, increasing per account | owner | Block DB-TXN-12 | 0 duplicate rows; 0 accounts where order by ledger_seq breaks the `balance_after` chain | SQL | Covered by existing test (`tests/db/transaction-ledger-seq.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-TXN-13 | `transaction_channel` | 3 channels, unique name, status check | owner | Block DB-TXN-13 | BRANCH_COUNTER, ONLINE, SYSTEM; `23505`; `23514` | SQL | Covered by existing test (`tests/db/transaction-channel-constraints.test.mjs`) | Pramudith | Selith | Not run | |
| DB-TXN-14 | `sp_post_interest_credit` (final 0620) | One credit per FD and cycle | owner | Block DB-TXN-14 | `23505` on `ux_transaction_reference` for an already-paid FD/cycle | SQL | Covered by existing test (`tests/db/sp-post-interest-credit.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Selith (0460) and Vibodha (0620) on Pramudith's behalf |
| DB-TXN-15 | Concurrency (AC-06) | Two parallel withdrawals cannot overspend | owner, two psql windows | Block DB-TXN-15 | Second window waits until first commits, then fails `INSUFFICIENT_FUNDS` or `BELOW_MINIMUM_BALANCE` | SQL | Covered by existing test (`tests/db/concurrent-withdrawals.test.mjs`) | Pramudith (lock implemented by Selith) / Nisith (tests) | Vibodha | Not run | The automated test is the stronger evidence — show it in the demo |

```sql
-- DB-TXN-01 (owner)
BEGIN; INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
SELECT account_id, initiated_by_user_id, channel_id, 'TEST-REF-1', 'DEPOSIT', 0 FROM transaction LIMIT 1; ROLLBACK;          -- 23514 transaction_amount_check
BEGIN; INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
SELECT account_id, initiated_by_user_id, channel_id, 'TEST-REF-2', 'TRANSFER', 1 FROM transaction LIMIT 1; ROLLBACK;         -- 23514 transaction_transaction_type_check
BEGIN; INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
SELECT account_id, initiated_by_user_id, channel_id, reference_number, 'DEPOSIT', 1 FROM transaction LIMIT 1; ROLLBACK;     -- 23505 ux_transaction_reference
BEGIN; INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, idempotency_key)
SELECT account_id, initiated_by_user_id, channel_id, 'TEST-REF-3', 'DEPOSIT', 1, idempotency_key
FROM transaction WHERE idempotency_key IS NOT NULL LIMIT 1; ROLLBACK;                                                         -- 23505 ux_transaction_idempotency

-- DB-TXN-02 (owner)
BEGIN; UPDATE transaction SET narration = 'tamper' WHERE transaction_id = (SELECT transaction_id FROM transaction LIMIT 1); ROLLBACK;  -- P0001
BEGIN; DELETE FROM transaction WHERE transaction_id = (SELECT transaction_id FROM transaction LIMIT 1); ROLLBACK;                      -- P0001
-- DB-TXN-02 (app)
BEGIN; UPDATE transaction SET narration = 'x' WHERE false; ROLLBACK;   -- 42501
BEGIN; DELETE FROM transaction WHERE false;                ROLLBACK;   -- 42501

-- DB-TXN-03 (owner, after the business-hours snippet)
DO $$ DECLARE ch uuid; t uuid; ref varchar; bal numeric; ts timestamptz; before numeric; BEGIN
  SELECT current_balance INTO before FROM account WHERE account_id = '00000000-0000-0000-0801-000000000003';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 500.00, ch, '00000000-0000-0000-0401-000000000011',
                       'db-test-dep-0001', 'DB test deposit', t, ref, bal, ts);
  RAISE NOTICE 'txn % ref % before % after %', t, ref, before, bal;
END $$;
SELECT current_balance FROM account WHERE account_id = '00000000-0000-0000-0801-000000000003';
SELECT transaction_type, amount, balance_after, agent_id, branch_id, ledger_seq FROM transaction WHERE idempotency_key = 'db-test-dep-0001';
SELECT action FROM audit_log WHERE entity_type = 'transaction' ORDER BY logged_at DESC LIMIT 1;   -- DEPOSIT

-- DB-TXN-04 (owner, same transaction as DB-TXN-03, before ROLLBACK)
DO $$ DECLARE ch uuid; t uuid; ref varchar; bal numeric; ts timestamptz; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 500.00, ch, '00000000-0000-0000-0401-000000000011',
                       'db-test-dep-0001', 'DB test deposit', t, ref, bal, ts);
  RAISE NOTICE 'replay returned %', t;                                  -- same id as DB-TXN-03
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000002', 9999.00, ch, '00000000-0000-0000-0401-000000000012',
                       'db-test-dep-0001', 'different body', t, ref, bal, ts);
  RAISE NOTICE 'different body returned % (should have raised — F-04)', t;
END $$;
SELECT count(*) FROM transaction WHERE idempotency_key = 'db-test-dep-0001';   -- 1
ROLLBACK;

-- DB-TXN-05 (owner) — each in its own BEGIN … ROLLBACK
BEGIN;  -- inactive account
UPDATE account SET status = 'FROZEN' WHERE account_id = '00000000-0000-0000-0801-000000000004';
DO $$ DECLARE ch uuid; t uuid; r varchar; b numeric; ts timestamptz; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000004', 10.00, ch, '00000000-0000-0000-0401-000000000012', NULL, NULL, t, r, b, ts); END $$;  -- ACCOUNT_NOT_ACTIVE
ROLLBACK;
BEGIN;  -- holiday
INSERT INTO business_calendar (calendar_date, is_business_day, description) VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, false, 'test')
ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = false;
DO $$ DECLARE ch uuid; t uuid; r varchar; b numeric; ts timestamptz; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 10.00, ch, '00000000-0000-0000-0401-000000000011', NULL, NULL, t, r, b, ts); END $$;  -- OUTSIDE_BUSINESS_HOURS
ROLLBACK;
BEGIN;  -- unknown channel, zero amount
DO $$ DECLARE t uuid; r varchar; b numeric; ts timestamptz; BEGIN
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 10.00, gen_random_uuid(), '00000000-0000-0000-0401-000000000011', NULL, NULL, t, r, b, ts); END $$;  -- CHANNEL_UNAVAILABLE
ROLLBACK;
BEGIN;
DO $$ DECLARE ch uuid; t uuid; r varchar; b numeric; ts timestamptz; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 0, ch, '00000000-0000-0000-0401-000000000011', NULL, NULL, t, r, b, ts); END $$;  -- INVALID_DEPOSIT_AMOUNT
ROLLBACK;

-- DB-TXN-06 (owner, after the business-hours snippet and the agent_c1 context snippet)
DO $$ DECLARE ch uuid; t uuid; ref varchar; bal numeric; ts timestamptz; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER';
  CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 100.00, ch, '00000000-0000-0000-0401-000000000011',
       ARRAY['00000000-0000-0000-0501-000000000003']::uuid[], 'db-test-wd-0001', 'DB test withdrawal', t, ref, bal, ts);
  RAISE NOTICE 'withdrawal % % balance_after %', t, ref, bal;
END $$;
SELECT agent_id, branch_id, balance_after FROM transaction WHERE idempotency_key = 'db-test-wd-0001';
SELECT new_values->'signer_customer_ids' FROM audit_log WHERE action = 'WITHDRAWAL' ORDER BY logged_at DESC LIMIT 1;
ROLLBACK;

-- DB-TXN-07 (owner, business-hours + agent_c1 context) — Teen account 002, leave 400 (< 500)
DO $$ DECLARE ch uuid; t uuid; ref varchar; bal numeric; ts timestamptz; code varchar; amt numeric; n_before int; n_after int; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER';
  SELECT current_balance - 400.00 INTO amt FROM account WHERE account_id = '00000000-0000-0000-0801-000000000002';
  SELECT count(*) INTO n_before FROM transaction;
  CALL sp_try_post_withdrawal('00000000-0000-0000-0801-000000000002', amt, ch, '00000000-0000-0000-0401-000000000011',
       ARRAY['00000000-0000-0000-0501-000000000002']::uuid[], 'db-test-wd-0002', NULL, t, ref, bal, ts, code);
  SELECT count(*) INTO n_after FROM transaction;
  RAISE NOTICE 'rejection % ledger rows before % after %', code, n_before, n_after;     -- BELOW_MINIMUM_BALANCE, equal counts
END $$;
SELECT action, new_values FROM audit_log WHERE action = 'WITHDRAWAL_REJECTED' ORDER BY logged_at DESC LIMIT 1;
ROLLBACK;

-- DB-TXN-08 (owner, business-hours snippet; context per case) — each in its own transaction
-- a) agent_c1, account 003, amount = current_balance + 1          → INSUFFICIENT_FUNDS
-- b) agent_c1, account with balance > 100000.01 (or deposit first), amount 100000.01 → LIMIT_EXCEEDED
-- c) bm_kandy context, account 006 (ALL_HOLDERS), signers ARRAY[customer 08], 100.00   → MANDATE_NOT_SATISFIED
-- d) agent_k1 context, account 003, signer 03                      → WITHDRAWAL_NOT_AUTHORIZED
--    (use the DB-TXN-06 DO block and change amount / account / signers / context)

-- DB-TXN-09 (owner, business-hours + agent_c1 context) — run DB-TXN-06's block twice with the same key: same id;
-- then once more with amount 101.00 and the same key → IDEMPOTENCY_KEY_REUSED

-- DB-TXN-10 (owner, business-hours snippet)
DO $$ DECLARE ch uuid; dep uuid; r varchar; b numeric; ts timestamptz; rev uuid; rref varchar; rbal numeric; BEGIN
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  CALL sp_post_deposit('00000000-0000-0000-0801-000000000003', 700.00, ch, '00000000-0000-0000-0401-000000000011', 'db-test-dep-0002', NULL, dep, r, b, ts);
  CALL sp_reverse_transaction(dep, 'DB test reversal', '00000000-0000-0000-0401-000000000002', rev, rref, rbal);
  RAISE NOTICE 'deposit balance % → after reversal %', b, rbal;           -- rbal = b − 700.00
  BEGIN
    CALL sp_reverse_transaction(dep, 'again', '00000000-0000-0000-0401-000000000002', rev, rref, rbal);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'second reversal: %', SQLERRM;  -- ALREADY_REVERSED
  END;
  BEGIN
    CALL sp_reverse_transaction(rev, 'reverse the reversal', '00000000-0000-0000-0401-000000000002', rev, rref, rbal);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'reverse reversal: %', SQLERRM; -- CANNOT_REVERSE_A_REVERSAL
  END;
END $$;
SELECT transaction_type, amount, narration FROM transaction WHERE idempotency_key = 'db-test-dep-0002';  -- unchanged DEPOSIT
ROLLBACK;

-- DB-TXN-11 (app) — cross-branch reversal probe (F-02)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000003',true),     -- bm_kandy
       set_config('app.current_branch_id','00000000-0000-0000-0101-000000000002',true),
       set_config('app.current_user_role','BRANCH_MANAGER',true);
DO $$ DECLARE orig uuid; r uuid; ref varchar; bal numeric; BEGIN
  SELECT t.transaction_id INTO orig FROM transaction t                                   -- readable: transaction has no RLS
  WHERE t.account_id = '00000000-0000-0000-0801-000000000003' AND t.transaction_type = 'DEPOSIT'
    AND NOT EXISTS (SELECT 1 FROM transaction_reversal x WHERE x.original_transaction_id = t.transaction_id)
  ORDER BY t.ledger_seq DESC LIMIT 1;
  CALL sp_reverse_transaction(orig, 'cross-branch probe', '00000000-0000-0000-0401-000000000003', r, ref, bal);
  RAISE NOTICE 'reversal row % inserted, balance_after % (NULL = F-02 confirmed)', r, bal;
END $$;
ROLLBACK;

-- DB-TXN-12 (owner)
SELECT account_id, ledger_seq, count(*) FROM transaction GROUP BY 1,2 HAVING count(*) > 1;            -- 0 rows
WITH x AS (
  SELECT account_id, ledger_seq, balance_after,
         lag(balance_after) OVER (PARTITION BY account_id ORDER BY ledger_seq) AS prev,
         CASE WHEN transaction_type IN ('DEPOSIT','INTEREST_CREDIT') THEN amount
              WHEN transaction_type = 'WITHDRAWAL' THEN -amount END AS delta
  FROM transaction)
SELECT * FROM x WHERE prev IS NOT NULL AND delta IS NOT NULL AND balance_after <> prev + delta;      -- 0 rows (reversals excluded)

-- DB-TXN-13 (owner)
SELECT channel_name, status FROM transaction_channel ORDER BY 1;
BEGIN; INSERT INTO transaction_channel (channel_name) VALUES ('ONLINE'); ROLLBACK;                   -- 23505
BEGIN; UPDATE transaction_channel SET status = 'BROKEN' WHERE channel_name = 'ONLINE'; ROLLBACK;     -- 23514

-- DB-TXN-14 (owner)
BEGIN;
DO $$ DECLARE f uuid; a uuid; c date; t uuid; r varchar; b numeric; BEGIN
  SELECT p.fd_id, fd.account_id, p.cycle_date INTO f, a, c FROM interest_payout p JOIN fixed_deposit fd USING (fd_id) LIMIT 1;
  CALL sp_post_interest_credit(a, 10.00, f, c, t, r, b); END $$;                                    -- 23505 ux_transaction_reference
ROLLBACK;

-- DB-TXN-15 (owner, two windows A and B; business hours open in both, or run inside hours)
-- A: BEGIN; <agent_c1 context>; DO-block of DB-TXN-06 with amount = (balance − 1000) and key 'race-A';   -- do NOT commit yet
-- B: BEGIN; <agent_c1 context>; same block with key 'race-B';                                           -- waits on the row lock
-- A: COMMIT;   → B continues and raises INSUFFICIENT_FUNDS / BELOW_MINIMUM_BALANCE. B: ROLLBACK.
-- Clean up afterwards: this commits a real withdrawal in window A (prefer a disposable DB, or reset after).
```

---

## 7. Fixed deposits and interest (Member 5 — Selith)

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-FD-01 | `fd_plan` seed + CHECKs | 3 products 6/12/36 months at 0.13/0.14/0.15; bad rows rejected | owner | Block DB-FD-01 | 3 ACTIVE rows; `23514` ×3 | SQL | Covered by existing test (`tests/db/fd-plan-constraints.test.mjs`) | Selith | Nadija | Not run | |
| DB-FD-02 | `fixed_deposit` CHECKs + `uq_one_active_fd_per_account` | Maturity > start; principal > 0; one ACTIVE FD per account | owner | Block DB-FD-02 | `23514` ×2; `23505` | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | |
| DB-FD-03 | `fn_calculate_fd_interest` | `round(P × r × 30 / 365, 2)` | owner | Block DB-FD-03 | 1150.68, 534.25, 3082.19, 0.00 | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | Worked example in docs/07 |
| DB-FD-04 | `sp_open_fixed_deposit` | Debit principal, create FD with rate snapshot and maturity, audit | owner, hours open | Block DB-FD-04 | FD row: rate 0.1400, maturity = start + 12 months, next interest = start + 30 days; account balance −100000.00; ledger row type **WITHDRAWAL** narration "Fixed Deposit Opening Principal Debit"; audit `FD_OPENED` | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | Debit typed as WITHDRAWAL (F-30) |
| DB-FD-05 | `sp_open_fixed_deposit` rejections | Second FD, insufficient balance, inactive account | owner | Block DB-FD-05 | `23505 uq_one_active_fd_per_account`; "Insufficient balance…"; "Account is not active…" | SQL | Covered by existing test (`tests/db/sp-open-fixed-deposit.test.mjs`) | Selith | Nadija | Not run | No `MIN_FD_PRINCIPAL` or business-hours check (F-30) |
| DB-FD-06 | `fixed_deposit` RLS (0420/0421) + column grants | Scoped reads only; app cannot write FDs | **app** | Block DB-FD-06 | no context 0 rows; customer sees FDs of 003/005 only; ADMIN context 0 rows; `SELECT *` → 42501; INSERT → 42501 | SQL | Covered by existing test (`tests/db/customer-fd-scope.test.mjs`, `customer-fd-view.test.mjs`) | Vibodha (read scope) / Selith (table) | Nisith | Not run | App cannot open FDs (F-25) |
| DB-INT-01 | Seeded interest runs | 3 COMPLETED runs, totals match payouts | owner | Block DB-INT-01 | 3 rows COMPLETED; `fd_count` and `total_interest` equal the payout aggregates; 30 payouts each linked to an INTEREST_CREDIT transaction | SQL | Covered by existing test (`tests/db/seed-validation.test.mjs`) | Selith (seed by Vibodha) | Nadija | Not run | |
| DB-INT-02 | `interest_run.cycle_date` UNIQUE (idempotency) | Re-running a cycle date is rejected; nothing new posted | owner | Block DB-INT-02 | `23505 interest_run_cycle_date_key`; payout and ledger counts unchanged | SQL | Covered by existing test (`tests/db/interest-idempotency.test.mjs`, `sp-run-interest-cycle.test.mjs`) | Selith | Nadija | Not run | AC-08 |
| DB-INT-03 | `sp_run_interest_cycle` | New cycle credits each due FD once, advances next date, totals | owner | Block DB-INT-03 | Run COMPLETED; payouts = due ACTIVE FDs; each payout = `fn_calculate_fd_interest(principal, rate_at_opening)`; one INTEREST_CREDIT per payout; `next_interest_date` +30 | SQL | Covered by existing test (`tests/db/sp-run-interest-cycle.test.mjs`) | Selith | Nadija | Not run | Interest after maturity still accrues; MATURED never set (F-29) |
| DB-INT-04 | `uq_payout_fd_cycle` | Same FD cannot be paid twice for a cycle | owner | Block DB-INT-04 | `23505` | SQL | Covered by existing test (`tests/db/interest-idempotency.test.mjs`) | Selith | Nadija | Not run | |
| DB-INT-05 | Grants for interest | App role cannot run the cycle | **app** | `BEGIN; SELECT sp_run_interest_cycle(CURRENT_DATE, NULL); ROLLBACK;` | `42501` permission denied for table interest_run | SQL | Manual only | Selith | Nadija | Not run | Confirms F-25 |

```sql
-- DB-FD-01 (owner)
SELECT plan_name, tenure_months, interest_rate, status, effective_from, effective_to FROM fd_plan ORDER BY tenure_months;
BEGIN; INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('Bad tenure', 0, 0.1); ROLLBACK;         -- 23514 fd_plan_tenure_months_check
BEGIN; INSERT INTO fd_plan (plan_name, tenure_months, interest_rate) VALUES ('Bad rate', 6, 1.5); ROLLBACK;           -- 23514 fd_plan_interest_rate_check
BEGIN; INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, effective_from, effective_to)
       VALUES ('Bad dates', 6, 0.1, '2026-10-09', '2026-10-01'); ROLLBACK;                                            -- 23514 chk_fd_plan_effective_dates

-- DB-FD-02 (owner)
BEGIN; UPDATE fixed_deposit SET maturity_date = start_date WHERE fd_id = '00000000-0000-0000-0901-000000000001'; ROLLBACK;  -- 23514 chk_fd_maturity_after_start
BEGIN; UPDATE fixed_deposit SET principal_amount = 0 WHERE fd_id = '00000000-0000-0000-0901-000000000001'; ROLLBACK;        -- 23514 positive_money_check
BEGIN; INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date)
SELECT account_id, fd_plan_id, 1000, interest_rate_at_opening, CURRENT_DATE, CURRENT_DATE + 180, CURRENT_DATE + 30
FROM fixed_deposit WHERE fd_id = '00000000-0000-0000-0901-000000000001'; ROLLBACK;                                           -- 23505 uq_one_active_fd_per_account

-- DB-FD-03 (owner)
SELECT fn_calculate_fd_interest(100000.00, 0.1400),   -- 1150.68
       fn_calculate_fd_interest(50000.00,  0.1300),   -- 534.25
       fn_calculate_fd_interest(250000.00, 0.1500),   -- 3082.19
       fn_calculate_fd_interest(0.00,      0.1500);   -- 0.00

-- DB-FD-04 (owner, business-hours snippet) — open a fresh account with 150000.00, then an FD of 100000.00
DO $$ DECLARE p uuid; ch uuid; fdp uuid; a uuid; n varchar; b numeric; fd uuid; BEGIN
  SELECT plan_id INTO p FROM savings_plan WHERE plan_name='Adult';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  SELECT fd_plan_id INTO fdp FROM fd_plan WHERE tenure_months = 12 AND status = 'ACTIVE';
  CALL sp_open_savings_account(p,'00000000-0000-0000-0101-000000000001','00000000-0000-0000-0401-000000000011',
    '[{"customer_id":"00000000-0000-0000-0501-000000000004","holder_type":"PRIMARY"}]'::jsonb, NULL, 150000.00, ch,
    '00000000-0000-0000-0401-000000000011', a, n, b);
  fd := sp_open_fixed_deposit(a, fdp, 100000.00, '00000000-0000-0000-0401-000000000011', ch);
  RAISE NOTICE 'account % FD %', n, fd;
END $$;
SELECT f.principal_amount, f.interest_rate_at_opening, f.start_date, f.maturity_date, f.next_interest_date, a.current_balance
FROM fixed_deposit f JOIN account a USING (account_id) ORDER BY f.created_at DESC LIMIT 1;   -- 100000.00, 0.1400, today, +12 months, +30 days, 50000.00
SELECT transaction_type, amount, narration FROM transaction ORDER BY ledger_seq DESC LIMIT 1;  -- WITHDRAWAL 100000.00 "Fixed Deposit Opening Principal Debit"
-- DB-FD-05 continues in the same transaction:
DO $$ DECLARE a uuid; fdp uuid; ch uuid; BEGIN
  SELECT f.account_id INTO a FROM fixed_deposit f ORDER BY f.created_at DESC LIMIT 1;
  SELECT fd_plan_id INTO fdp FROM fd_plan WHERE tenure_months = 6 AND status = 'ACTIVE';
  SELECT channel_id INTO ch FROM transaction_channel WHERE channel_name='BRANCH_COUNTER';
  PERFORM sp_open_fixed_deposit(a, fdp, 10000.00, '00000000-0000-0000-0401-000000000011', ch);   -- 23505 uq_one_active_fd_per_account
END $$;
ROLLBACK;
-- DB-FD-05 b) insufficient balance: repeat DB-FD-04 with FD principal 200000.00 → "Insufficient balance: have …, need …"
-- DB-FD-05 c) inactive account: UPDATE account SET status='FROZEN' on the fresh account before calling → "Account is not active: FROZEN"

-- DB-FD-06 (app)
BEGIN;
SELECT count(*) FROM fixed_deposit;                                                     -- 0 (no context)
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000023',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','CUSTOMER',true);
SELECT fd_id, account_id, status FROM fixed_deposit;                                    -- only FDs on 003 / 005
SELECT * FROM fixed_deposit;                                                            -- 42501 (created_at/updated_at not granted)
ROLLBACK;
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000001',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','ADMIN',true);
SELECT count(fd_id) FROM fixed_deposit;                                                 -- 0 (ADMIN not in the policy)
INSERT INTO fixed_deposit (account_id, fd_plan_id, principal_amount, interest_rate_at_opening, start_date, maturity_date, next_interest_date)
VALUES ('00000000-0000-0000-0801-000000000003', gen_random_uuid(), 1, 0.1, CURRENT_DATE, CURRENT_DATE+1, CURRENT_DATE);  -- 42501
ROLLBACK;

-- DB-INT-01 (owner)
SELECT r.cycle_date, r.status, r.fd_count, r.total_interest,
       count(p.*) AS payouts, sum(p.interest_amount) AS payout_sum,
       count(t.*) FILTER (WHERE t.transaction_type = 'INTEREST_CREDIT') AS credits
FROM interest_run r LEFT JOIN interest_payout p ON p.interest_run_id = r.run_id
LEFT JOIN transaction t ON t.transaction_id = p.transaction_id
GROUP BY r.run_id ORDER BY r.cycle_date;     -- fd_count = payouts = credits; total_interest = payout_sum

-- DB-INT-02 (owner)
BEGIN;
SELECT count(*) FROM interest_payout;                                                   -- note N
SELECT sp_run_interest_cycle(DATE '2026-03-03', '00000000-0000-0000-0401-000000000021');  -- 23505 interest_run_cycle_date_key
ROLLBACK;

-- DB-INT-03 (owner)
BEGIN;
SELECT count(*) AS due FROM fixed_deposit WHERE status = 'ACTIVE' AND next_interest_date <= CURRENT_DATE;
SELECT sp_run_interest_cycle(CURRENT_DATE, '00000000-0000-0000-0401-000000000021') AS run_id;
SELECT status, fd_count, total_interest, exception_count FROM interest_run WHERE cycle_date = CURRENT_DATE;
SELECT p.fd_id, p.interest_amount, fn_calculate_fd_interest(f.principal_amount, f.interest_rate_at_opening) AS expected,
       t.transaction_type, t.reference_number, f.next_interest_date, f.maturity_date
FROM interest_payout p JOIN fixed_deposit f USING (fd_id) JOIN transaction t ON t.transaction_id = p.transaction_id
WHERE p.cycle_date = CURRENT_DATE;                                                      -- interest_amount = expected; INTEREST_CREDIT; INT-YYYYMMDD-…
ROLLBACK;

-- DB-INT-04 (owner)
BEGIN;
INSERT INTO interest_payout (fd_id, interest_run_id, cycle_date, payout_date, interest_amount)
SELECT fd_id, interest_run_id, cycle_date, payout_date, interest_amount FROM interest_payout LIMIT 1;   -- 23505 uq_payout_fd_cycle
ROLLBACK;
```

---

## 8. Reports, views and reconciliation

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-RPT-01 | `vw_rpt01_agent_transactions`, `fn_rpt01_scope`, `fn_rpt01_rows`, `fn_rpt01_exclusions` | Only readable through scoped functions; totals match the attributed ledger | **app** | Block DB-RPT-01 | View `42501`; no context `42501 REPORT_ACCESS_DENIED`; CENTRAL_OPS rows; manager with another branch `42501 REPORT_SCOPE_DENIED`; deposit_total sum = owner query | SQL | Covered by existing test (`tests/db/rpt01-view.test.mjs`, `rpt01-runtime.test.mjs`) | Vibodha | Nisith | Not run | Deposits unattributed (F-10) → small totals |
| DB-RPT-02 | `vw_rpt02_account_summary` (v2) | Last `balance_after_effective` per account equals `current_balance` | owner | Block DB-RPT-02 | 0 rows | SQL | Covered by existing test (`tests/db/rpt02-view.test.mjs`) | Nisith | Pramudith | Not run | |
| DB-RPT-03 | `vw_rpt03_active_fds` | One row per ACTIVE FD with estimated payout | owner and app | Block DB-RPT-03 | count = ACTIVE FDs (10 on seed); `estimated_next_payout` = formula; app without context **still sees all rows** | SQL | Covered by existing test (`tests/db/interest-idempotency.test.mjs`) | Selith | Nadija | Not run | View bypasses RLS (F-32) |
| DB-RPT-04 | `vw_rpt04_interest_distribution` | ROLLUP grand-total row = sum of payouts | owner | Block DB-RPT-04 | grand total = `SUM(interest_amount)` | SQL | Covered by existing test (`tests/db/interest-idempotency.test.mjs`) | Selith | Nadija | Not run | |
| DB-RPT-05 | `vw_rpt05_customer_activity` | Joint activity attributed to every holder; reversals negate | owner | Block DB-RPT-05 | Each account-005 transaction appears twice (customers 03 and 04) | SQL | Covered by existing test (`tests/db/rpt05-view.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Nadija on Pramudith's behalf |
| DB-RPT-06 | `vw_customer_fd_summary` | Customer sees own FDs; staff see branch | **app** | Block DB-RPT-06 | customer: rows only for customer 03; agent_k1: no Colombo rows | SQL | Covered by existing test (`tests/db/customer-fd-view.test.mjs`) | Vibodha | Nisith | Not run | |
| DB-REC-01 | `vw_reconciliation_balance` (D-1) | Stored balance = signed ledger sum | owner | `SELECT * FROM vw_reconciliation_balance WHERE discrepancy <> 0;` | 0 rows on a fresh seed (and after the 04 session if no F-02 probe was committed) | SQL | Covered by existing test (`tests/db/reconciliation.test.mjs`) | Pramudith | Nisith | Not run | Implemented by Nadija on Pramudith's behalf |
| DB-REC-02 | `vw_reconciliation_running_balance` (D-2) | `balance_after` = computed running balance | owner | `SELECT * FROM vw_reconciliation_running_balance WHERE stored_balance_after IS DISTINCT FROM computed_running_balance;` | 0 rows | SQL | Covered by existing test (`tests/db/reconciliation.test.mjs`) | Pramudith | Nisith | Not run | Orders by date, not `ledger_seq` → possible false positives (F-12) |
| DB-REC-03 | Grants on reconciliation views | The app role (used by `/reconciliation`) must be able to read them | **app** | `SELECT count(*) FROM vw_reconciliation_balance;` | Should return a count | SQL | Manual only | Pramudith | Nisith | Not run | **Known issue — expect 42501 permission denied (F-12)** |

```sql
-- DB-RPT-01 (app)
BEGIN; SELECT count(*) FROM vw_rpt01_agent_transactions; ROLLBACK;                         -- 42501
BEGIN; SELECT * FROM fn_rpt01_rows('2026-01-01','2026-12-31',NULL,NULL); ROLLBACK;          -- 42501 REPORT_ACCESS_DENIED (no context)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000021',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','CENTRAL_OPS',true);
SELECT employee_no, agent_name, branch_name, transaction_count, deposit_total, withdrawal_total, interest_total, net_total
FROM fn_rpt01_rows('2026-01-01','2026-12-31',NULL,NULL) ORDER BY employee_no;
SELECT * FROM fn_rpt01_exclusions('2026-01-01','2026-12-31',NULL);                          -- unattributed count/value
ROLLBACK;
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000002',true),
       set_config('app.current_branch_id','00000000-0000-0000-0101-000000000001',true), set_config('app.current_user_role','BRANCH_MANAGER',true);
SELECT * FROM fn_rpt01_rows('2026-01-01','2026-12-31','00000000-0000-0000-0101-000000000002',NULL);  -- 42501 REPORT_SCOPE_DENIED
ROLLBACK;
-- cross-check (owner)
SELECT sum(amount) FILTER (WHERE transaction_type = 'DEPOSIT') AS deposits, count(*) AS n
FROM transaction WHERE agent_id IS NOT NULL
  AND transaction_date >= timestamptz '2026-01-01 00:00 Asia/Colombo' AND transaction_date < timestamptz '2027-01-01 00:00 Asia/Colombo';

-- DB-RPT-02 (owner)
SELECT a.account_number, a.current_balance, v.balance_after_effective
FROM account a
JOIN LATERAL (SELECT balance_after_effective FROM vw_rpt02_account_summary s
              WHERE s.account_id = a.account_id ORDER BY s.ledger_seq DESC NULLS LAST LIMIT 1) v ON true
WHERE v.balance_after_effective IS DISTINCT FROM a.current_balance;                        -- 0 rows

-- DB-RPT-03 (owner)
SELECT count(*) FROM vw_rpt03_active_fds;                                                   -- = SELECT count(*) FROM fixed_deposit WHERE status='ACTIVE'
SELECT fd_id FROM vw_rpt03_active_fds
WHERE estimated_next_payout <> fn_calculate_fd_interest(principal_amount, interest_rate_at_opening);  -- 0 rows
-- (app, no context)
SELECT count(*) FROM vw_rpt03_active_fds;                                                   -- all rows visible (F-32)

-- DB-RPT-04 (owner)
SELECT total_interest FROM vw_rpt04_interest_distribution
WHERE cycle_date IS NULL AND savings_plan_name IS NULL AND fd_product_name IS NULL AND branch_id IS NULL;   -- grand total
SELECT sum(interest_amount) FROM interest_payout;                                                         -- same value

-- DB-RPT-05 (owner)
SELECT transaction_id, array_agg(customer_id ORDER BY customer_id) AS holders
FROM vw_rpt05_customer_activity WHERE account_id = '00000000-0000-0000-0801-000000000005' AND transaction_id IS NOT NULL
GROUP BY transaction_id LIMIT 5;                                                           -- 2 holders per transaction (03, 04)

-- DB-RPT-06 (app)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000023',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','CUSTOMER',true);
SELECT DISTINCT customer_id FROM vw_customer_fd_summary;                                   -- only …0501-000000000003
ROLLBACK;
```

---

## 9. Security: grants, RLS gaps and least privilege

| Test ID | Object | What it should do | Preconditions / test data | Steps | Expected result | Tool | Automated? | Owner (built by) | Tester | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB-SEC-01 | `mims_app` privileges | Cannot DROP/ALTER/TRUNCATE or create objects | **app** | Block DB-SEC-01 | `42501` each | SQL | Partially covered (`tests/db/account-opening-request.test.mjs`, `fn-check-*` grant tests) | Nadija | Vibodha | Not run | |
| DB-SEC-02 | Least privilege on ledger and audit | No UPDATE/DELETE on `transaction`, `audit_log` | **app** | DB-TXN-02 + DB-ID-04 (app parts) | `42501` | SQL | Covered by existing test (`tests/db/transaction-immutability.test.mjs`, `audit-trigger.test.mjs`) | Nadija | Vibodha | Not run | |
| DB-SEC-03 | Direct ledger insert by app role | App role should not be able to bypass posting routines | **app** + central_ops context | Block DB-SEC-03 | Should fail | SQL | Manual only | Pramudith / Nadija (grants) | Selith | Not run | **Known issue — INSERT succeeds (F-58).** Rolled back |
| DB-SEC-04 | `sp_post_interest_credit` EXECUTE | App role should not credit interest directly | **app** + central_ops context | Block DB-SEC-04 | Should raise permission denied | SQL | Manual only | Pramudith (implemented by Selith/Vibodha) | Nisith | Not run | **Known issue — succeeds (F-58).** Rolled back |
| DB-SEC-05 | RLS on `transaction` (NFR-SEC-07) | A Kandy agent must not read Colombo ledger rows | **app** + agent_k1 context | `SELECT count(*) FROM transaction WHERE account_id = '00000000-0000-0000-0801-000000000003';` | Should be 0 | SQL | Manual only (P06-M01-T03 TODO) | Nadija | Vibodha | Not run | **Known issue — returns all rows (F-03)** |
| DB-SEC-06 | RLS bypass check (P06-M01-T03) | Policies hold when the app layer is bypassed | **app** | Re-run DB-ORG-07, DB-ACC-16, DB-FD-06 without any context and with forged context (role `ADMIN` but user id of agent_c1) | No rows / fail closed; FD guard rejects forged identity | SQL | Partially covered (`tests/db/customer-fd-scope.test.mjs`, `rls-audit.test.mjs`) | Nadija | Vibodha | Not run | customer/account policies trust the role setting; only the FD guard re-checks the stored role |
| DB-OPS-01 | Backup / restore (AC-13) | Dump and restore reproduce identical totals | Local PostgreSQL tools | Run `scripts/backup-restore-test.sh` after editing its connection, or manually: `pg_dump -Fc mims_dev > /tmp/m.dump; createdb mims_test_restore; pg_restore -d mims_test_restore /tmp/m.dump;` then compare `SELECT count(*), sum(current_balance) FROM account` in both; `dropdb mims_test_restore` | Identical counts and sums | SQL | Manual only | Selith | Nadija | Not run | Script hard-codes a password (F-33); P06-M05-T02 TODO |

```sql
-- DB-SEC-01 (app)
BEGIN; DROP TABLE branch;                                 ROLLBACK;   -- 42501 must be owner
BEGIN; ALTER TABLE account ADD COLUMN x int;              ROLLBACK;   -- 42501
BEGIN; TRUNCATE transaction;                              ROLLBACK;   -- 42501
BEGIN; CREATE TABLE hack (id int);                        ROLLBACK;   -- 42501 on PG15+ (no CREATE on public)

-- DB-SEC-03 (app)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000021',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','CENTRAL_OPS',true);
INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount)
SELECT '00000000-0000-0000-0801-000000000003', '00000000-0000-0000-0401-000000000021', channel_id, 'HACK-0001', 'DEPOSIT', 1000000.00
FROM transaction_channel WHERE channel_name = 'ONLINE';      -- succeeds today (F-58)
UPDATE account SET current_balance = current_balance + 1000000.00 WHERE account_id = '00000000-0000-0000-0801-000000000003';  -- succeeds (RLS allows CENTRAL_OPS)
ROLLBACK;

-- DB-SEC-04 (app)
BEGIN;
SELECT set_config('app.current_user_id','00000000-0000-0000-0401-000000000021',true),
       set_config('app.current_branch_id','',true), set_config('app.current_user_role','CENTRAL_OPS',true);
DO $$ DECLARE t uuid; r varchar; b numeric; BEGIN
  CALL sp_post_interest_credit('00000000-0000-0000-0801-000000000003', 999.99, gen_random_uuid(), CURRENT_DATE, t, r, b);
  RAISE NOTICE 'credited % → balance %', r, b; END $$;          -- succeeds today (F-58)
ROLLBACK;
```

---

## 10. Parameterized SQL audit (all application queries)

Every SQL statement in `services/**`, `lib/**` and `app/**` was read. **All values are
bound as `$1, $2, …`.** The only string-built parts are constants or allow-listed
identifiers. **No query concatenates user input.** `app/**` contains no SQL at all; `pg` is
imported only in `lib/db/*` (plus scripts, tests and the stray root `analyze.mjs`, F-50).

| File:line | What is interpolated | Source | Verdict |
|---|---|---|---|
| `services/account-service.ts:51-53, 209, 238` | `assignedTo("$6","$7")` placeholder names | literal strings | Safe |
| `services/account-service.ts:178-182, 203-221, 234` | column list constants; `ORDER BY ${sortColumns[sortBy]} ${directions[sortDirection]}` | zod enum → constant map (`lib/validation/account.ts:33-34`) | Safe (allow-list) |
| `services/account-service.ts:127` | advisory-lock key `${userId}:${key}` | passed as `$1`, not interpolated into SQL | Safe |
| `services/customer-service.ts:42-48, 142-156, 171-244` | `CUSTOMER_COLUMNS`, `SCOPE_SQL`, filter fragments; ORDER BY from maps | zod enums (`lib/validation/customer.ts:24-25`) | Safe |
| `services/report-service.ts:14-53, 110-143` | `WHERE ${conditions}` from fixed strings with `$${n}` placeholders; `ORDER BY ${sortCol}` | `allowListed()` (`lib/report/report-handler.ts:46-49`); values in params | Safe |
| `lib/report/report-handler.ts:41` | `$${paramIndex}` | integer | Safe |
| `services/customer-activity-report-service.ts:145-176` | `AGGREGATE_SQL` constant; `ORDER BY ${sortColumn} ${dir}` | `allowListed` + `SORT_COLUMNS` map | Safe |
| `services/account-summary-report-service.ts:125-141` | CTE/column constants; order from `SORT_SQL`/`DIRECTION_SQL` | zod enums | Safe |
| `services/rpt01-report-service.ts:39-42, 88-135` | totals SQL from constant keys; `DECLARE … FOR ` + constant select | constants, zod enums | Safe |
| `lib/db/with-transaction.ts:56` | `BEGIN ISOLATION LEVEL ${isolationLevel}` | TypeScript union set by service code only | Safe (not request-reachable) |
| `lib/db/rls-context.ts:15-21` | — uses `set_config($1..$3)` | bound | Safe |
| `lib/auth/session.ts:20-75` | — | bound | Safe |

Convention issues (not injection): `SELECT *` in `report-service.ts:50,140`,
`savings-plan-service.ts:86`, `fd-product-service.ts:51,80,100` (F-40).

Outside the app: `scripts/db-create.sh:13-16` interpolates the passwords you type into SQL
text. It is a local one-time script, but a quote character breaks it (F-48).

---

## 11. Database object coverage

Every object from the migrations, routines and views and the test that covers it in this
document.

| Object type | Objects | Covered by |
|---|---|---|
| Tables (25) | role, app_user, user_session, login_attempt, audit_log, system_parameter, business_calendar | DB-ID-01…09 (user_session/login_attempt via API-AUTH-03/09) |
| | branch, agent, customer, customer_agent, customer_document | DB-ORG-01…10 |
| | savings_plan, account, account_holder, joint_mandate, account_opening_request | DB-ACC-01…16 |
| | transaction, transaction_channel, transaction_reversal | DB-TXN-01…15 |
| | fd_plan, fixed_deposit, interest_run, interest_payout | DB-FD-01…06, DB-INT-01…05 |
| | schema_migration | DB-SETUP-02 |
| Domains (4) | money_amount, positive_money, interest_rate, record_status | DB-SETUP-03, DB-ACC-01, DB-FD-02, DB-ORG-01 |
| Sequences (3) | account_number_seq, transaction_reference_seq, transaction_ledger_seq | DB-ACC-10, DB-TXN-03, DB-TXN-12 |
| Procedures | sp_open_savings_account, sp_add_account_holder, sp_close_account, sp_post_deposit, sp_post_withdrawal (×2), sp_try_post_withdrawal, sp_write_rejection_audit, sp_reverse_transaction, sp_post_interest_credit | DB-ACC-06…08, 11, 15; DB-TXN-03…11, 14; DB-SEC-04 |
| Functions — business | fn_check_plan_eligibility, fn_check_plan_minimum, fn_withdrawal_mandate_verdict, fn_check_withdrawal_mandate, fn_check_account_fd_eligible, fn_fd_funding_verdict, fn_next_account_number, fn_next_transaction_reference, fn_calculate_fd_interest, sp_open_fixed_deposit (function), sp_run_interest_cycle (function), fn_is_business_hour, fn_get_parameter, fn_check_business_hours, fn_check_withdrawal_single_limit, fn_check_withdrawal_daily_limit | DB-ACC-02, 10, 12…14; DB-TXN-03; DB-FD-03…05; DB-INT-02, 03; DB-ID-08, 09 |
| Functions — RLS/report | fn_rls_user_id, fn_rls_branch_id, fn_rls_role, fn_rls_is_bank_wide, fn_rls_in_branch, fn_rls_can_write, fn_customer_fd_actor_is_current, fn_rpt01_scope, fn_rpt01_rows, fn_rpt01_exclusions | DB-ORG-07, DB-ACC-16, DB-FD-06, DB-SEC-06, DB-RPT-01 |
| Functions — trigger/infra | set_updated_at, fn_audit_log_immutable, fn_audit_master_changes, fn_mask_audit_values, fn_validate_agent_active_branch, fn_prevent_branch_deactivation_with_active_agents, fn_prevent_account_branch_change, fn_check_account_holder_sets, fn_trg_account_holder_inserted/updated, fn_validate_joint_mandate_fit, fn_account_close_guard, trg_fn_financial_transaction_immutable, fn_install_customer_fd_summary, fn_install_customer_fd_scope_guard | DB-ID-04, 06, 07; DB-ORG-02, 03, 10; DB-ACC-03…05, 15; DB-TXN-02; DB-RPT-06 (installers run at rebuild, DB-SETUP-01) |
| Triggers (25) | all listed in docs/16 and 06 §3–7 | the trigger's function row above; `set_updated_at` triggers are implicitly exercised by any UPDATE (not separately asserted) |
| Views (8) | vw_rpt01_agent_transactions, vw_rpt02_account_summary, vw_rpt03_active_fds, vw_rpt04_interest_distribution, vw_rpt05_customer_activity, vw_customer_fd_summary, vw_reconciliation_balance, vw_reconciliation_running_balance | DB-RPT-01…06, DB-REC-01…03 |
| RLS policies (13) | customer ×3, account ×4, customer_agent ×2, customer_document ×2, fixed_deposit ×2 | DB-ORG-07, 08; DB-ACC-16; DB-FD-06; DB-SEC-06 (customer_agent policies via DB-ORG-05 app variant — **not separately written**, see 04 coverage summary) |
| Indexes | partial uniques (`ux_customer_agent_one_active`, `uq_account_holder_one_primary`, `ux_transaction_idempotency`, `uq_one_active_fd_per_account`), `uq_payout_fd_cycle`, `ux_transaction_account_ledger_seq`, trigram | DB-ORG-05, 09; DB-ACC-04; DB-TXN-01, 12; DB-FD-02; DB-INT-04. Plain btree indexes: evidence in `database/indexes/explain-analyze-evidence.md` (P05-M05-T04), not re-tested here |
