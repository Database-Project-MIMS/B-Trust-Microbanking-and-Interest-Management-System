-- AC-12: twelve fixed identities, ten active plus two matured historical FDs.
-- Seed import uses fixed master dates/IDs. Every principal is funded and debited
-- through the existing ledger routines in the caller's seed transaction.
DO $$
DECLARE
    v_seed record;
    v_account record;
    v_plan record;
    v_channel uuid := (SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER');
    v_signers uuid[];
    v_agent uuid;
    v_topup numeric;
    v_tx uuid;
    v_ref varchar;
    v_balance numeric;
    v_posted timestamptz;
    v_old_start text := (SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START');
    v_old_end text := (SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END');
    v_old_single text := (SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT');
    v_old_daily text := (SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT');
BEGIN
    UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START';
    UPDATE system_parameter SET param_value = '23:59' WHERE param_key = 'BUSINESS_HOUR_END';
    UPDATE system_parameter SET param_value = '999999999.00'
      WHERE param_key IN ('WITHDRAWAL_SINGLE_LIMIT', 'WITHDRAWAL_DAILY_LIMIT');

    FOR v_seed IN SELECT * FROM (VALUES
      (1, 1, '6 Month FD', 50000.00, 'ACTIVE'),
      (2, 2, '6 Month FD', 75000.00, 'ACTIVE'),
      (3, 3, '6 Month FD', 100000.00, 'ACTIVE'),
      (4, 4, '6 Month FD', 200000.00, 'ACTIVE'),
      (5, 5, '1 Year FD', 100000.00, 'ACTIVE'),
      (6, 6, '1 Year FD', 150000.00, 'ACTIVE'),
      (7, 7, '1 Year FD', 200000.00, 'ACTIVE'),
      (8, 8, '1 Year FD', 300000.00, 'ACTIVE'),
      (9, 9, '1 Year FD', 500000.00, 'ACTIVE'),
      (10, 10, '3 Year FD', 250000.00, 'ACTIVE'),
      (11, 9, '3 Year FD', 500000.00, 'MATURED'),
      (12, 7, '3 Year FD', 1000000.00, 'MATURED')
    ) s(n, account_n, plan_name, principal, status) ORDER BY n
    LOOP
      IF EXISTS (SELECT 1 FROM fixed_deposit
        WHERE fd_id = ('00000000-0000-0000-0901-' || lpad(v_seed.n::text, 12, '0'))::uuid) THEN
        CONTINUE;
      END IF;
      SELECT a.account_id, a.current_balance, a.opened_by_agent_id, a.branch_id, p.min_balance
        INTO STRICT v_account FROM account a JOIN savings_plan p ON p.plan_id = a.plan_id
        WHERE a.account_id = ('00000000-0000-0000-0801-' || lpad(v_seed.account_n::text, 12, '0'))::uuid
        AND a.status = 'ACTIVE' FOR UPDATE OF a;
      SELECT fd_plan_id, tenure_months, interest_rate INTO STRICT v_plan
        FROM fd_plan WHERE plan_name = v_seed.plan_name AND status = 'ACTIVE';
      SELECT array_agg(customer_id ORDER BY customer_id) INTO v_signers
        FROM account_holder WHERE account_id = v_account.account_id;
      SELECT ca.agent_id INTO STRICT v_agent FROM account_holder h
        JOIN customer_agent ca ON ca.customer_id = h.customer_id AND ca.is_active
        JOIN agent a ON a.agent_id = ca.agent_id AND a.status = 'ACTIVE'
        JOIN app_user u ON u.user_id = a.agent_id AND u.status = 'ACTIVE'
        JOIN role r ON r.role_id = u.role_id AND r.role_name = 'AGENT' AND r.status = 'ACTIVE'
        WHERE h.account_id = v_account.account_id AND h.holder_type = 'PRIMARY'
          AND a.branch_id = v_account.branch_id;
      PERFORM set_config('app.current_user_id', v_agent::text, true);
      PERFORM set_config('app.current_user_role', 'AGENT', true);
      PERFORM set_config('app.current_branch_id', v_account.branch_id::text, true);

      v_topup := greatest(v_seed.principal + v_account.min_balance - v_account.current_balance, 0);
      IF v_topup > 0 THEN
        CALL sp_post_deposit(v_account.account_id, v_topup, v_channel, v_agent,
          ('seed-fd-funding-' || v_seed.n::text)::varchar, 'Seed FD funding cash'::varchar,
          v_tx, v_ref, v_balance, v_posted);
      END IF;
      CALL sp_post_withdrawal(v_account.account_id, v_seed.principal, v_channel,
        v_agent, v_signers, ('seed-fd-principal-' || v_seed.n::text)::varchar,
        'Seed FD principal transfer'::varchar, v_tx, v_ref, v_balance, v_posted);
      INSERT INTO fixed_deposit (fd_id, account_id, fd_plan_id, principal_amount,
        interest_rate_at_opening, start_date, maturity_date, next_interest_date,
        status, created_at, updated_at)
      VALUES (('00000000-0000-0000-0901-' || lpad(v_seed.n::text, 12, '0'))::uuid,
        v_account.account_id, v_plan.fd_plan_id, v_seed.principal, v_plan.interest_rate,
        CASE WHEN v_seed.status = 'ACTIVE' THEN DATE '2026-01-02' ELSE DATE '2022-01-02' END,
        (CASE WHEN v_seed.status = 'ACTIVE' THEN DATE '2026-01-02' ELSE DATE '2022-01-02' END
          + make_interval(months => v_plan.tenure_months))::date,
        CASE WHEN v_seed.status = 'ACTIVE' THEN DATE '2026-02-01' ELSE DATE '2025-01-02' END,
        v_seed.status, TIMESTAMPTZ '2026-01-02 08:00:00+05:30', TIMESTAMPTZ '2026-01-02 08:00:00+05:30');
      INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
      VALUES (v_agent, 'USER', 'fixed_deposit',
        ('00000000-0000-0000-0901-' || lpad(v_seed.n::text, 12, '0'))::uuid,
        'FD_OPENED', jsonb_build_object('account_id', v_account.account_id,
          'principal_amount', v_seed.principal, 'seed_import', true));
      -- Historical principal return is a separate credit; never a raw balance change.
      IF v_seed.status = 'MATURED' THEN
        CALL sp_post_deposit(v_account.account_id, v_seed.principal, v_channel,
          v_agent, ('seed-fd-return-' || v_seed.n::text)::varchar,
          'Seed matured FD principal return'::varchar, v_tx, v_ref, v_balance, v_posted);
      END IF;
    END LOOP;
    UPDATE system_parameter SET param_value = v_old_start WHERE param_key = 'BUSINESS_HOUR_START';
    UPDATE system_parameter SET param_value = v_old_end WHERE param_key = 'BUSINESS_HOUR_END';
    UPDATE system_parameter SET param_value = v_old_single WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT';
    UPDATE system_parameter SET param_value = v_old_daily WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT';
END $$;
