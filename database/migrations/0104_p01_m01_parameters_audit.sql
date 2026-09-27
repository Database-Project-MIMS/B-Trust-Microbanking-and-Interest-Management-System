-- Migration: 0104_p01_m01_parameters_audit.sql
-- Task: P01-M01-T05
-- Author: M1 (Nadija)

BEGIN;

-- ─── system_parameter ────────────────────────────────────────────────────────
CREATE TABLE system_parameter (
    param_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    param_key   varchar(100) NOT NULL UNIQUE,
    param_value varchar(500) NOT NULL,
    description varchar(500),
    data_type   varchar(50),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz
);

INSERT INTO system_parameter (param_key, param_value, description, data_type) VALUES
  ('WITHDRAWAL_SINGLE_LIMIT',        '100000.00', 'Maximum amount per single withdrawal',           'NUMBER'),
  ('WITHDRAWAL_DAILY_LIMIT',         '200000.00', 'Maximum total withdrawals per customer per day', 'NUMBER'),
  ('BUSINESS_HOUR_START',            '08:30',     'Branch opening time (Asia/Colombo)',             'STRING'),
  ('BUSINESS_HOUR_END',              '17:00',     'Branch closing time (Asia/Colombo)',             'STRING'),
  ('SESSION_IDLE_TIMEOUT_MINUTES',   '20',        'Idle session timeout in minutes',                'NUMBER'),
  ('SESSION_ABSOLUTE_TIMEOUT_HOURS', '8',         'Absolute maximum session duration in hours',     'NUMBER'),
  ('INTEREST_CYCLE_DAYS',            '30',        'Interest distribution cycle length in days',     'NUMBER');

-- ─── business_calendar ───────────────────────────────────────────────────────
CREATE TABLE business_calendar (
    calendar_id     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_date   date    NOT NULL UNIQUE,
    is_business_day boolean NOT NULL DEFAULT true,
    open_time       time,
    close_time      time,
    description     varchar(255),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed Poya holidays for tests
INSERT INTO business_calendar (calendar_date, is_business_day, description) VALUES
  ('2025-01-13', false, 'Duruthu Full Moon Poya Day'),
  ('2025-02-12', false, 'Navam Full Moon Poya Day'),
  ('2025-03-13', false, 'Medin Full Moon Poya Day');

-- ─── audit_log ───────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    log_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         REFERENCES app_user(user_id) ON DELETE RESTRICT,
    actor_type  varchar(20)  NOT NULL CHECK (actor_type IN ('USER','SYSTEM')),
    entity_type varchar(100) NOT NULL,
    entity_id   uuid,
    action      varchar(50)  NOT NULL,
    old_values  jsonb,
    new_values  jsonb,
    ip_address  varchar(45),
    logged_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_log_user_time ON audit_log(user_id, logged_at DESC);
CREATE INDEX ix_audit_log_entity    ON audit_log(entity_type, entity_id);

-- ─── Trigger: audit_log is APPEND-ONLY ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log rows are immutable — UPDATE and DELETE are not permitted';
END;
$$;

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_immutable();

-- ─── Trigger: write before/after on master-data changes ──────────────────────
CREATE OR REPLACE FUNCTION fn_audit_master_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, old_values, new_values)
    VALUES (
        NULL,
        'SYSTEM',
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN (row_to_json(OLD) ->> (TG_TABLE_NAME || '_id'))::uuid
            ELSE                       (row_to_json(NEW) ->> (TG_TABLE_NAME || '_id'))::uuid
        END,
        TG_OP,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_system_parameter
    AFTER INSERT OR UPDATE OR DELETE ON system_parameter
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

CREATE TRIGGER trg_audit_role
    AFTER INSERT OR UPDATE OR DELETE ON role
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

CREATE TRIGGER trg_audit_app_user
    AFTER INSERT OR UPDATE OR DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

-- ─── Function: fn_is_business_hour ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_is_business_hour(check_ts timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
    check_date    date;
    check_time    time;
    cal_row       business_calendar%ROWTYPE;
    default_open  time;
    default_close time;
BEGIN
    check_date := (check_ts AT TIME ZONE 'Asia/Colombo')::date;
    check_time := (check_ts AT TIME ZONE 'Asia/Colombo')::time;

    SELECT * INTO cal_row FROM business_calendar WHERE calendar_date = check_date;
    IF FOUND THEN
        IF NOT cal_row.is_business_day THEN RETURN false; END IF;
        IF cal_row.open_time IS NOT NULL AND cal_row.close_time IS NOT NULL THEN
            RETURN check_time BETWEEN cal_row.open_time AND cal_row.close_time;
        END IF;
    END IF;

    SELECT param_value::time INTO default_open  FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START';
    SELECT param_value::time INTO default_close FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END';

    RETURN check_time BETWEEN default_open AND default_close;
END;
$$;

COMMIT;
