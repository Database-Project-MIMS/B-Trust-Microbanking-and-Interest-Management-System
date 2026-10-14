-- P06-M02-T03 / G-27: enforce existing manager-only rule; preserve merged 0363.
BEGIN;
CREATE FUNCTION fn_reversal_actor_is_current() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app_user u JOIN role r ON r.role_id=u.role_id
    JOIN agent a ON a.agent_id=u.user_id JOIN branch b ON b.branch_id=a.branch_id
    WHERE u.user_id=fn_rls_user_id() AND fn_rls_role()='BRANCH_MANAGER'
      AND r.role_name='BRANCH_MANAGER' AND u.status='ACTIVE' AND r.status='ACTIVE'
      AND a.status='ACTIVE' AND b.status='ACTIVE' AND a.branch_id=fn_rls_branch_id());
$$;
REVOKE ALL ON FUNCTION fn_reversal_actor_is_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_reversal_actor_is_current() TO mims_app;
ALTER TABLE transaction_reversal ENABLE ROW LEVEL SECURITY;
CREATE POLICY reversal_read ON transaction_reversal FOR SELECT TO mims_app
USING(EXISTS(SELECT 1 FROM transaction t WHERE t.transaction_id=original_transaction_id));
CREATE POLICY reversal_insert ON transaction_reversal FOR INSERT TO mims_app
WITH CHECK(fn_reversal_actor_is_current() AND reversed_by_user_id=fn_rls_user_id()
 AND EXISTS(SELECT 1 FROM transaction o JOIN transaction c ON c.account_id=o.account_id
   WHERE o.transaction_id=original_transaction_id AND c.transaction_id=reversal_transaction_id
     AND c.transaction_type='REVERSAL' AND c.initiated_by_user_id=fn_rls_user_id()));
CREATE OR REPLACE PROCEDURE sp_reverse_transaction_controlled(
    IN p_original_transaction_id uuid,
    IN p_reason varchar,
    IN p_reversed_by_user_id uuid,
    IN p_idempotency_key varchar,
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
    v_replay record;
BEGIN
    IF NOT COALESCE(fn_reversal_actor_is_current(),false)
       OR p_reversed_by_user_id IS DISTINCT FROM fn_rls_user_id() THEN
      RAISE EXCEPTION 'REVERSAL_ACTOR_DENIED' USING ERRCODE='42501';
    END IF;
    IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key)<8 OR length(p_idempotency_key)>80) THEN
      RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE='P0001';
    END IF;
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
    FROM transaction t
    WHERE t.transaction_id=p_original_transaction_id
      AND EXISTS(SELECT 1 FROM account a WHERE a.account_id=t.account_id
        AND a.branch_id=fn_rls_branch_id());

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

    IF p_idempotency_key IS NOT NULL THEN
      SELECT r.original_transaction_id,r.reason,r.reversed_by_user_id,
        t.transaction_id,t.reference_number,t.balance_after INTO v_replay
      FROM transaction t JOIN transaction_reversal r ON r.reversal_transaction_id=t.transaction_id
      WHERE t.idempotency_key=p_idempotency_key;
      IF FOUND THEN
        IF v_replay.original_transaction_id<>p_original_transaction_id
          OR v_replay.reason<>p_reason OR v_replay.reversed_by_user_id<>p_reversed_by_user_id THEN
          RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001';
        END IF;
        p_reversal_transaction_id:=v_replay.transaction_id;
        p_reversal_reference:=v_replay.reference_number;
        p_balance_after:=v_replay.balance_after;
        RETURN;
      END IF;
    END IF;
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
        balance_after, idempotency_key
    ) VALUES (
        v_account_id, p_reversed_by_user_id, v_channel_id, p_reversal_reference,
        'REVERSAL', v_orig_amount, now(), p_reason,
        p_balance_after, p_idempotency_key
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

CREATE OR REPLACE PROCEDURE sp_reverse_transaction(
 IN p_original_transaction_id uuid, IN p_reason varchar, IN p_reversed_by_user_id uuid,
 INOUT p_reversal_transaction_id uuid DEFAULT NULL,
 INOUT p_reversal_reference varchar DEFAULT NULL, INOUT p_balance_after numeric DEFAULT NULL)
LANGUAGE plpgsql AS $$ BEGIN
 CALL sp_reverse_transaction_controlled(p_original_transaction_id,p_reason,p_reversed_by_user_id,
   NULL,p_reversal_transaction_id,p_reversal_reference,p_balance_after);
END $$;
REVOKE ALL ON PROCEDURE sp_reverse_transaction(uuid,varchar,uuid,uuid,varchar,numeric) FROM PUBLIC;
REVOKE ALL ON PROCEDURE sp_reverse_transaction_controlled(uuid,varchar,uuid,varchar,uuid,varchar,numeric) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE sp_reverse_transaction_controlled(uuid,varchar,uuid,varchar,uuid,varchar,numeric) TO mims_app;
COMMIT;
