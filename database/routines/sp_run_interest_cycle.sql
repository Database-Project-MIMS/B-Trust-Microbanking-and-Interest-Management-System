CREATE OR REPLACE FUNCTION sp_run_interest_cycle(
    p_cycle_date  date,
    p_user_id     uuid DEFAULT NULL  -- NULL for system/worker
) RETURNS uuid AS $$
DECLARE
    v_run_id        uuid;
    v_fd            RECORD;
    v_interest      numeric(15,2);
    v_fd_count      int := 0;
    v_total         numeric(15,2) := 0;
    v_exceptions    int := 0;
    v_txn_id        uuid;
BEGIN
    -- 1. Create the run record (UNIQUE on cycle_date prevents duplicates)
    INSERT INTO interest_run (cycle_date, status, initiated_by)
    VALUES (p_cycle_date, 'RUNNING', p_user_id)
    RETURNING run_id INTO v_run_id;

    -- 2. Find all active FDs due for interest on this cycle date
    FOR v_fd IN
        SELECT fd_id, account_id, principal_amount,
               interest_rate_at_opening, next_interest_date
        FROM fixed_deposit
        WHERE status = 'ACTIVE'
          AND next_interest_date <= p_cycle_date
    LOOP
        BEGIN  -- nested block for per-FD error handling
            -- 3. Calculate interest using the snapshot rate
            v_interest := fn_calculate_fd_interest(
                v_fd.principal_amount,
                v_fd.interest_rate_at_opening
            );

            -- 4. Post the INTEREST_CREDIT through M4's ledger routine (I-5)
            --    This creates the transaction row and updates the balance
            v_txn_id := sp_post_interest_credit(
                v_fd.account_id, v_interest, v_run_id
            );

            -- 5. Record the payout
            INSERT INTO interest_payout (
                fd_id, interest_run_id, transaction_id,
                cycle_date, payout_date, interest_amount
            ) VALUES (
                v_fd.fd_id, v_run_id, v_txn_id,
                p_cycle_date, CURRENT_DATE, v_interest
            );

            -- 6. Advance next_interest_date by 30 days
            UPDATE fixed_deposit
            SET next_interest_date = next_interest_date + interval '30 days',
                updated_at = now()
            WHERE fd_id = v_fd.fd_id;

            v_fd_count := v_fd_count + 1;
            v_total := v_total + v_interest;

        EXCEPTION WHEN OTHERS THEN
            -- Per-FD failure: log it, don't abort the run
            v_exceptions := v_exceptions + 1;
            RAISE WARNING 'Interest payout failed for FD %: %',
                v_fd.fd_id, SQLERRM;
        END;
    END LOOP;

    -- 7. Finalize the run
    UPDATE interest_run
    SET status = 'COMPLETED',
        completed_at = now(),
        fd_count = v_fd_count,
        total_interest = v_total,
        exception_count = v_exceptions
    WHERE run_id = v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;
