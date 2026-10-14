-- P06-M04-T03 / ADR-0036: customer transfers replace withdrawal; staff posting methods.
BEGIN;
INSERT INTO transaction_channel(channel_name) VALUES ('CASH'),('CHEQUE');
CREATE FUNCTION fn_transaction_method_channel(p_method text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_channel uuid;
BEGIN
 IF p_method IS NULL OR p_method NOT IN ('CASH','CHEQUE') THEN
  RAISE EXCEPTION 'INVALID_METHOD' USING ERRCODE='P0001'; END IF;
 SELECT channel_id INTO v_channel FROM transaction_channel WHERE channel_name=p_method AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'METHOD_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 RETURN v_channel;
END $$;
REVOKE ALL ON FUNCTION fn_transaction_method_channel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_transaction_method_channel(text) TO mims_app;


CREATE OR REPLACE PROCEDURE sp_post_withdrawal(
    p_account_id uuid, p_amount numeric, p_channel_id uuid,
    p_initiated_by_user_id uuid, p_signer_customer_ids uuid[],
    p_idempotency_key varchar, p_narration varchar,
    OUT p_transaction_id uuid, OUT p_reference_number varchar,
    OUT p_balance_after numeric, OUT p_posted_at timestamptz
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
    v_balance numeric(15,2);
    v_status varchar(20);
    v_account_branch uuid;
    v_role text;
    v_staff_branch uuid;
    v_agent_id uuid;
    v_branch_id uuid;
    v_signers uuid[];
    v_daily_total numeric;
    v_single_limit numeric;
    v_daily_limit numeric;
    v_day_start timestamptz;
    v_day_end timestamptz;
    v_existing record;
    v_replay_signers jsonb;
BEGIN
    IF p_account_id IS NULL OR p_initiated_by_user_id IS NULL THEN
        RAISE EXCEPTION 'WITHDRAWAL_ID_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_amount IS NULL OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
       OR p_amount <= 0 OR p_amount > 9999999999999.99 OR p_amount <> round(p_amount, 2) THEN
        RAISE EXCEPTION 'INVALID_WITHDRAWAL_AMOUNT' USING ERRCODE = 'P0001';
    END IF;
    IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key) = 0 OR length(p_idempotency_key) > 80) THEN
        RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE = 'P0001';
    END IF;
    IF length(p_narration) > 255 THEN
        RAISE EXCEPTION 'INVALID_WITHDRAWAL_NARRATION' USING ERRCODE = 'P0001';
    END IF;

    SELECT r.role_name INTO v_role
    FROM app_user u JOIN role r ON r.role_id = u.role_id
    WHERE u.user_id = p_initiated_by_user_id AND u.status = 'ACTIVE' AND r.status = 'ACTIVE';
    IF v_role IS NULL OR v_role NOT IN ('AGENT', 'BRANCH_MANAGER', 'ADMIN')
       OR fn_rls_user_id() IS DISTINCT FROM p_initiated_by_user_id
       OR fn_rls_role() IS DISTINCT FROM v_role THEN
        RAISE EXCEPTION 'WITHDRAWAL_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    IF v_role IN ('AGENT', 'BRANCH_MANAGER') THEN
        SELECT a.branch_id INTO v_staff_branch
        FROM agent a JOIN branch b ON b.branch_id = a.branch_id
        WHERE a.agent_id = p_initiated_by_user_id AND a.status = 'ACTIVE' AND b.status = 'ACTIVE';
        IF v_staff_branch IS NULL OR fn_rls_branch_id() IS DISTINCT FROM v_staff_branch THEN
            RAISE EXCEPTION 'WITHDRAWAL_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Serialize retries before the account lock; the unique index remains the backstop.
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal:' || p_idempotency_key, 0));
    END IF;
    SELECT current_balance, status, branch_id INTO v_balance, v_status, v_account_branch
    FROM account WHERE account_id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF (v_role IN ('AGENT', 'BRANCH_MANAGER') AND v_staff_branch <> v_account_branch)
       OR (v_role = 'AGENT' AND NOT EXISTS (
           SELECT 1 FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id
           WHERE ah.account_id = p_account_id AND ca.agent_id = p_initiated_by_user_id AND ca.is_active)) THEN
        RAISE EXCEPTION 'WITHDRAWAL_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    SELECT array_agg(DISTINCT signer ORDER BY signer) INTO v_signers
    FROM unnest(p_signer_customer_ids) AS signer;
    -- Staff collect trusted signer evidence; customer withdrawals are denied above.

    IF p_idempotency_key IS NOT NULL THEN
        SELECT transaction_id, account_id, initiated_by_user_id, channel_id, transaction_type,
               amount, narration, reference_number, balance_after, transaction_date
        INTO v_existing FROM transaction WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            SELECT new_values->'signer_customer_ids' INTO v_replay_signers
            FROM audit_log WHERE entity_id = v_existing.transaction_id AND action = 'WITHDRAWAL'
            ORDER BY logged_at, log_id LIMIT 1;
            IF v_existing.transaction_type <> 'WITHDRAWAL'
               OR v_existing.account_id IS DISTINCT FROM p_account_id
               OR v_existing.initiated_by_user_id IS DISTINCT FROM p_initiated_by_user_id
               OR v_existing.channel_id IS DISTINCT FROM p_channel_id
               OR v_existing.amount IS DISTINCT FROM p_amount
               OR v_existing.narration IS DISTINCT FROM p_narration
               OR v_replay_signers IS DISTINCT FROM to_jsonb(v_signers) THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
            END IF;
            p_transaction_id := v_existing.transaction_id;
            p_reference_number := v_existing.reference_number;
            p_balance_after := v_existing.balance_after;
            p_posted_at := v_existing.transaction_date;
            RETURN;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM transaction_channel WHERE channel_id = p_channel_id AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'CHANNEL_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    p_posted_at := clock_timestamp();
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
    IF fn_is_business_hour(p_posted_at) IS NOT TRUE THEN
        RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS' USING ERRCODE = 'P0001';
    END IF;
    IF fn_check_withdrawal_mandate(p_account_id, v_signers) IS NOT TRUE THEN
        RAISE EXCEPTION 'MANDATE_NOT_SATISFIED' USING ERRCODE = 'P0001';
    END IF;

    SELECT param_value::numeric INTO v_single_limit FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT';
    SELECT param_value::numeric INTO v_daily_limit FROM system_parameter WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT';
    IF v_single_limit IS NULL OR v_daily_limit IS NULL
       OR v_single_limit::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_daily_limit::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_single_limit <= 0 OR v_daily_limit <= 0 THEN
        RAISE EXCEPTION 'WITHDRAWAL_CONFIGURATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_day_start := (p_posted_at AT TIME ZONE 'Asia/Colombo')::date::timestamp AT TIME ZONE 'Asia/Colombo';
    v_day_end := (((p_posted_at AT TIME ZONE 'Asia/Colombo')::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo');
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM transaction WHERE account_id = p_account_id AND transaction_type IN ('WITHDRAWAL','TRANSFER_OUT')
      AND transaction_date >= v_day_start AND transaction_date < v_day_end;
    IF p_amount > v_single_limit OR v_daily_total + p_amount > v_daily_limit THEN
        RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
    IF p_amount > v_balance THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
    END IF;
    p_balance_after := v_balance - p_amount;
    IF fn_check_plan_minimum(p_account_id, p_balance_after) IS NOT TRUE THEN
        RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE = 'P0001';
    END IF;

    v_agent_id := CASE WHEN v_role = 'AGENT' THEN p_initiated_by_user_id ELSE NULL END;
    v_branch_id := COALESCE(v_staff_branch, v_account_branch);
    p_reference_number := fn_next_transaction_reference();
    INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration, idempotency_key, balance_after, agent_id, branch_id)
    VALUES (p_account_id, p_initiated_by_user_id, p_channel_id, p_reference_number,
        'WITHDRAWAL', p_amount, p_posted_at, p_narration, p_idempotency_key, p_balance_after, v_agent_id, v_branch_id)
    RETURNING transaction_id INTO p_transaction_id;
    UPDATE account SET current_balance = p_balance_after, updated_at = now() WHERE account_id = p_account_id;
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (p_initiated_by_user_id, 'USER', 'transaction', p_transaction_id, 'WITHDRAWAL',
        jsonb_build_object('account_id', p_account_id, 'amount', p_amount,
            'balance_after', p_balance_after, 'reference_number', p_reference_number,
            'signer_customer_ids', to_jsonb(v_signers)));
END;
$$;



REVOKE ALL ON PROCEDURE sp_try_customer_withdrawal(uuid,numeric,uuid,uuid,uuid[],varchar,varchar) FROM PUBLIC,mims_app;

CREATE FUNCTION fn_post_customer_transfer(p_source uuid,p_destination_number varchar,p_amount numeric,p_actor uuid,
 p_key varchar,p_narration varchar)
RETURNS TABLE(transfer_group_id uuid,debit_id uuid,source_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_role text; v_branch uuid; v_source account%ROWTYPE; v_dest account%ROWTYPE;
 p_destination uuid; v_customer uuid; credit_id uuid; destination_balance numeric;
 v_single numeric;v_daily numeric;v_today timestamptz;v_channel uuid;v_prior record;v_signers uuid[];
BEGIN
 IF p_source IS NULL OR p_destination_number IS NULL OR length(p_destination_number) NOT BETWEEN 1 AND 50 OR p_amount IS NULL
  OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<=0
  OR p_amount>9999999999999.99 OR p_amount<>round(p_amount,2)
  OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{8,80}$' OR length(p_narration)>255 THEN
  RAISE EXCEPTION 'INVALID_TRANSFER' USING ERRCODE='22023';
 END IF;
 SELECT r.role_name,c.customer_id INTO v_role,v_customer FROM app_user u
 JOIN role r ON r.role_id=u.role_id JOIN customer c ON c.app_user_id=u.user_id
 WHERE u.user_id=p_actor AND u.status='ACTIVE' AND r.status='ACTIVE'
 AND r.role_name='CUSTOMER' AND c.status='ACTIVE' FOR SHARE OF u,r,c;
 IF NOT FOUND OR p_actor IS DISTINCT FROM fn_rls_user_id() OR v_role IS DISTINCT FROM fn_rls_role()
 OR fn_rls_branch_id() IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 v_signers:=ARRAY[v_customer];
 SELECT account_id INTO p_destination FROM account WHERE account_number=p_destination_number;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||p_key,0));
 PERFORM 1 FROM account WHERE account_id IN(p_source,p_destination) ORDER BY account_id FOR UPDATE;
 SELECT * INTO v_source FROM account WHERE account_id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM account_holder WHERE account_id=p_source AND customer_id=v_customer FOR SHARE;
 IF NOT FOUND OR p_source=p_destination OR EXISTS(SELECT 1 FROM account_holder
 WHERE account_id=p_destination AND customer_id=v_customer) THEN
 RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_dest FROM account WHERE account_id=p_destination;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 v_branch:=v_source.branch_id;
 SELECT t.*,a.new_values->'signer_customer_ids' AS signers INTO v_prior FROM transaction t
 LEFT JOIN audit_log a ON a.entity_id=t.transaction_id AND a.action='TRANSFER_POSTED' WHERE t.idempotency_key=p_key LIMIT 1;
 IF FOUND THEN
  IF v_prior.transaction_type<>'TRANSFER_OUT' OR v_prior.account_id<>p_source OR v_prior.amount<>p_amount
   OR v_prior.initiated_by_user_id<>p_actor OR v_prior.narration IS DISTINCT FROM p_narration
   OR v_prior.signers IS DISTINCT FROM to_jsonb(v_signers) OR NOT EXISTS(SELECT 1 FROM transaction t
    WHERE t.transfer_group_id=v_prior.transfer_group_id AND t.transaction_type='TRANSFER_IN' AND t.account_id=p_destination) THEN
   RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001'; END IF;
  RETURN QUERY SELECT v_prior.transfer_group_id,v_prior.transaction_id,v_prior.balance_after
   FROM transaction t WHERE t.transfer_group_id=v_prior.transfer_group_id AND t.transaction_type='TRANSFER_IN'; RETURN;
 END IF;
 IF v_source.status<>'ACTIVE' OR v_dest.status<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
 IF fn_is_business_hour(clock_timestamp()) IS NOT TRUE THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS' USING ERRCODE='P0001'; END IF;
 IF fn_check_withdrawal_mandate(p_source,v_signers) IS NOT TRUE THEN RAISE EXCEPTION 'MANDATE_NOT_SATISFIED' USING ERRCODE='P0001'; END IF;
 IF v_source.current_balance<p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE='P0001'; END IF;
 IF fn_check_plan_minimum(p_source,v_source.current_balance-p_amount) IS NOT TRUE THEN RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE='P0001'; END IF;
 SELECT param_value::numeric INTO STRICT v_single FROM system_parameter WHERE param_key='WITHDRAWAL_SINGLE_LIMIT';
 SELECT param_value::numeric INTO STRICT v_daily FROM system_parameter WHERE param_key='WITHDRAWAL_DAILY_LIMIT';
 v_today:=((clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date::timestamp AT TIME ZONE 'Asia/Colombo');
 IF v_single IS NULL OR v_daily IS NULL OR v_single<=0 OR v_daily<=0
  OR v_single::text IN ('NaN','Infinity','-Infinity') OR v_daily::text IN ('NaN','Infinity','-Infinity')
  THEN RAISE EXCEPTION 'INVALID_LIMIT_CONFIGURATION' USING ERRCODE='22023'; END IF;
 IF p_amount>v_single OR p_amount+(SELECT COALESCE(sum(amount),0) FROM transaction WHERE account_id=p_source
  AND transaction_type IN('WITHDRAWAL','TRANSFER_OUT') AND transaction_date>=v_today AND transaction_date<v_today+interval '1 day')>v_daily THEN
  RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE='P0001'; END IF;
 SELECT channel_id INTO STRICT v_channel FROM transaction_channel WHERE channel_name='ONLINE' AND status='ACTIVE';
 transfer_group_id:=gen_random_uuid();source_balance:=v_source.current_balance-p_amount;destination_balance:=v_dest.current_balance+p_amount;
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,
 narration,idempotency_key,balance_after,agent_id,branch_id,transfer_group_id)
 VALUES(p_source,p_actor,v_channel,fn_next_transaction_reference(),'TRANSFER_OUT',p_amount,clock_timestamp(),p_narration,p_key,
 source_balance,NULL,v_branch,transfer_group_id) RETURNING transaction_id INTO debit_id;
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,
 narration,balance_after,agent_id,branch_id,transfer_group_id)
 VALUES(p_destination,p_actor,v_channel,fn_next_transaction_reference(),'TRANSFER_IN',p_amount,clock_timestamp(),p_narration,
 destination_balance,NULL,v_dest.branch_id,transfer_group_id) RETURNING transaction_id INTO credit_id;
 UPDATE account SET current_balance=source_balance WHERE account_id=p_source;
 UPDATE account SET current_balance=destination_balance WHERE account_id=p_destination;
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
 VALUES(p_actor,'USER','transaction',debit_id,'TRANSFER_POSTED',jsonb_build_object('transfer_group_id',transfer_group_id,
 'destination_account_id',p_destination,'amount',p_amount,'signer_customer_ids',v_signers));
 RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION fn_post_customer_transfer(uuid,varchar,numeric,uuid,varchar,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_post_customer_transfer(uuid,varchar,numeric,uuid,varchar,varchar) TO mims_app;
COMMIT;
