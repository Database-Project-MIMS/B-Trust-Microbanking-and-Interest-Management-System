-- Migration: 0441_p04_m03_sp_close_account.sql
-- Task: P04-M03-T02 (FR-ACC-05, BR-18) · Owner: Member 3
-- Purpose: An account may only be closed with a ZERO balance and NO ACTIVE fixed deposit.
--   1. trg_account_close_guard: the database-level rule. Any UPDATE that moves an account to CLOSED is
--      rejected unless current_balance = 0 and no fixed_deposit with status 'ACTIVE' exists, so a direct
--      UPDATE cannot skip the rule. It reads fixed_deposit through SECURITY DEFINER because fixed_deposit
--      has row-level security (0420/0421) and a caller-scoped read could miss an FD. It first takes the
--      account row lock FOR UPDATE: a plain UPDATE only takes a NO KEY UPDATE lock, which does not conflict
--      with the KEY SHARE lock an in-flight fixed_deposit INSERT holds, so without this lock a close could
--      run beside an uncommitted FD. With it the close waits for that insert, then sees the committed FD.
--      Not covered (the FD table belongs to M5): an FD inserted AFTER the account is already CLOSED by
--      SQL that never locks the account or checks its status. sp_open_fixed_deposit locks and checks.
--   2. sp_close_account: the orchestration. Locks the account row FOR UPDATE, re-validates status, balance
--      and FD under the lock, closes the account and writes one explicit 'CLOSE' audit row for the acting
--      user (trg_audit_account also records a generic 'UPDATE' row for the same actor, so an auditor can
--      filter on the distinct business event).
-- Why FOR UPDATE (not FOR NO KEY UPDATE as sp_add_account_holder uses): inserting a fixed_deposit takes a
-- KEY SHARE lock on its account through the foreign key; only FOR UPDATE conflicts with it, so "close" and
-- "open FD" on the same account serialize.
-- Only an ACTIVE account can be closed: a FROZEN account stays frozen until it is unfrozen.
-- Transaction boundary: the CALLER's (never commits). sp_close_account is SECURITY INVOKER: RLS applies.
-- Errors are P0001 with a stable message prefix and a named CONSTRAINT, as in 0243/0245:
--   ck_close_account_actor (ACTOR_MISMATCH), ck_close_account_not_found (ACCOUNT_NOT_FOUND),
--   ck_close_account_already_closed (ACCOUNT_ALREADY_CLOSED), ck_close_account_not_active (ACCOUNT_NOT_ACTIVE),
--   ck_close_account_balance (BALANCE_NOT_ZERO), ck_close_account_active_fd (ACTIVE_FD_EXISTS).
-- The two business-rule codes are raised by the guard trigger too, with the same constraint names.

BEGIN;

-- ── Guard trigger: the rule cannot be bypassed by a direct UPDATE ─────────────
CREATE OR REPLACE FUNCTION fn_account_close_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    -- Serialize with FD inserts (their foreign key takes KEY SHARE on this row). Already held when the
    -- caller is sp_close_account; this makes a direct UPDATE wait for an in-flight FD insert too.
    PERFORM 1 FROM account WHERE account_id = NEW.account_id FOR UPDATE;

    IF NEW.current_balance <> 0 THEN
        RAISE EXCEPTION 'BALANCE_NOT_ZERO: an account can only be closed with a zero balance'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_balance';
    END IF;

    -- SECURITY DEFINER: the existence check must see every FD, not only those the caller's RLS shows.
    IF EXISTS (SELECT 1 FROM fixed_deposit fd WHERE fd.account_id = NEW.account_id AND fd.status = 'ACTIVE') THEN
        RAISE EXCEPTION 'ACTIVE_FD_EXISTS: an account with an active fixed deposit cannot be closed'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_active_fd';
    END IF;

    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION fn_account_close_guard() FROM PUBLIC;

COMMENT ON FUNCTION fn_account_close_guard() IS
    'P04-M03-T02 / BR-18: BEFORE UPDATE guard on account. Locks the account row FOR UPDATE (waits for an in-flight FD insert), then rejects a move to CLOSED unless current_balance = 0 and the account has no ACTIVE fixed deposit. SECURITY DEFINER so row-level security on fixed_deposit cannot hide an FD; search_path is pinned.';

DROP TRIGGER IF EXISTS trg_account_close_guard ON account;
CREATE TRIGGER trg_account_close_guard
    BEFORE UPDATE OF status ON account
    FOR EACH ROW
    WHEN (NEW.status = 'CLOSED' AND OLD.status IS DISTINCT FROM 'CLOSED')
    EXECUTE FUNCTION fn_account_close_guard();

-- ── sp_close_account ──────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_close_account(
    IN  p_account_id    UUID,
    IN  p_actor_user_id UUID,
    OUT p_closed_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $sp$
DECLARE
    v_session_actor TEXT;
    v_status        VARCHAR;
    v_balance       NUMERIC(15,2);
BEGIN
    IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: an acting user is required'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_actor';
    END IF;

    v_session_actor := NULLIF(current_setting('app.current_user_id', true), '');
    IF v_session_actor IS NULL THEN
        PERFORM set_config('app.current_user_id', p_actor_user_id::text, true);
    ELSIF v_session_actor <> p_actor_user_id::text THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: the acting user does not match the session user'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_actor';
    END IF;

    -- Lock before you decide (AGENTS 11): the account, then re-read status and balance.
    SELECT status, current_balance INTO v_status, v_balance
      FROM account
     WHERE account_id = p_account_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: no such account in your scope'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_not_found';
    END IF;
    IF v_status = 'CLOSED' THEN
        RAISE EXCEPTION 'ACCOUNT_ALREADY_CLOSED: the account is already closed'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_already_closed';
    END IF;
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE: only an active account can be closed'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_not_active';
    END IF;
    IF v_balance <> 0 THEN
        RAISE EXCEPTION 'BALANCE_NOT_ZERO: an account can only be closed with a zero balance'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_balance';
    END IF;

    -- Read as the caller (RLS applies). A hidden FD is still caught by trg_account_close_guard below.
    PERFORM 1 FROM fixed_deposit WHERE account_id = p_account_id AND status = 'ACTIVE';
    IF FOUND THEN
        RAISE EXCEPTION 'ACTIVE_FD_EXISTS: an account with an active fixed deposit cannot be closed'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_active_fd';
    END IF;

    UPDATE account
       SET status = 'CLOSED'
     WHERE account_id = p_account_id
    RETURNING updated_at INTO p_closed_at;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, old_values, new_values)
    VALUES (p_actor_user_id, 'USER', 'account', p_account_id, 'CLOSE',
            jsonb_build_object('status', v_status, 'current_balance', v_balance),
            jsonb_build_object('status', 'CLOSED', 'current_balance', v_balance));
END;
$sp$;

COMMENT ON PROCEDURE sp_close_account(UUID, UUID) IS
    'Closes an ACTIVE account with a zero balance and no ACTIVE fixed deposit (BR-18): locks the account FOR UPDATE, re-validates under the lock, writes one USER audit row. trg_account_close_guard enforces the same rule on any direct UPDATE. Caller owns the transaction.';

COMMIT;
