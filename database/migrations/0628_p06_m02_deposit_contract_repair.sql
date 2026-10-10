-- ADR-0027: repair deposit actor, exact cents, attribution and serialized payload-bound replay.
BEGIN;
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
    v_actor_role text;
    v_staff_branch uuid;
    v_account_branch uuid;
    v_existing record;
BEGIN
    -- 0. Validate input values
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_account_id';
    END IF;

    IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity')
       OR p_amount <= 0 OR p_amount > 9999999999999.99 OR p_amount <> round(p_amount,2) THEN
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

    IF length(p_narration)>255 OR (p_idempotency_key IS NOT NULL AND
       (length(p_idempotency_key)=0 OR length(p_idempotency_key)>80)) THEN
      RAISE EXCEPTION 'INVALID_DEPOSIT_INPUT' USING ERRCODE='P0001';
    END IF;
    SELECT r.role_name INTO v_actor_role FROM app_user u JOIN role r ON r.role_id=u.role_id
      WHERE u.user_id=p_initiated_by_user_id AND u.status='ACTIVE' AND r.status='ACTIVE';
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('ADMIN','AGENT','BRANCH_MANAGER')
      OR fn_rls_user_id() IS DISTINCT FROM p_initiated_by_user_id
      OR fn_rls_role() IS DISTINCT FROM v_actor_role THEN
      RAISE EXCEPTION 'DEPOSIT_NOT_AUTHORIZED' USING ERRCODE='P0001';
    END IF;
    IF v_actor_role IN ('AGENT','BRANCH_MANAGER') THEN
      SELECT a.branch_id INTO v_staff_branch FROM agent a JOIN branch b ON b.branch_id=a.branch_id
        WHERE a.agent_id=p_initiated_by_user_id AND a.status='ACTIVE' AND b.status='ACTIVE';
      IF v_staff_branch IS NULL OR v_staff_branch IS DISTINCT FROM fn_rls_branch_id() THEN
        RAISE EXCEPTION 'DEPOSIT_NOT_AUTHORIZED' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF p_idempotency_key IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('deposit:'||p_idempotency_key,0));
    END IF;
    SELECT current_balance,status,branch_id INTO v_balance,v_status,v_account_branch
      FROM account WHERE account_id=p_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE='P0001',CONSTRAINT='ck_deposit_account_exists';
    END IF;
    IF v_staff_branch IS NOT NULL AND v_staff_branch<>v_account_branch THEN
      RAISE EXCEPTION 'DEPOSIT_NOT_AUTHORIZED' USING ERRCODE='P0001';
    END IF;
    IF p_idempotency_key IS NOT NULL THEN
      SELECT transaction_id,reference_number,balance_after,transaction_date,
        account_id,initiated_by_user_id,channel_id,amount,narration,transaction_type
        INTO v_existing FROM transaction WHERE idempotency_key=p_idempotency_key;
      IF FOUND THEN
        IF v_existing.transaction_type<>'DEPOSIT' OR v_existing.account_id IS DISTINCT FROM p_account_id
          OR v_existing.initiated_by_user_id IS DISTINCT FROM p_initiated_by_user_id
          OR v_existing.channel_id IS DISTINCT FROM p_channel_id OR v_existing.amount IS DISTINCT FROM p_amount
          OR v_existing.narration IS DISTINCT FROM p_narration THEN
          RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001';
        END IF;
        p_transaction_id:=v_existing.transaction_id;
        p_reference_number:=v_existing.reference_number;
        p_balance_after:=v_existing.balance_after;
        p_posted_at:=v_existing.transaction_date;
        RETURN;
      END IF;
    END IF;
    SELECT status INTO v_channel_status FROM transaction_channel WHERE channel_id=p_channel_id;
    IF NOT FOUND OR v_channel_status<>'ACTIVE' THEN
      RAISE EXCEPTION 'CHANNEL_UNAVAILABLE' USING ERRCODE='P0001',CONSTRAINT='ck_deposit_channel_active';
    END IF;

    -- 3. Re-validate inside lock
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE: account is not active'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_account_active';
    END IF;

    -- Business hours check (BR-08)
    IF NOT fn_is_business_hour(clock_timestamp()) THEN
        RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS: deposits can only be processed during business hours'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_deposit_business_hours';
    END IF;

    -- 4. Generate unique reference and compute balance_after
    p_reference_number := fn_next_transaction_reference();
    p_balance_after := v_balance + p_amount;
    p_posted_at := clock_timestamp();

    -- 5. Insert ledger entry (with balance_after, G-14)
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        idempotency_key, balance_after, agent_id, branch_id
    ) VALUES (
        p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'DEPOSIT', p_amount, p_posted_at, p_narration,
        p_idempotency_key, p_balance_after, CASE WHEN v_actor_role='AGENT' THEN p_initiated_by_user_id END, v_account_branch
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

REVOKE ALL ON PROCEDURE sp_post_deposit(uuid,numeric,uuid,uuid,varchar,varchar,uuid,varchar,numeric,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE sp_post_deposit(uuid,numeric,uuid,uuid,varchar,varchar,uuid,varchar,numeric,timestamptz) TO mims_app;
COMMIT;
