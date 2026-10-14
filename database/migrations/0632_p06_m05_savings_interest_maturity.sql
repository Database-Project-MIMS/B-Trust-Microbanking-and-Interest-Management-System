-- ADR-0012/0027: account-sourced payouts and atomic principal return.
BEGIN;
ALTER TABLE account ADD COLUMN savings_interest_through date;
ALTER TABLE interest_run ADD COLUMN savings_count int NOT NULL DEFAULT 0 CHECK(savings_count>=0);
ALTER TABLE interest_payout ALTER COLUMN fd_id DROP NOT NULL;
ALTER TABLE interest_payout ADD COLUMN account_id uuid REFERENCES account(account_id) ON DELETE RESTRICT;
ALTER TABLE interest_payout ADD COLUMN source_type text NOT NULL DEFAULT 'FIXED_DEPOSIT';
ALTER TABLE interest_payout ADD COLUMN period_start date;
ALTER TABLE interest_payout ADD COLUMN period_end date;
ALTER TABLE interest_payout ADD COLUMN rate_at_payout interest_rate;
UPDATE interest_payout p SET account_id=f.account_id,rate_at_payout=f.interest_rate_at_opening FROM fixed_deposit f WHERE f.fd_id=p.fd_id;
ALTER TABLE interest_payout ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE interest_payout ADD CONSTRAINT ck_interest_source CHECK
 ((source_type='FIXED_DEPOSIT' AND fd_id IS NOT NULL) OR
  (source_type='SAVINGS' AND fd_id IS NULL AND period_start IS NOT NULL AND period_end>period_start AND rate_at_payout IS NOT NULL));
CREATE UNIQUE INDEX uq_savings_payout_cycle ON interest_payout(account_id,cycle_date) WHERE source_type='SAVINGS';
CREATE FUNCTION fn_payout_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_account uuid;v_rate interest_rate;
BEGIN
 IF NEW.source_type='FIXED_DEPOSIT' THEN
  SELECT account_id,interest_rate_at_opening INTO v_account,v_rate FROM fixed_deposit WHERE fd_id=NEW.fd_id;
  IF NEW.account_id IS NOT NULL AND NEW.account_id<>v_account THEN RAISE EXCEPTION 'PAYOUT_ACCOUNT_MISMATCH' USING ERRCODE='23514'; END IF;
  NEW.account_id:=v_account;NEW.rate_at_payout:=v_rate;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_payout_account BEFORE INSERT ON interest_payout FOR EACH ROW EXECUTE FUNCTION fn_payout_account();
DROP POLICY interest_payout_read ON interest_payout;
CREATE POLICY interest_payout_read ON interest_payout FOR SELECT TO mims_app
 USING(EXISTS(SELECT 1 FROM account a WHERE a.account_id=interest_payout.account_id));
DROP POLICY interest_payout_insert ON interest_payout;
CREATE POLICY interest_payout_insert ON interest_payout FOR INSERT TO mims_app WITH CHECK
 (fn_fd_control_actor_is_current() AND EXISTS(SELECT 1 FROM account a WHERE a.account_id=interest_payout.account_id));

CREATE TABLE fd_maturity_receipt(
 receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),fd_id uuid NOT NULL UNIQUE REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
 transaction_id uuid NOT NULL UNIQUE REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE fd_maturity_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY maturity_read ON fd_maturity_receipt FOR SELECT TO mims_app USING
 (EXISTS(SELECT 1 FROM fixed_deposit f WHERE f.fd_id=fd_maturity_receipt.fd_id));
GRANT SELECT ON fd_maturity_receipt TO mims_app;

CREATE FUNCTION fn_savings_interest(p_account uuid,p_start date,p_end date,p_rate numeric)
RETURNS numeric LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT round(COALESCE(sum(COALESCE((SELECT t.balance_after FROM transaction t
  WHERE t.account_id=p_account AND t.transaction_date<((d.day::date+1)::timestamp AT TIME ZONE 'Asia/Colombo')
  ORDER BY t.ledger_seq DESC LIMIT 1),0)),0)*p_rate/365,2)
 FROM generate_series(p_start::timestamp,(p_end-1)::timestamp,interval '1 day') d(day)
 WHERE p_end>p_start
$$;
CREATE FUNCTION fn_post_savings_interest(p_account uuid,p_run uuid,p_cycle date)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_account account%ROWTYPE;v_start date;v_rate numeric;v_amount numeric;v_tx uuid;v_channel uuid;v_actor uuid;
BEGIN
 IF NOT fn_fd_control_actor_is_current() THEN RAISE EXCEPTION 'INTEREST_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 IF p_cycle>(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date OR NOT EXISTS
  (SELECT 1 FROM interest_run WHERE run_id=p_run AND cycle_date=p_cycle AND status='RUNNING') THEN
  RAISE EXCEPTION 'INVALID_INTEREST_CYCLE' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_account FROM account WHERE account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v_account.status<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
 IF v_account.savings_interest_through>=p_cycle THEN RETURN 0; END IF;
 -- Catch-up starts at the unpaid cursor; a late run must never discard funded days.
 v_start:=GREATEST(v_account.opened_date,COALESCE(v_account.savings_interest_through,v_account.opened_date));
 IF v_start>=p_cycle THEN RETURN 0; END IF;
 SELECT interest_rate INTO v_rate FROM savings_plan WHERE plan_id=v_account.plan_id FOR SHARE;
 v_amount:=fn_savings_interest(p_account,v_start,p_cycle,v_rate);
 IF v_amount>0 THEN
  SELECT channel_id INTO STRICT v_channel FROM transaction_channel WHERE channel_name='SYSTEM' AND status='ACTIVE';
  v_actor:=fn_rls_user_id();
  INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,narration,balance_after,branch_id)
  VALUES(p_account,v_actor,v_channel,'SAV-'||to_char(p_cycle,'YYYYMMDD')||'-'||replace(p_account::text,'-',''),
   'INTEREST_CREDIT',v_amount,clock_timestamp(),'Savings daily balance interest',v_account.current_balance+v_amount,v_account.branch_id)
  RETURNING transaction_id INTO v_tx;
  UPDATE account SET current_balance=current_balance+v_amount WHERE account_id=p_account;
  INSERT INTO interest_payout(account_id,source_type,interest_run_id,transaction_id,cycle_date,payout_date,interest_amount,period_start,period_end,rate_at_payout)
   VALUES(p_account,'SAVINGS',p_run,v_tx,p_cycle,(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date,v_amount,v_start,p_cycle,v_rate);
  UPDATE interest_run SET savings_count=savings_count+1,total_interest=total_interest+v_amount WHERE run_id=p_run;
  INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
   VALUES(v_actor,'USER','transaction',v_tx,'SAVINGS_INTEREST_CREDIT',jsonb_build_object('period_start',v_start,'period_end',p_cycle,'rate',v_rate,'amount',v_amount));
 END IF;
 UPDATE account SET savings_interest_through=p_cycle WHERE account_id=p_account;
 RETURN v_amount;
END $$;
CREATE FUNCTION fn_return_fd_principal(p_fd uuid,p_cycle date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_fd fixed_deposit%ROWTYPE;v_account account%ROWTYPE;v_tx uuid;v_channel uuid;v_actor uuid;
BEGIN
 IF NOT fn_fd_control_actor_is_current() THEN RAISE EXCEPTION 'MATURITY_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 IF p_cycle IS NULL OR p_cycle>(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date THEN RAISE EXCEPTION 'FUTURE_MATURITY' USING ERRCODE='22023'; END IF;
 -- Every FD path takes FD before account; no path takes account then an existing FD row.
 SELECT * INTO v_fd FROM fixed_deposit WHERE fd_id=p_fd FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FD_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 SELECT transaction_id INTO v_tx FROM fd_maturity_receipt WHERE fd_id=p_fd;
 IF FOUND THEN RETURN v_tx; END IF;
 IF v_fd.status<>'ACTIVE' OR v_fd.maturity_date>p_cycle OR v_fd.next_interest_date<=v_fd.maturity_date THEN
  RAISE EXCEPTION 'FD_NOT_READY_FOR_MATURITY' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_account FROM account WHERE account_id=v_fd.account_id FOR UPDATE;
 IF v_account.status<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
 SELECT channel_id INTO STRICT v_channel FROM transaction_channel WHERE channel_name='SYSTEM' AND status='ACTIVE';
 v_actor:=fn_rls_user_id();
 INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,narration,balance_after,branch_id)
 VALUES(v_fd.account_id,v_actor,v_channel,'MAT-'||replace(p_fd::text,'-',''),'FD_MATURITY',v_fd.principal_amount,
  clock_timestamp(),'Fixed deposit maturity principal return',v_account.current_balance+v_fd.principal_amount,v_account.branch_id)
 RETURNING transaction_id INTO v_tx;
 UPDATE account SET current_balance=current_balance+v_fd.principal_amount WHERE account_id=v_fd.account_id;
 INSERT INTO fd_maturity_receipt(fd_id,transaction_id) VALUES(p_fd,v_tx);
 UPDATE fixed_deposit SET status='MATURED' WHERE fd_id=p_fd;
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
  VALUES(v_actor,'USER','fixed_deposit',p_fd,'FD_MATURED',jsonb_build_object('transaction_id',v_tx,'principal',v_fd.principal_amount));
 RETURN v_tx;
END $$;
REVOKE ALL ON FUNCTION fn_post_savings_interest(uuid,uuid,date),fn_return_fd_principal(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_post_savings_interest(uuid,uuid,date),fn_return_fd_principal(uuid,date),fn_savings_interest(uuid,date,date,numeric) TO mims_app;
COMMIT;
