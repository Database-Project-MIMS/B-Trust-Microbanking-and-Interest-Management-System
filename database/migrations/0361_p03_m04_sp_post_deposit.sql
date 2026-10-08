-- Migration 0361: Procedure sp_post_deposit & balance_after column (M4)
-- Task: P03-M04-T02 (G-14, FR-DEP-01..05, BR-08, BR-10, BR-I1)
--
-- 1. Add balance_after column to transaction (G-14: ledger running-balance evidence)
-- 2. Backfill existing transaction rows' balance_after if any exist
-- 3. Procedure sp_post_deposit

BEGIN;

-- Add balance_after to transaction (G-14)
ALTER TABLE transaction
    ADD COLUMN balance_after numeric(15,2);

-- In case initial deposits or tests created rows without balance_after, backfill
UPDATE transaction t
SET balance_after = a.current_balance
FROM account a
WHERE t.account_id = a.account_id AND t.balance_after IS NULL;

-- Routine: sp_post_deposit
CREATE OR REPLACE PROCEDURE sp_post_deposit(
    IN    p_account_id           uuid,
    IN    p_amount               numeric,
    IN    p_channel_id           uuid,
    IN    p_initiated_by_user_id uuid,
    IN    p_idempotency_key      varchar,
    IN    p_narration            varchar,
    INOUT p_transaction_id       uuid DEFAULT NULL,
    INOUT p_reference_number     varchar DEFAULT NULL,
    INOUT p_balance_after        numeric DEFAULT NULL,
    INOUT p_posted_at            timestamptz DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance        numeric(15,2);
    v_status         varchar(20);
    v_channel_status varchar(20);
BEGIN
    -- 0. Validate input values
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_account_id';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_DEPOSIT_AMOUNT: deposit amount must be greater than zero'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_amount_positive';
    END IF;

    IF p_initiated_by_user_id IS NULL THEN
        RAISE EXCEPTION 'USER_ID_REQUIRED'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_user_id';
    END IF;

    IF p_channel_id IS NULL THEN
        RAISE EXCEPTION 'CHANNEL_REQUIRED: a transaction channel is required'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_channel_required';
    END IF;

    -- Verify channel existence and status
    SELECT status INTO v_channel_status
    FROM transaction_channel
    WHERE channel_id = p_channel_id;

    IF NOT FOUND OR v_channel_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'CHANNEL_UNAVAILABLE: transaction channel is inactive or does not exist'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_channel_active';
    END IF;

    -- 1. Idempotency check before acquiring account lock (FR-DEP-04, BR-I1)
    IF p_idempotency_key IS NOT NULL THEN
        SELECT transaction_id, reference_number, balance_after, transaction_date
        INTO p_transaction_id, p_reference_number, p_balance_after, p_posted_at
        FROM transaction
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Idempotent hit: return existing transaction details without re-posting
            RETURN;
        END IF;
    END IF;

    -- 2. Lock the account row before deciding (L11 locking)
    SELECT current_balance, status INTO v_balance, v_status
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_account_exists';
    END IF;

    -- 3. Re-validate inside lock
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE: account is not active'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_account_active';
    END IF;

    -- Business hours check (BR-08)
    IF NOT fn_is_business_hour(now()) THEN
        RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS: deposits can only be processed during business hours'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_business_hours';
    END IF;

    -- 4. Generate unique reference and compute balance_after
    p_reference_number := fn_next_transaction_reference();
    p_balance_after := v_balance + p_amount;
    p_posted_at := now();

    -- 5. Insert ledger entry (with balance_after, G-14)
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        idempotency_key, balance_after
    ) VALUES (
        p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'DEPOSIT', p_amount, p_posted_at, p_narration,
        p_idempotency_key, p_balance_after
    ) RETURNING transaction_id INTO p_transaction_id;

    -- 6. Update account balance atomically in the same transaction
    UPDATE account
    SET current_balance = p_balance_after, updated_at = now()
    WHERE account_id = p_account_id;

    -- 7. Audit log entry
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (
        p_initiated_by_user_id, 'USER', 'transaction', p_transaction_id, 'DEPOSIT',
        jsonb_build_object(
            'account_id', p_account_id,
            'amount', p_amount,
            'reference_number', p_reference_number,
            'balance_after', p_balance_after
        )
    );
END;
$$;

-- Permissions for application role
GRANT EXECUTE ON PROCEDURE sp_post_deposit(uuid, numeric, uuid, uuid, varchar, varchar, uuid, varchar, numeric, timestamptz) TO mims_app;

COMMENT ON PROCEDURE sp_post_deposit(uuid, numeric, uuid, uuid, varchar, varchar, uuid, varchar, numeric, timestamptz) IS
    'P03-M04-T02: Post deposit with pessimistic account row lock, idempotency check, business-hours check, balance_after recording, and audit trail.';

COMMIT;
