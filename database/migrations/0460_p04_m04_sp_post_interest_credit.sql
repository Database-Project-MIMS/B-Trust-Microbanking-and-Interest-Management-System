-- Migration 0460: Procedure sp_post_interest_credit
-- Task: P04-M04-T01

BEGIN;

CREATE OR REPLACE PROCEDURE sp_post_interest_credit(
    IN    p_account_id           uuid,
    IN    p_amount               numeric,
    IN    p_fd_id                uuid,
    IN    p_cycle_date           date,
    INOUT p_transaction_id       uuid DEFAULT NULL,
    INOUT p_reference_number     varchar DEFAULT NULL,
    INOUT p_balance_after        numeric DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance        numeric(15,2);
    v_channel_id     uuid;
    v_system_user_id uuid;
BEGIN
    -- 0. Validate input values
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_interest_account_id';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_INTEREST_AMOUNT: amount must be positive'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_interest_amount_positive';
    END IF;

    -- Lookup the SYSTEM channel
    SELECT channel_id INTO v_channel_id
    FROM transaction_channel
    WHERE channel_name = 'SYSTEM' AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SYSTEM_CHANNEL_NOT_FOUND'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_interest_channel_exists';
    END IF;

    -- Lookup the SYSTEM user
    SELECT user_id INTO v_system_user_id
    FROM app_user
    WHERE username = 'system';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SYSTEM_USER_NOT_FOUND'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_interest_user_exists';
    END IF;

    -- 1. Lock the account row (L11 locking)
    SELECT current_balance INTO v_balance
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_interest_account_exists';
    END IF;

    -- 3. Calculate new balance
    p_balance_after := v_balance + p_amount;

    -- 4. Generate reference number (e.g. INT-TIMESTAMP-FD)
    p_reference_number := 'INT-' || to_char(now() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD-HH24MISSMS');

    -- 5. Insert ledger row
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, balance_after, narration
    )
    VALUES (
        p_account_id, v_system_user_id, v_channel_id, p_reference_number,
        'INTEREST_CREDIT', p_amount, p_balance_after,
        'Interest Credit for cycle ' || p_cycle_date::text
    )
    RETURNING transaction_id INTO p_transaction_id;

    -- 6. Update account balance
    UPDATE account
    SET current_balance = p_balance_after
    WHERE account_id = p_account_id;

    -- 7. Audit log (SYSTEM actor_type)
    INSERT INTO audit_log (
        user_id, actor_type, entity_type, entity_id, action,
        new_values
    )
    VALUES (
        NULL, 'SYSTEM', 'transaction', p_transaction_id, 'INTEREST_CREDIT',
        jsonb_build_object(
            'amount', p_amount,
            'fd_id', p_fd_id,
            'cycle_date', p_cycle_date
        )
    );

END;
$$;

COMMIT;
