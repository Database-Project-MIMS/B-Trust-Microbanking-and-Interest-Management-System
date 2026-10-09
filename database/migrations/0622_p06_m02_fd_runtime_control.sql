-- G-26, ADR-0026. Complete existing M5 contracts without editing merged SQL.
BEGIN;

CREATE FUNCTION fn_fd_control_actor_is_current() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_user u JOIN role r ON r.role_id=u.role_id
    WHERE u.user_id=fn_rls_user_id() AND u.status='ACTIVE' AND r.status='ACTIVE'
      AND r.role_name=fn_rls_role()
      AND (r.role_name IN ('ADMIN','CENTRAL_OPS')
        OR (r.role_name='SYSTEM' AND u.username='system'))
  )
$$;
REVOKE ALL ON FUNCTION fn_fd_control_actor_is_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_fd_control_actor_is_current() TO mims_app;

-- The old customer listing remains role-restricted in its view and controller.
CREATE FUNCTION fn_install_fd_runtime_control() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  ALTER POLICY fixed_deposit_customer_listing_actor_guard ON fixed_deposit
  USING (fn_customer_fd_actor_is_current() OR fn_fd_control_actor_is_current());
END;
$$;
REVOKE ALL ON FUNCTION fn_install_fd_runtime_control() FROM PUBLIC,mims_app;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='fixed_deposit'::regclass
    AND polname='fixed_deposit_customer_listing_actor_guard') THEN
    PERFORM fn_install_fd_runtime_control();
  END IF;
END $$;
CREATE POLICY fixed_deposit_control_select ON fixed_deposit FOR SELECT TO mims_app
USING (fn_fd_control_actor_is_current());
CREATE POLICY fixed_deposit_insert_scope ON fixed_deposit FOR INSERT TO mims_app
WITH CHECK ((fn_fd_control_actor_is_current() OR
  (fn_customer_fd_actor_is_current() AND fn_rls_role() IN ('AGENT','BRANCH_MANAGER')))
  AND EXISTS (SELECT 1 FROM account a WHERE a.account_id=fixed_deposit.account_id));
CREATE POLICY fixed_deposit_update_control ON fixed_deposit FOR UPDATE TO mims_app
USING (fn_fd_control_actor_is_current()) WITH CHECK (fn_fd_control_actor_is_current());
GRANT SELECT,INSERT ON fixed_deposit TO mims_app;
GRANT UPDATE(next_interest_date,status,updated_at) ON fixed_deposit TO mims_app;

-- Authenticated scheduled worker only; role text alone never grants bank-wide access.
CREATE POLICY account_interest_worker_select ON account FOR SELECT TO mims_app
USING (fn_rls_role()='SYSTEM' AND fn_fd_control_actor_is_current());
CREATE POLICY account_interest_worker_update ON account FOR UPDATE TO mims_app
USING (fn_rls_role()='SYSTEM' AND fn_fd_control_actor_is_current())
WITH CHECK (fn_rls_role()='SYSTEM' AND fn_fd_control_actor_is_current());
CREATE POLICY transaction_interest_worker_insert ON transaction FOR INSERT TO mims_app
WITH CHECK (fn_rls_role()='SYSTEM' AND fn_fd_control_actor_is_current()
  AND transaction_type='INTEREST_CREDIT'
  AND EXISTS (SELECT 1 FROM account a WHERE a.account_id=transaction.account_id));

ALTER TABLE interest_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY interest_run_read ON interest_run FOR SELECT TO mims_app
USING (fn_fd_control_actor_is_current() OR fn_rls_role()='AUDITOR');
CREATE POLICY interest_run_insert ON interest_run FOR INSERT TO mims_app
WITH CHECK (fn_fd_control_actor_is_current());
CREATE POLICY interest_run_update ON interest_run FOR UPDATE TO mims_app
USING (fn_fd_control_actor_is_current()) WITH CHECK (fn_fd_control_actor_is_current());
ALTER TABLE interest_payout ENABLE ROW LEVEL SECURITY;
CREATE POLICY interest_payout_read ON interest_payout FOR SELECT TO mims_app
USING (EXISTS (SELECT 1 FROM fixed_deposit fd WHERE fd.fd_id=interest_payout.fd_id));
CREATE POLICY interest_payout_insert ON interest_payout FOR INSERT TO mims_app
WITH CHECK (fn_fd_control_actor_is_current()
  AND EXISTS (SELECT 1 FROM fixed_deposit fd WHERE fd.fd_id=interest_payout.fd_id));
GRANT SELECT,INSERT,UPDATE ON interest_run TO mims_app;
GRANT SELECT,INSERT ON interest_payout TO mims_app;

CREATE TABLE fd_opening_request (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
  idempotency_key varchar(80) NOT NULL,
  payload_hash varchar(64) NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  fd_id uuid NOT NULL REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fd_opening_actor_key UNIQUE(actor_user_id,idempotency_key)
);
ALTER TABLE fd_opening_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY fd_opening_request_read ON fd_opening_request FOR SELECT TO mims_app
USING (actor_user_id=fn_rls_user_id());
CREATE POLICY fd_opening_request_insert ON fd_opening_request FOR INSERT TO mims_app
WITH CHECK (actor_user_id=fn_rls_user_id() AND fn_rls_role() IN ('AGENT','BRANCH_MANAGER','CENTRAL_OPS'));
GRANT SELECT,INSERT ON fd_opening_request TO mims_app;

COMMIT;
