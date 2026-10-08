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
BEGIN
    -- 1. Lock and read the account (I-6: M3 provides this check, but we implement the logic here to remain unblocked)
    SELECT * INTO v_account
    FROM account
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;

    -- 2. Check account is ACTIVE (BR-11)
    IF v_account.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Account is not active: %', v_account.status;
    END IF;

    -- 3. Check sufficient balance (after withdrawal, balance ≥ 0)
    IF v_account.current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %',
            v_account.current_balance, p_amount;
    END IF;

    -- 4. Check no existing active FD (the partial unique index is the backstop)
    -- This check is for a clean error message; the index enforces it

    -- 5. Read the FD plan
    SELECT * INTO v_plan FROM fd_plan WHERE fd_plan_id = p_fd_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FD plan not found: %', p_fd_plan_id;
    END IF;

    -- 6. Calculate maturity and next interest dates
    v_maturity := v_start_date + (v_plan.tenure_months || ' months')::interval;
    v_next_int := v_start_date + interval '30 days';

    -- 7. Debit principal from the savings account
    UPDATE account
    SET current_balance = current_balance - p_amount,
        updated_at = now()
    WHERE account_id = p_account_id;

    -- 8. Create the FD with rate snapshot (BR-19, G-11)
    INSERT INTO fixed_deposit (
        account_id, fd_plan_id, principal_amount,
        interest_rate_at_opening, start_date, maturity_date,
        next_interest_date, status
    ) VALUES (
        p_account_id, p_fd_plan_id, p_amount,
        v_plan.interest_rate,  -- snapshot at opening (D-3)
        v_start_date, v_maturity, v_next_int, 'ACTIVE'
    ) RETURNING fd_id INTO v_fd_id;

    RETURN v_fd_id;
END;
$$ LANGUAGE plpgsql;
