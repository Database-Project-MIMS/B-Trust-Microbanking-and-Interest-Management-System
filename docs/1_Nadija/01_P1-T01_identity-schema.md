# 🔵 Phase 1 — Task 01: Identity Schema
**Task ID:** `P01-M01-T01` · **Branch:** `feat/p01-m01-identity-schema`  
**Migration:** `0100_p01_m01_identity.sql` · **Status:** READY  
**Depends on:** migration `0000` (already DONE)  
**Story Points:** ~3 · **Layer:** Database only

---

## What This Task Is

Create the four core identity tables that everything else in the system depends on. This is your **first task** and purely database work — no backend or frontend yet.

---

## Tables to Create

### 1. `role`
The application roles (7 roles from SRS §2.4).

| Column | Type | Constraints |
|---|---|---|
| `role_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `role_name` | `varchar(50)` | **UNIQUE, NOT NULL** |
| `description` | `varchar(255)` | |
| `status` | `varchar(20)` | `record_status` domain, NOT NULL |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **DELETE rule:** `RESTRICT` — referenced by `app_user`
- Seed 7 roles: `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER`, `AGENT`, `AUDITOR`, `CUSTOMER`, `QA_TESTER`

### 2. `app_user`
Authentication identity. Named `app_user` because `user` is a SQL reserved word.

| Column | Type | Constraints |
|---|---|---|
| `user_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `role_id` | `uuid` | **FK → role**, NOT NULL |
| `username` | `varchar(100)` | **UNIQUE, NOT NULL** |
| `password_hash` | `varchar(255)` | NOT NULL |
| `status` | `varchar(20)` | `record_status`, NOT NULL |
| `registered_date` | `date` | NOT NULL DEFAULT `CURRENT_DATE` |
| `last_login` | `timestamptz` | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

- **Indexes:** `(role_id, status)` for admin listing
- **Rules:** password is NEVER plaintext; deactivate, never delete

### 3. `user_session`
Server-side session records — so sessions can be invalidated (FR-AUTH-04).

| Column | Type | Constraints |
|---|---|---|
| `session_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `user_id` | `uuid` | **FK → app_user**, NOT NULL |
| `token_hash` | `varchar(255)` | UNIQUE, NOT NULL |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `expires_at` | `timestamptz` | NOT NULL |
| `revoked_at` | `timestamptz` | NULL (set on logout) |
| `ip_address` | `varchar(45)` | |
| `user_agent` | `varchar(500)` | |

### 4. `login_attempt`
Failed sign-in throttling (FR-AUTH-03).

| Column | Type | Constraints |
|---|---|---|
| `attempt_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `username_attempted` | `varchar(100)` | NOT NULL |
| `success` | `boolean` | NOT NULL |
| `ip_address` | `varchar(45)` | |
| `attempted_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- **Index:** `(username_attempted, attempted_at DESC)` for throttle lookups

---

## How to Implement

### Step 1 — Write the Migration
Create file: `database/migrations/0100_p01_m01_identity.sql`

```sql
-- Migration 0100: Identity schema (M1)
-- Tables: role, app_user, user_session, login_attempt

BEGIN;

CREATE TABLE role (
    role_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name     varchar(50) NOT NULL UNIQUE,
    description   varchar(255),
    status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz
);

CREATE TABLE app_user (
    user_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         uuid NOT NULL REFERENCES role(role_id) ON DELETE RESTRICT,
    username        varchar(100) NOT NULL UNIQUE,
    password_hash   varchar(255) NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    registered_date date NOT NULL DEFAULT CURRENT_DATE,
    last_login      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz
);
CREATE INDEX ix_app_user_role_status ON app_user(role_id, status);

CREATE TABLE user_session (
    session_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    token_hash   varchar(255) NOT NULL UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,
    ip_address   varchar(45),
    user_agent   varchar(500)
);

CREATE TABLE login_attempt (
    attempt_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username_attempted  varchar(100) NOT NULL,
    success             boolean NOT NULL,
    ip_address          varchar(45),
    attempted_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_login_attempt_user_time
    ON login_attempt(username_attempted, attempted_at DESC);

-- Register migration
INSERT INTO schema_migration(version, name)
VALUES (100, '0100_p01_m01_identity');

COMMIT;
```

### Step 2 — Write SQL Tests
Create file: `tests/db/identity-constraints.test.mjs`

Test these scenarios:
1. ✅ Duplicate `username` is rejected (error code `23505`)
2. ✅ Deleting a `role` that is referenced by `app_user` is rejected (`RESTRICT`)
3. ✅ No plaintext password column exists (there is `password_hash`, not `password`)
4. ✅ NULL `username` is rejected
5. ✅ Invalid `status` values are rejected by CHECK constraint

### Step 3 — Run & Verify
```bash
npm run db:rebuild    # Should apply all migrations cleanly
npm run db:verify     # Should pass
npm test              # Your new tests should pass
```

### Step 4 — Update Docs
- Update `docs/04_database-schema.md` Part B rows for the 4 tables (mark as implemented)
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] Duplicate username raises error `23505`
- [ ] No plaintext password column exists
- [ ] `npm run db:rebuild` succeeds from empty
