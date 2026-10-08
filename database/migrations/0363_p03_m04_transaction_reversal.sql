-- Migration: 0363_p03_m04_transaction_reversal.sql
-- Task: P03-M04-T04 · Owner: Member 4 (Pramudith)
-- Purpose: Mechanism to reverse posted transactions safely (G-02, DB-CON-04).
-- Architecture Decision: As directed by the spec, we chose the simpler, safer 
-- approach: NO status column is added to transaction, meaning the immutability 
-- trigger is not weakened at all. Reversal status is strictly derived from 
-- the existence of a row in transaction_reversal.

BEGIN;

CREATE TABLE transaction_reversal (
    reversal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_transaction_id uuid NOT NULL UNIQUE,
    reversal_transaction_id uuid NOT NULL UNIQUE,
    reason varchar(255) NOT NULL,
    reversed_by_user_id uuid NOT NULL,
    reversed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_tx_reversal_original FOREIGN KEY (original_transaction_id)
        REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tx_reversal_reversal FOREIGN KEY (reversal_transaction_id)
        REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tx_reversal_user FOREIGN KEY (reversed_by_user_id)
        REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ux_transaction_reversal_original ON transaction_reversal(original_transaction_id);

CREATE OR REPLACE PROCEDURE sp_reverse_transaction(
    IN p_original_transaction_id uuid,
    IN p_reason varchar,
    IN p_reversed_by_user_id uuid,
    INOUT p_reversal_transaction_id uuid DEFAULT NULL,
    INOUT p_reversal_reference varchar DEFAULT NULL,
    INOUT p_balance_after numeric DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_account_id uuid;
    v_current_balance numeric(15,2);
    v_orig_type varchar(50);
    v_orig_amount numeric(15,2);
    v_channel_id uuid;
    v_is_reversed boolean;
BEGIN
    -- Input checks
    IF p_original_transaction_id IS NULL THEN
        RAISE EXCEPTION 'ORIGINAL_TRANSACTION_ID_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_reversed_by_user_id IS NULL THEN
        RAISE EXCEPTION 'USER_ID_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    -- Step 1: Get the account_id from the original transaction
    SELECT account_id, transaction_type, amount, channel_id
    INTO v_account_id, v_orig_type, v_orig_amount, v_channel_id
    FROM transaction
    WHERE transaction_id = p_original_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_orig_type = 'REVERSAL' THEN
        RAISE EXCEPTION 'CANNOT_REVERSE_A_REVERSAL: compensating entries themselves cannot be reversed' USING ERRCODE = 'P0001';
    END IF;

    -- Lock the account
    SELECT current_balance INTO v_current_balance
    FROM account
    WHERE account_id = v_account_id
    FOR UPDATE;

    -- Step 2: Confirm it is not already reversed
    SELECT EXISTS (
        SELECT 1 FROM transaction_reversal 
        WHERE original_transaction_id = p_original_transaction_id
    ) INTO v_is_reversed;

    IF v_is_reversed THEN
        RAISE EXCEPTION 'ALREADY_REVERSED: this transaction has already been reversed' USING ERRCODE = 'P0001';
    END IF;

    -- Step 3: Compute the compensating amount and direction
    IF v_orig_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN
        p_balance_after := v_current_balance - v_orig_amount;
    ELSIF v_orig_type = 'WITHDRAWAL' THEN
        p_balance_after := v_current_balance + v_orig_amount;
    ELSE
        RAISE EXCEPTION 'UNSUPPORTED_TRANSACTION_TYPE' USING ERRCODE = 'P0001';
    END IF;

    -- A basic check for overdraft during reversal
    IF p_balance_after < 0 THEN
        RAISE EXCEPTION 'REVERSAL_WOULD_OVERDRAFT: reversing this deposit creates an overdraft' USING ERRCODE = 'P0001';
    END IF;

    p_reversal_reference := fn_next_transaction_reference();

    -- Step 4: Insert the compensating transaction row
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        balance_after
    ) VALUES (
        v_account_id, p_reversed_by_user_id, v_channel_id, p_reversal_reference,
        'REVERSAL', v_orig_amount, now(), p_reason,
        p_balance_after
    ) RETURNING transaction_id INTO p_reversal_transaction_id;

    -- Step 5: Update the original row's status
    -- Skipped as per architectural decision (derived from transaction_reversal).

    -- Step 6: Insert transaction_reversal
    INSERT INTO transaction_reversal (
        original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id
    ) VALUES (
        p_original_transaction_id, p_reversal_transaction_id, p_reason, p_reversed_by_user_id
    );

    -- Step 7: Update account.current_balance
    UPDATE account
    SET current_balance = p_balance_after, updated_at = now()
    WHERE account_id = v_account_id;

    -- Step 8: Insert audit_log
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (
        p_reversed_by_user_id, 'USER', 'transaction', p_original_transaction_id, 'REVERSED',
        jsonb_build_object(
            'reversal_transaction_id', p_reversal_transaction_id,
            'reason', p_reason,
            'balance_after', p_balance_after
        )
    );

END;
$$;

GRANT EXECUTE ON PROCEDURE sp_reverse_transaction(uuid, varchar, uuid, uuid, varchar, numeric) TO mims_app;
GRANT SELECT, INSERT ON transaction_reversal TO mims_app;

COMMENT ON PROCEDURE sp_reverse_transaction(uuid, varchar, uuid, uuid, varchar, numeric) IS
    'P03-M04-T04: Transaction reversal. Implemented without a status column on transaction to avoid weakening immutability trigger.';
COMMENT ON TABLE transaction_reversal IS
    'Links an original transaction to its compensating REVERSAL row. Uniqueness guarantees one reversal per transaction.';

COMMIT;
