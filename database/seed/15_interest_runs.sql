-- Real routine-generated payouts; empty or partially failed runs are seed failures.
DO $$
DECLARE
    v_cycle date;
    v_run uuid;
    v_before jsonb;
    v_after jsonb;
BEGIN
    FOREACH v_cycle IN ARRAY ARRAY[DATE '2026-02-01', DATE '2026-03-03', DATE '2026-04-02']
    LOOP
      IF NOT EXISTS (SELECT 1 FROM interest_run WHERE cycle_date = v_cycle) THEN
        v_run := sp_run_interest_cycle(v_cycle, '00000000-0000-0000-0401-000000000021');
      ELSE
        SELECT run_id INTO STRICT v_run FROM interest_run WHERE cycle_date = v_cycle;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM interest_run r WHERE r.run_id = v_run
        AND r.status = 'COMPLETED' AND r.fd_count = 10 AND r.exception_count = 0
        AND r.fd_count = (SELECT count(*) FROM interest_payout p WHERE p.interest_run_id = r.run_id)
        AND r.total_interest = (SELECT sum(p.interest_amount) FROM interest_payout p
          WHERE p.interest_run_id = r.run_id)) THEN
        RAISE EXCEPTION 'Seed interest cycle failed or control totals do not match payouts';
      END IF;
    END LOOP;
    SELECT jsonb_build_object('payouts', (SELECT count(*) FROM interest_payout),
      'transactions', (SELECT count(*) FROM transaction),
      'balances', (SELECT sum(current_balance) FROM account),
      'interest', (SELECT sum(interest_amount) FROM interest_payout)) INTO v_before;
    BEGIN
      PERFORM sp_run_interest_cycle(DATE '2026-03-03', '00000000-0000-0000-0401-000000000021');
      RAISE EXCEPTION 'Seed interest re-run unexpectedly succeeded';
    EXCEPTION WHEN unique_violation THEN
      NULL; -- Expected cycle-date uniqueness; nested subtransaction rolls back.
    END;
    SELECT jsonb_build_object('payouts', (SELECT count(*) FROM interest_payout),
      'transactions', (SELECT count(*) FROM transaction),
      'balances', (SELECT sum(current_balance) FROM account),
      'interest', (SELECT sum(interest_amount) FROM interest_payout)) INTO v_after;
    IF v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION 'Seed interest re-run changed financial state';
    END IF;
END $$;
