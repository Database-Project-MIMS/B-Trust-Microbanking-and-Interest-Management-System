CREATE OR REPLACE PROCEDURE sp_write_rejection_audit(
    p_account_id uuid,
    p_user_id uuid,
    p_reason varchar
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (p_user_id, 'USER', 'account', p_account_id, 'WITHDRAWAL_REJECTED',
            jsonb_build_object('reason', p_reason));
END;
$$;

CREATE OR REPLACE PROCEDURE sp_post_withdrawal(
    p_account_id uuid,
    p_amount numeric(15,2),
    p_channel_id uuid,
    p_initiated_by_user_id uuid,
    p_requesting_customer_id uuid,
    p_idempotency_key varchar,
    p_narration varchar,
    OUT p_transaction_id uuid,
    OUT p_reference_number varchar,
    OUT p_balance_after numeric(15,2),
    OUT p_posted_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance numeric(15,2);
    v_status  varchar(20);
    v_daily_total numeric(15,2);
    v_single_limit numeric(15,2);
    v_daily_limit numeric(15,2);
    v_resulting_balance numeric(15,2);
    v_start time;
    v_end time;
    v_now time := (now() AT TIME ZONE 'Asia/Colombo')::time;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT transaction_id, reference_number, balance_after, transaction_date
        INTO p_transaction_id, p_reference_number, p_balance_after, p_posted_at
        FROM transaction WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN RETURN; END IF;
    END IF;

    SELECT current_balance, status INTO v_balance, v_status
    FROM account WHERE account_id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'ACCOUNT_NOT_ACTIVE');
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    SELECT param_value::time INTO v_start FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START';
    SELECT param_value::time INTO v_end FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END';
    IF v_now < v_start OR v_now > v_end THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'OUTSIDE_BUSINESS_HOURS');
        RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS' USING ERRCODE = 'P0001';
    END IF;

    IF NOT fn_check_withdrawal_mandate(p_account_id, ARRAY[p_requesting_customer_id]) THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'MANDATE_NOT_SATISFIED');
        RAISE EXCEPTION 'MANDATE_NOT_SATISFIED' USING ERRCODE = 'P0001';
    END IF;

    SELECT param_value::numeric INTO v_single_limit FROM system_parameter WHERE param_key = 'SINGLE_WITHDRAWAL_LIMIT';
    SELECT param_value::numeric INTO v_daily_limit FROM system_parameter WHERE param_key = 'DAILY_WITHDRAWAL_LIMIT';

    IF p_amount > v_single_limit THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'LIMIT_EXCEEDED');
        RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM transaction
    WHERE account_id = p_account_id
      AND transaction_type = 'WITHDRAWAL'
      AND transaction_date::date = CURRENT_DATE;

    IF v_daily_total + p_amount > v_daily_limit THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'LIMIT_EXCEEDED');
        RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

    IF p_amount > v_balance THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'INSUFFICIENT_FUNDS');
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
    END IF;

    v_resulting_balance := v_balance - p_amount;

    IF NOT fn_check_plan_minimum(p_account_id, v_resulting_balance) THEN
        PERFORM sp_write_rejection_audit(p_account_id, p_initiated_by_user_id, 'BELOW_MINIMUM_BALANCE');
        RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE = 'P0001';
    END IF;

    p_reference_number := fn_next_transaction_reference();
    p_balance_after := v_resulting_balance;
    p_posted_at := now();

    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        idempotency_key, balance_after
    ) VALUES (
        p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'WITHDRAWAL', p_amount, p_posted_at, p_narration,
        p_idempotency_key, p_balance_after
    ) RETURNING transaction_id INTO p_transaction_id;

    UPDATE account SET current_balance = p_balance_after, updated_at = now()
    WHERE account_id = p_account_id;

    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (p_initiated_by_user_id, 'USER', 'transaction', p_transaction_id, 'WITHDRAWAL',
            jsonb_build_object('amount', p_amount, 'balance_after', p_balance_after));
END;
$$;
