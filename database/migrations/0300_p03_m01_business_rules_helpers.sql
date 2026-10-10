-- Migration: 0300_p03_m01_business_rules_helpers.sql
-- Task: P03-M01-T01 · Owner: Member 1 (Nadija)
-- Purpose: Expose fn_get_parameter() helper so business-rule checks can read
--          system_parameter values in a single safe call. Also creates
--          fn_check_business_hours() and fn_check_withdrawal_limits() as
--          database-level guards that sp_post_withdrawal (P03-M04-T03) will
--          call inside its locked transaction.
-- Concepts: L05 integrity, L08 stored routines, L11 triggers.
-- Migration block: 0300–0319 reserved for M1 Phase 3 (AGENTS.md §12).

BEGIN;

-- ── fn_get_parameter ─────────────────────────────────────────────────────────
-- Reads a single system_parameter value. Returns NULL for an unknown key so
-- callers can decide their own fallback. STABLE because system_parameter rows
-- do not change within a transaction.
CREATE OR REPLACE FUNCTION fn_get_parameter(p_key varchar)
RETURNS varchar
LANGUAGE sql
STABLE
AS $$
    SELECT param_value FROM system_parameter WHERE param_key = p_key LIMIT 1;
$$;

COMMENT ON FUNCTION fn_get_parameter(varchar) IS
    'Returns the param_value for the given param_key from system_parameter, '
    'or NULL if the key does not exist.';

-- ── fn_check_business_hours ──────────────────────────────────────────────────
-- Database-level guard for BR-08. Returns false (never raises) so the caller
-- decides the error. Call it AFTER acquiring the account lock so the decision
-- is made within the same snapshot as the balance read.
--
-- Rules (from fn_is_business_hour, which this delegates to):
--   1. If today is in business_calendar and is_business_day = false → false.
--   2. If today has custom open/close times in business_calendar → use them.
--   3. Otherwise use BUSINESS_HOUR_START / BUSINESS_HOUR_END from system_parameter.
-- Weekends are not explicitly modelled; business_calendar is the authority.
CREATE OR REPLACE FUNCTION fn_check_business_hours(check_ts timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT fn_is_business_hour(check_ts);
$$;

COMMENT ON FUNCTION fn_check_business_hours(timestamptz) IS
    'BR-08: Returns true when check_ts falls within business hours as defined '
    'by business_calendar and system_parameter. Delegates to fn_is_business_hour. '
    'Call after locking the account row; false → reject with OUTSIDE_BUSINESS_HOURS.';

-- ── fn_check_withdrawal_single_limit ────────────────────────────────────────
-- Checks one withdrawal amount against WITHDRAWAL_SINGLE_LIMIT.
-- Returns true when the amount is within the limit; false otherwise.
-- Returns true if the parameter is not configured (fail-open for this guard,
-- since a missing limit is the bank's configuration problem, not the customer's).
CREATE OR REPLACE FUNCTION fn_check_withdrawal_single_limit(p_amount numeric(15,2))
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_limit numeric(15,2);
BEGIN
    IF p_amount IS NULL THEN
        RETURN false;
    END IF;
    SELECT fn_get_parameter('WITHDRAWAL_SINGLE_LIMIT')::numeric(15,2) INTO v_limit;
    IF v_limit IS NULL THEN
        RETURN true; -- no limit configured
    END IF;
    RETURN p_amount <= v_limit;
END;
$fn$;

COMMENT ON FUNCTION fn_check_withdrawal_single_limit(numeric) IS
    'BR-I2: true when p_amount <= WITHDRAWAL_SINGLE_LIMIT from system_parameter. '
    'Returns false for NULL input. Returns true when the parameter is not configured.';

-- ── fn_check_withdrawal_daily_limit ─────────────────────────────────────────
-- Checks whether posting p_amount for p_account_id would breach the daily
-- withdrawal total (WITHDRAWAL_DAILY_LIMIT). Reads committed withdrawals for
-- the account on the current Asia/Colombo calendar date.
-- Call INSIDE the locked transaction, after the account lock, before the ledger insert.
CREATE OR REPLACE FUNCTION fn_check_withdrawal_daily_limit(
    p_account_id uuid,
    p_amount     numeric(15,2)
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_limit      numeric(15,2);
    v_daily_used numeric(15,2);
BEGIN
    IF p_account_id IS NULL OR p_amount IS NULL THEN
        RETURN false;
    END IF;
    SELECT fn_get_parameter('WITHDRAWAL_DAILY_LIMIT')::numeric(15,2) INTO v_limit;
    IF v_limit IS NULL THEN
        RETURN true; -- no limit configured
    END IF;
    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_daily_used
    FROM transaction t
    WHERE t.account_id = p_account_id
      AND t.transaction_type = 'WITHDRAWAL'
      AND (t.transaction_date AT TIME ZONE 'Asia/Colombo')::date
          = (now() AT TIME ZONE 'Asia/Colombo')::date;

    RETURN (v_daily_used + p_amount) <= v_limit;
END;
$fn$;

COMMENT ON FUNCTION fn_check_withdrawal_daily_limit(uuid, numeric) IS
    'BR-I2: true when the sum of today''s withdrawals on the account plus p_amount '
    'is within WITHDRAWAL_DAILY_LIMIT. Call inside the locked withdrawal transaction '
    'before the ledger insert; false → reject with DAILY_LIMIT_EXCEEDED.';

COMMIT;
