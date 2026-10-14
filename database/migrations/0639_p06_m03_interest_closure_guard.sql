BEGIN;
CREATE OR REPLACE FUNCTION fn_account_close_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    -- Serialize with FD inserts (their foreign key takes KEY SHARE on this row). Already held when the
    -- caller is sp_close_account; this makes a direct UPDATE wait for an in-flight FD insert too.
    PERFORM 1 FROM account WHERE account_id = NEW.account_id FOR UPDATE;

    IF NEW.current_balance <> 0 THEN
        RAISE EXCEPTION 'BALANCE_NOT_ZERO: an account can only be closed with a zero balance'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_balance';
    END IF;

    -- SECURITY DEFINER: the existence check must see every FD, not only those the caller's RLS shows.
    IF EXISTS (SELECT 1 FROM fixed_deposit fd WHERE fd.account_id = NEW.account_id AND fd.status = 'ACTIVE') THEN
        RAISE EXCEPTION 'ACTIVE_FD_EXISTS: an account with an active fixed deposit cannot be closed'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_close_account_active_fd';
    END IF;

    IF fn_savings_interest(NEW.account_id,GREATEST(NEW.opened_date,COALESCE(NEW.savings_interest_through,NEW.opened_date)),
      (clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date,(SELECT interest_rate FROM savings_plan WHERE plan_id=NEW.plan_id))>0 THEN
      RAISE EXCEPTION 'UNSETTLED_SAVINGS_INTEREST' USING ERRCODE='P0001',CONSTRAINT='ck_close_interest_settled';
    END IF;
    RETURN NEW;
END;
$fn$;

COMMIT;
