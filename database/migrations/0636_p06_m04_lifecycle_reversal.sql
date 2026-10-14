BEGIN;
CREATE FUNCTION fn_reverse_transfer(p_original uuid,p_reason varchar,p_actor uuid,p_key varchar)
RETURNS TABLE(reversal_transaction_id uuid,reference_number varchar,balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_group uuid;v_branch uuid;v_out transaction%ROWTYPE;v_in transaction%ROWTYPE;v_src numeric;v_dest numeric;
 v_out_id uuid;v_in_id uuid;v_out_ref varchar;v_in_ref varchar;v_replay record;
BEGIN
 SELECT a.branch_id INTO v_branch FROM app_user u JOIN role r USING(role_id) JOIN agent a ON a.agent_id=u.user_id
 JOIN branch b ON b.branch_id=a.branch_id WHERE u.user_id=p_actor AND u.status='ACTIVE' AND r.status='ACTIVE'
 AND r.role_name='BRANCH_MANAGER' AND a.status='ACTIVE' AND b.status='ACTIVE' FOR SHARE OF u,r,a,b;
 IF NOT FOUND OR p_actor IS DISTINCT FROM fn_rls_user_id() OR fn_rls_role() IS DISTINCT FROM 'BRANCH_MANAGER'
 OR v_branch IS DISTINCT FROM fn_rls_branch_id() THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501';END IF;
 IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{8,80}$' OR p_reason IS NULL OR trim(p_reason)='' OR length(p_reason)>255 THEN
 RAISE EXCEPTION 'INVALID_REVERSAL' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('reversal:'||p_key,0));
 SELECT t.transfer_group_id INTO v_group FROM transaction t JOIN account a USING(account_id)
 WHERE t.transaction_id=p_original AND a.branch_id=v_branch;
 IF v_group IS NULL THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE='P0001';END IF;
 SELECT * INTO STRICT v_out FROM transaction WHERE transfer_group_id=v_group AND transaction_type='TRANSFER_OUT';
 SELECT * INTO STRICT v_in FROM transaction WHERE transfer_group_id=v_group AND transaction_type='TRANSFER_IN';
 PERFORM 1 FROM account WHERE account_id IN(v_out.account_id,v_in.account_id) AND branch_id=v_branch ORDER BY account_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM account WHERE account_id IN(v_out.account_id,v_in.account_id) AND branch_id<>v_branch) THEN
 RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501';END IF;
 SELECT t.transaction_id,t.reference_number,t.balance_after,r.original_transaction_id,r.reason,r.reversed_by_user_id INTO v_replay
 FROM transaction t JOIN transaction_reversal r ON r.reversal_transaction_id=t.transaction_id WHERE t.idempotency_key=p_key;
 IF FOUND THEN
 IF v_replay.original_transaction_id<>p_original OR v_replay.reason<>p_reason OR v_replay.reversed_by_user_id<>p_actor THEN
 RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001';END IF;
 RETURN QUERY SELECT v_replay.transaction_id,v_replay.reference_number,v_replay.balance_after;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM transaction_reversal WHERE original_transaction_id IN(v_out.transaction_id,v_in.transaction_id)) THEN
 RAISE EXCEPTION 'ALREADY_REVERSED' USING ERRCODE='P0001';END IF;
 IF EXISTS(SELECT 1 FROM account WHERE account_id IN(v_out.account_id,v_in.account_id) AND status<>'ACTIVE') THEN
 RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001';END IF;
 SELECT current_balance+v_out.amount INTO v_src FROM account WHERE account_id=v_out.account_id;
 SELECT current_balance-v_in.amount INTO v_dest FROM account WHERE account_id=v_in.account_id;
 IF v_dest<0 THEN RAISE EXCEPTION 'REVERSAL_WOULD_OVERDRAFT' USING ERRCODE='P0001';END IF;
 v_out_ref:=fn_next_transaction_reference();v_in_ref:=fn_next_transaction_reference();
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,narration,idempotency_key,balance_after,branch_id)
 VALUES(v_out.account_id,p_actor,v_out.channel_id,v_out_ref,'REVERSAL',v_out.amount,clock_timestamp(),p_reason,
 CASE WHEN p_original=v_out.transaction_id THEN p_key END,v_src,v_branch) RETURNING transaction_id INTO v_out_id;
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,narration,idempotency_key,balance_after,branch_id)
 VALUES(v_in.account_id,p_actor,v_in.channel_id,v_in_ref,'REVERSAL',v_in.amount,clock_timestamp(),p_reason,
 CASE WHEN p_original=v_in.transaction_id THEN p_key END,v_dest,v_branch) RETURNING transaction_id INTO v_in_id;
 INSERT INTO transaction_reversal(original_transaction_id,reversal_transaction_id,reason,reversed_by_user_id)
 VALUES(v_out.transaction_id,v_out_id,p_reason,p_actor),(v_in.transaction_id,v_in_id,p_reason,p_actor);
 UPDATE account SET current_balance=v_src WHERE account_id=v_out.account_id;
 UPDATE account SET current_balance=v_dest WHERE account_id=v_in.account_id;
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
 VALUES(p_actor,'USER','transaction',p_original,'TRANSFER_REVERSED',jsonb_build_object('transfer_group_id',v_group,'reason',p_reason,
 'debit_reversal_id',v_out_id,'credit_reversal_id',v_in_id));
 RETURN QUERY SELECT CASE WHEN p_original=v_out.transaction_id THEN v_out_id ELSE v_in_id END,
 CASE WHEN p_original=v_out.transaction_id THEN v_out_ref ELSE v_in_ref END,
 CASE WHEN p_original=v_out.transaction_id THEN v_src ELSE v_dest END;
END $$;
REVOKE ALL ON FUNCTION fn_reverse_transfer(uuid,varchar,uuid,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_reverse_transfer(uuid,varchar,uuid,varchar) TO mims_app;
CREATE FUNCTION fn_validate_transfer_reversal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_group uuid;v_count int;
BEGIN
 SELECT transfer_group_id INTO v_group FROM transaction WHERE transaction_id=NEW.original_transaction_id;
 IF v_group IS NULL THEN RETURN NULL;END IF;
 SELECT count(*) INTO v_count FROM transaction t JOIN transaction_reversal r ON r.original_transaction_id=t.transaction_id WHERE t.transfer_group_id=v_group;
 IF v_count<>2 THEN RAISE EXCEPTION 'TRANSFER_REVERSAL_PAIR_INVALID' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_transfer_reversal_pair AFTER INSERT ON transaction_reversal
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_validate_transfer_reversal();
REVOKE ALL ON FUNCTION fn_validate_transfer_pair(),fn_validate_transfer_reversal() FROM PUBLIC;
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

    IF v_orig_type IN ('TRANSFER_OUT','TRANSFER_IN') THEN
      SELECT reversal_transaction_id,reference_number,balance_after
      INTO p_reversal_transaction_id,p_reversal_reference,p_balance_after
      FROM fn_reverse_transfer(p_original_transaction_id,p_reason,p_reversed_by_user_id,p_idempotency_key);
      RETURN;
    END IF;
    IF EXISTS(SELECT 1 FROM fixed_deposit WHERE funding_transaction_id=p_original_transaction_id)
       OR EXISTS(SELECT 1 FROM interest_payout WHERE transaction_id=p_original_transaction_id)
       OR v_orig_type='FD_MATURITY'
       OR (v_orig_type='WITHDRAWAL' AND EXISTS(SELECT 1 FROM transaction
          WHERE transaction_id=p_original_transaction_id AND narration='Fixed Deposit Opening Principal Debit')) THEN
      RAISE EXCEPTION 'FD_FUNDING_NOT_REVERSIBLE' USING ERRCODE='P0001';
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
    IF EXISTS(SELECT 1 FROM account WHERE account_id=v_account_id AND status<>'ACTIVE') THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001';
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
        'REVERSAL', v_orig_amount, clock_timestamp(), p_reason,
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

COMMIT;
