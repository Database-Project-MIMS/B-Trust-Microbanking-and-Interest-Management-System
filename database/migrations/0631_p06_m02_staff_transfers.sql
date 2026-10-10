-- ADR-0010/0027: staff-only paired transfers. Caller owns one explicit transaction.
BEGIN;
ALTER TABLE transaction DROP CONSTRAINT transaction_transaction_type_check;
ALTER TABLE transaction ADD CONSTRAINT transaction_transaction_type_check CHECK
 (transaction_type IN ('DEPOSIT','WITHDRAWAL','INTEREST_CREDIT','REVERSAL','TRANSFER_OUT','TRANSFER_IN','FD_MATURITY'));
ALTER TABLE transaction ADD COLUMN transfer_group_id uuid;
CREATE UNIQUE INDEX uq_transfer_leg ON transaction(transfer_group_id,transaction_type) WHERE transfer_group_id IS NOT NULL;
ALTER TABLE transaction ADD CONSTRAINT ck_transfer_group CHECK
 ((transaction_type IN ('TRANSFER_OUT','TRANSFER_IN'))=(transfer_group_id IS NOT NULL));
CREATE FUNCTION fn_validate_transfer_pair() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count int; v_accounts int; v_net numeric;
BEGIN
 IF NEW.transfer_group_id IS NULL THEN RETURN NULL; END IF;
 SELECT count(*),count(DISTINCT account_id),sum(CASE WHEN transaction_type='TRANSFER_OUT' THEN -amount ELSE amount END)
 INTO v_count,v_accounts,v_net FROM transaction WHERE transfer_group_id=NEW.transfer_group_id;
 IF v_count<>2 OR v_accounts<>2 OR v_net<>0 THEN
  RAISE EXCEPTION 'TRANSFER_PAIR_INVALID' USING ERRCODE='23514',CONSTRAINT='ck_transfer_pair';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_transfer_pair AFTER INSERT ON transaction
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.transfer_group_id IS NOT NULL) EXECUTE FUNCTION fn_validate_transfer_pair();
CREATE FUNCTION fn_post_staff_transfer(p_source uuid,p_destination uuid,p_amount numeric,p_actor uuid,
 p_signers uuid[],p_key varchar,p_narration varchar)
RETURNS TABLE(transfer_group_id uuid,debit_id uuid,credit_id uuid,source_balance numeric,destination_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_branch uuid; v_source account%ROWTYPE; v_dest account%ROWTYPE;
 v_single numeric;v_daily numeric;v_today timestamptz;v_channel uuid;v_prior record;v_signers uuid[];
BEGIN
 IF p_source IS NULL OR p_destination IS NULL OR p_source=p_destination OR p_amount IS NULL
  OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<=0
  OR p_amount>9999999999999.99 OR p_amount<>round(p_amount,2)
  OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{8,80}$' OR length(p_narration)>255 THEN
  RAISE EXCEPTION 'INVALID_TRANSFER' USING ERRCODE='22023';
 END IF;
 SELECT r.role_name,a.branch_id INTO v_role,v_branch FROM app_user u JOIN role r ON r.role_id=u.role_id
 JOIN agent a ON a.agent_id=u.user_id JOIN branch b ON b.branch_id=a.branch_id
 WHERE u.user_id=p_actor AND u.status='ACTIVE' AND r.status='ACTIVE' AND a.status='ACTIVE' AND b.status='ACTIVE'
 AND r.role_name IN ('AGENT','BRANCH_MANAGER') FOR SHARE OF u,r,a,b;
 IF NOT FOUND OR p_actor IS DISTINCT FROM fn_rls_user_id() OR v_role IS DISTINCT FROM fn_rls_role()
  OR v_branch IS DISTINCT FROM fn_rls_branch_id() THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT array_agg(DISTINCT signer ORDER BY signer) INTO v_signers FROM unnest(p_signers) signer;
 PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||p_key,0));
 PERFORM 1 FROM account WHERE account_id IN(p_source,p_destination) ORDER BY account_id FOR UPDATE;
 SELECT * INTO v_source FROM account WHERE account_id=p_source AND branch_id=v_branch;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_dest FROM account WHERE account_id=p_destination AND branch_id=v_branch;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 IF v_role='AGENT' AND NOT EXISTS(SELECT 1 FROM account_holder h JOIN customer_agent ca USING(customer_id)
  WHERE h.account_id=p_source AND ca.agent_id=p_actor AND ca.is_active) THEN
  RAISE EXCEPTION 'TRANSFER_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT t.*,a.new_values->'signer_customer_ids' AS signers INTO v_prior FROM transaction t
 LEFT JOIN audit_log a ON a.entity_id=t.transaction_id AND a.action='TRANSFER_POSTED' WHERE t.idempotency_key=p_key LIMIT 1;
 IF FOUND THEN
  IF v_prior.transaction_type<>'TRANSFER_OUT' OR v_prior.account_id<>p_source OR v_prior.amount<>p_amount
   OR v_prior.initiated_by_user_id<>p_actor OR v_prior.narration IS DISTINCT FROM p_narration
   OR v_prior.signers IS DISTINCT FROM to_jsonb(v_signers) OR NOT EXISTS(SELECT 1 FROM transaction t
    WHERE t.transfer_group_id=v_prior.transfer_group_id AND t.transaction_type='TRANSFER_IN' AND t.account_id=p_destination) THEN
   RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001'; END IF;
  RETURN QUERY SELECT v_prior.transfer_group_id,v_prior.transaction_id,t.transaction_id,v_prior.balance_after,t.balance_after
   FROM transaction t WHERE t.transfer_group_id=v_prior.transfer_group_id AND t.transaction_type='TRANSFER_IN'; RETURN;
 END IF;
 IF v_source.status<>'ACTIVE' OR v_dest.status<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
 IF NOT fn_is_business_hour(clock_timestamp()) THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS' USING ERRCODE='P0001'; END IF;
 IF NOT fn_check_withdrawal_mandate(p_source,v_signers) THEN RAISE EXCEPTION 'MANDATE_NOT_SATISFIED' USING ERRCODE='P0001'; END IF;
 IF v_source.current_balance<p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE='P0001'; END IF;
 IF NOT fn_check_plan_minimum(p_source,v_source.current_balance-p_amount) THEN RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE' USING ERRCODE='P0001'; END IF;
 SELECT param_value::numeric INTO STRICT v_single FROM system_parameter WHERE param_key='WITHDRAWAL_SINGLE_LIMIT';
 SELECT param_value::numeric INTO STRICT v_daily FROM system_parameter WHERE param_key='WITHDRAWAL_DAILY_LIMIT';
 v_today:=((clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date::timestamp AT TIME ZONE 'Asia/Colombo');
 IF v_single<=0 OR v_daily<=0 THEN RAISE EXCEPTION 'INVALID_LIMIT_CONFIGURATION' USING ERRCODE='22023'; END IF;
 IF p_amount>v_single OR p_amount+(SELECT COALESCE(sum(amount),0) FROM transaction WHERE account_id=p_source
  AND transaction_type IN('WITHDRAWAL','TRANSFER_OUT') AND transaction_date>=v_today AND transaction_date<v_today+interval '1 day')>v_daily THEN
  RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE='P0001'; END IF;
 SELECT channel_id INTO STRICT v_channel FROM transaction_channel WHERE channel_name='BRANCH_COUNTER' AND status='ACTIVE';
 transfer_group_id:=gen_random_uuid();source_balance:=v_source.current_balance-p_amount;destination_balance:=v_dest.current_balance+p_amount;
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,
 narration,idempotency_key,balance_after,agent_id,branch_id,transfer_group_id)
 VALUES(p_source,p_actor,v_channel,fn_next_transaction_reference(),'TRANSFER_OUT',p_amount,clock_timestamp(),p_narration,p_key,
 source_balance,CASE WHEN v_role='AGENT' THEN p_actor END,v_branch,transfer_group_id) RETURNING transaction_id INTO debit_id;
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,
 narration,balance_after,agent_id,branch_id,transfer_group_id)
 VALUES(p_destination,p_actor,v_channel,fn_next_transaction_reference(),'TRANSFER_IN',p_amount,clock_timestamp(),p_narration,
 destination_balance,CASE WHEN v_role='AGENT' THEN p_actor END,v_branch,transfer_group_id) RETURNING transaction_id INTO credit_id;
 UPDATE account SET current_balance=source_balance WHERE account_id=p_source;
 UPDATE account SET current_balance=destination_balance WHERE account_id=p_destination;
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
 VALUES(p_actor,'USER','transaction',debit_id,'TRANSFER_POSTED',jsonb_build_object('transfer_group_id',transfer_group_id,
 'destination_account_id',p_destination,'amount',p_amount,'signer_customer_ids',v_signers));
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION fn_post_staff_transfer(uuid,uuid,numeric,uuid,uuid[],varchar,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_post_staff_transfer(uuid,uuid,numeric,uuid,uuid[],varchar,varchar) TO mims_app;
COMMIT;
