# 🔵 Phase 1 — Task 05: System Parameters, Business Calendar & Audit Log
**Task ID:** `P01-M01-T05` · **Branch:** `feat/p01-m01-parameters-audit`  
**Migration:** `0104_p01_m01_parameters_audit.sql`  
**Status:** READY · **Depends on:** P01-M01-T01; ERD gaps G-15, G-22 approved  
**Story Points:** ~2 · **Layer:** Database + Backend + Frontend

---

## What This Task Is

Create the system parameter tables, business calendar, and audit log — plus the audit triggers and a parameter administration page. This makes business hours and withdrawal limits **data-driven** (not hardcoded constants).

---

## Tables to Create (Migration `0104`)

### 1. `system_parameter`
Configurable business rules as data, not code (BR-08).

| Column | Type | Constraints |
|---|---|---|
| `param_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `param_key` | `varchar(100)` | **UNIQUE, NOT NULL** |
| `param_value` | `varchar(500)` | NOT NULL |
| `description` | `varchar(500)` | |
| `data_type` | `varchar(50)` | e.g. `STRING`, `NUMBER`, `BOOLEAN` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | |

**Seed values:**
- `WITHDRAWAL_SINGLE_LIMIT` → `100000.00`
- `WITHDRAWAL_DAILY_LIMIT` → `200000.00`
- `BUSINESS_HOUR_START` → `08:30`
- `BUSINESS_HOUR_END` → `17:00`
- `SESSION_IDLE_TIMEOUT_MINUTES` → `20`
- `SESSION_ABSOLUTE_TIMEOUT_HOURS` → `8`
- `INTEREST_CYCLE_DAYS` → `30`

### 2. `business_calendar`
Working days and open/close times.

| Column | Type | Constraints |
|---|---|---|
| `calendar_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `calendar_date` | `date` | **UNIQUE, NOT NULL** |
| `is_business_day` | `boolean` | NOT NULL DEFAULT `true` |
| `open_time` | `time` | |
| `close_time` | `time` | |
| `description` | `varchar(255)` | e.g. "Poya Day" |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

### 3. `audit_log`
Append-only audit trail for all master-data changes.

| Column | Type | Constraints |
|---|---|---|
| `log_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `user_id` | `uuid` | **FK → app_user**, **NULLABLE** (system actions have no user — G-22) |
| `actor_type` | `varchar(20)` | `USER` / `SYSTEM` |
| `entity_type` | `varchar(100)` | NOT NULL |
| `entity_id` | `uuid` | |
| `action` | `varchar(50)` | NOT NULL (e.g. `INSERT`, `UPDATE`, `DELETE`) |
| `old_values` | `jsonb` | Before values |
| `new_values` | `jsonb` | After values |
| `ip_address` | `varchar(45)` | |
| `logged_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- **Indexes:** `(user_id, logged_at DESC)`, `(entity_type, entity_id)`
- **Append-only:** No UPDATE, no DELETE by application role

---

## Triggers to Create

### `trg_audit_log_immutable`
Prevents UPDATE/DELETE on `audit_log` — the audit trail must be append-only.

```sql
CREATE OR REPLACE FUNCTION fn_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log rows are immutable — UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log_immutable();
```

### `trg_audit_master_changes`
Automatically writes before/after values as jsonb when master-data tables are modified.

```sql
-- Attach to: role, app_user, branch, agent, savings_plan, fd_plan, system_parameter
-- On AFTER INSERT/UPDATE/DELETE
-- Writes old_values and new_values as jsonb to audit_log
```

---

## Function to Create

### `fn_is_business_hour(ts timestamptz) → boolean`
Reads `business_calendar` and `system_parameter` to determine if a given timestamp is within business hours.

```sql
CREATE OR REPLACE FUNCTION fn_is_business_hour(check_ts timestamptz)
RETURNS boolean AS $$
DECLARE
    check_date date;
    check_time time;
    cal_row business_calendar%ROWTYPE;
    default_open time;
    default_close time;
BEGIN
    check_date := (check_ts AT TIME ZONE 'Asia/Colombo')::date;
    check_time := (check_ts AT TIME ZONE 'Asia/Colombo')::time;
    
    -- Check business_calendar first
    SELECT * INTO cal_row FROM business_calendar WHERE calendar_date = check_date;
    IF FOUND THEN
        IF NOT cal_row.is_business_day THEN RETURN false; END IF;
        IF cal_row.open_time IS NOT NULL AND cal_row.close_time IS NOT NULL THEN
            RETURN check_time BETWEEN cal_row.open_time AND cal_row.close_time;
        END IF;
    END IF;
    
    -- Fall back to system_parameter defaults
    SELECT param_value::time INTO default_open 
    FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START';
    SELECT param_value::time INTO default_close 
    FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END';
    
    RETURN check_time BETWEEN default_open AND default_close;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Backend — Services & API

### `services/audit-service.ts`
```typescript
// Write an audit event
export async function writeAuditEvent(params: {
  userId: string | null;
  actorType: 'USER' | 'SYSTEM';
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void>
```

**Remember:** Sensitive values (NIC numbers, password hashes) must be **masked before** being written (NFR-SEC-05).

### Parameter Read Helper
```typescript
// Read a system parameter by key
export async function getParameter(key: string): Promise<string>
export async function getParameterAsNumber(key: string): Promise<number>
```

### Frontend — Parameter Administration Page
Create `app/admin/parameters/page.tsx`:
- List all system parameters with key, value, description
- ADMIN role can edit values
- Changes are audited via `trg_audit_master_changes`

---

## Tests to Write (`tests/db/audit-trigger.test.mjs`)

| Test | What it verifies |
|---|---|
| Master-data UPDATE writes before/after values to `audit_log` | Trigger works |
| `audit_log` rejects UPDATE by the app role | Immutability |
| `audit_log` rejects DELETE by the app role | Immutability |
| `fn_is_business_hour` returns true during business hours | Business hours |
| `fn_is_business_hour` returns false on a holiday | Calendar integration |
| Parameter values are readable and correct | Seed data |

---

## Acceptance Criteria
- [ ] Business hours and withdrawal limits are readable as **data**, not constants in code
- [ ] Audit trigger writes before/after values on master-data changes
- [ ] `audit_log` rejects UPDATE and DELETE
- [ ] `fn_is_business_hour` works with both calendar and system parameter fallback
- [ ] Parameter admin page works for ADMIN role
- [ ] BR-08 enforcement documented in `docs/07_business-rules.md`
