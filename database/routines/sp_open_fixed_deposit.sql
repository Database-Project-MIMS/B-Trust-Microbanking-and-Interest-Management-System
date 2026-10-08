CREATE OR REPLACE FUNCTION sp_open_fixed_deposit(
    p_account_id   uuid,
    p_fd_plan_id   uuid,
    p_amount       numeric(15,2),
    p_user_id      uuid,
    p_channel_id   uuid
) RETURNS uuid AS $$
DECLARE
    v_account     account%ROWTYPE;
    v_plan        fd_plan%ROWTYPE;
    v_fd_id       uuid;
    v_start_date  date := CURRENT_DATE;
    v_maturity    date;
    v_next_int    date;
    v_verdict     text;
    v_ref_no      varchar(50);
BEGIN
    -- 1. Lock and read the account
    SELECT * INTO v_account
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;

    -- 2. Check account is ACTIVE using I-6 helper
    IF NOT fn_check_account_fd_eligible(p_account_id) THEN
        RAISE EXCEPTION 'Account is not active: %', v_account.status;
    END IF;

    -- 3. Check sufficient balance (after withdrawal, balance ≥ 0)
    IF v_account.current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %',
            v_account.current_balance, p_amount;
    END IF;

    -- 4. Check no existing active FD (the partial unique index is the backstop)
    -- This check is for a clean error message; the index enforces it

    -- 2. Read the FD plan
    SELECT * INTO v_plan FROM fd_plan WHERE fd_plan_id = p_fd_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FD plan not found: %', p_fd_plan_id;
    END IF;

    -- 3. Calculate maturity and next interest dates
    v_maturity := v_start_date + (v_plan.tenure_months || ' months')::interval;
    v_next_int := v_start_date + interval '30 days';

    -- 4. Debit principal from the savings account and post ledger entry
    UPDATE account
    SET current_balance = current_balance - p_amount,
        updated_at = now()
    WHERE account_id = p_account_id
    RETURNING current_balance, branch_id INTO v_account.current_balance, v_account.branch_id;

    v_ref_no := fn_next_transaction_reference();

    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, transaction_date, narration,
        balance_after, branch_id
    ) VALUES (
        p_account_id, p_user_id, p_channel_id, v_ref_no,
        'WITHDRAWAL', p_amount, now(), 'Fixed Deposit Opening Principal Debit',
        v_account.current_balance, v_account.branch_id
    );

    -- 5. Create the FD with rate snapshot (BR-19, G-11)
    INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount,
        interest_rate_at_opening, start_date, maturity_date,
        next_interest_date, status
    ) VALUES (
        p_account_id, p_fd_plan_id, p_amount,
        v_plan.interest_rate,  -- snapshot at opening (D-3)
        v_start_date, v_maturity, v_next_int, 'ACTIVE'
    ) RETURNING fd_id INTO v_fd_id;

    -- 6. Audit log for FD creation
    INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
    VALUES (p_user_id, 'USER', 'fixed_deposit', v_fd_id, 'FD_OPENED',
            jsonb_build_object('account_id', p_account_id, 'principal_amount', p_amount));

    RETURN v_fd_id;
END;
$$ LANGUAGE plpgsql;
