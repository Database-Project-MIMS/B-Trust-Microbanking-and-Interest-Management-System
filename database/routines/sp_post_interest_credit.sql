CREATE OR REPLACE FUNCTION sp_post_interest_credit(
    p_account_id uuid,
    p_amount numeric,
    p_run_id uuid
) RETURNS uuid AS $$
DECLARE
    v_txn_id uuid;
    v_sys_user uuid;
    v_sys_channel uuid;
    v_balance numeric(15,2);
    v_ref varchar;
BEGIN
    -- THIS IS A TEMPORARY BYPASS FOR M4's I-5 LEDGER ROUTINE
    -- It fakes a system transaction so Member 5 is not blocked.
    
    SELECT u.user_id INTO v_sys_user FROM app_user u JOIN role r ON u.role_id = r.role_id WHERE r.role_name = 'ADMIN' LIMIT 1;
    SELECT channel_id INTO v_sys_channel FROM transaction_channel WHERE status = 'ACTIVE' LIMIT 1;
    
    v_ref := fn_next_transaction_reference();
    
    SELECT current_balance INTO v_balance FROM account WHERE account_id = p_account_id FOR UPDATE;
    
    INSERT INTO transaction (
        account_id, initiated_by_user_id, channel_id, reference_number,
        transaction_type, amount, narration, balance_after
    ) VALUES (
        p_account_id, v_sys_user, v_sys_channel, v_ref,
        'INTEREST_CREDIT', p_amount, 'Interest Payout Run ' || p_run_id, v_balance + p_amount
    ) RETURNING transaction_id INTO v_txn_id;
    
    UPDATE account 
    SET current_balance = current_balance + p_amount, updated_at = now() 
    WHERE account_id = p_account_id;
    
    RETURN v_txn_id;
END;
$$ LANGUAGE plpgsql;
