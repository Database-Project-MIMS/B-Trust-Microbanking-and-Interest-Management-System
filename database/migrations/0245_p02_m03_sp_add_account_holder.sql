-- Migration: 0245_p02_m03_sp_add_account_holder.sql
-- Task: P02-M03-T05 (FR-ACC-02/04, BR-02, BR-07) · Owner: Member 3
-- Purpose: Add one JOINT holder to an existing account with the same rules account opening
--          applies: account ACTIVE, customer ACTIVE with a verified document. The 0242
--          trigger still enforces holder count, adults, one PRIMARY and keeps an
--          ALL_HOLDERS mandate's signatories equal to the holder count.
-- Transaction boundary: the CALLER's (never commits). SECURITY INVOKER: RLS applies.
-- Errors are P0001 with a stable message prefix and a named CONSTRAINT, as in 0242/0243:
--   ACTOR_MISMATCH, ACCOUNT_NOT_FOUND, ACCOUNT_NOT_ACTIVE, HOLDER_NOT_FOUND,
--   DOCUMENTS_NOT_VERIFIED; plus 0242: INVALID_HOLDER_COUNT, UNDERAGE_HOLDER;
--   23505 uq_account_holder_account_customer for a duplicate holder.

BEGIN;

CREATE OR REPLACE PROCEDURE sp_add_account_holder(
    IN  p_account_id        UUID,
    IN  p_customer_id       UUID,
    IN  p_actor_user_id     UUID,
    OUT p_account_holder_id UUID,
    OUT p_holder_count      INT
)
LANGUAGE plpgsql
AS $sp$
DECLARE
    v_session_actor TEXT;
    v_status        VARCHAR;
BEGIN
    IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: an acting user is required'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_add_holder_actor';
    END IF;

    v_session_actor := NULLIF(current_setting('app.current_user_id', true), '');
    IF v_session_actor IS NULL THEN
        PERFORM set_config('app.current_user_id', p_actor_user_id::text, true);
    ELSIF v_session_actor <> p_actor_user_id::text THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: the acting user does not match the session user'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_add_holder_actor';
    END IF;

    -- Lock before you decide (AGENTS 11): the account, then re-read its status.
    SELECT status INTO v_status
      FROM account
     WHERE account_id = p_account_id
       FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: no such account in your scope'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_add_holder_account';
    END IF;
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE: holders can only be added to an active account'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_add_holder_account_active';
    END IF;

    -- The new holder: exists, visible to the caller, ACTIVE; locked so it cannot be
    -- deactivated between this check and the insert.
    PERFORM 1
       FROM customer
      WHERE customer_id = p_customer_id AND status = 'ACTIVE'
        FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'HOLDER_NOT_FOUND: the holder must be an existing active customer'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_holder_exists';
    END IF;

    PERFORM 1
       FROM customer_document
      WHERE customer_id = p_customer_id AND verified_by IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENTS_NOT_VERIFIED: the holder has no verified document'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_documents';
    END IF;

    -- Count, adult and mandate rules: trg_validate_joint_mandate (0242) fires on this INSERT.
    INSERT INTO account_holder (account_id, customer_id, holder_type)
    VALUES (p_account_id, p_customer_id, 'JOINT')
    RETURNING account_holder_id INTO p_account_holder_id;

    SELECT count(*)::INT INTO p_holder_count FROM account_holder WHERE account_id = p_account_id;
END;
$sp$;

COMMENT ON PROCEDURE sp_add_account_holder(UUID, UUID, UUID) IS
    'Adds one JOINT holder to an ACTIVE account: locks the account, requires an active customer with a verified document; the 0242 trigger enforces count/adult rules and syncs an ALL_HOLDERS mandate. Caller owns the transaction.';

COMMIT;
