-- P04-M02-T01 / ADR-0018: read-only customer/FD relation and baseline runtime scope.
-- 0420 precedes M5's 0480 on clean builds. Bind after all migrations in the views
-- stage; bind immediately on existing FD schemas. Do not renumber M5's migration.
BEGIN;

CREATE FUNCTION fn_install_customer_fd_summary() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $installer$
BEGIN
    ALTER TABLE fixed_deposit ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'fixed_deposit'::regclass
                   AND polname = 'fixed_deposit_customer_listing_select') THEN
        CREATE POLICY fixed_deposit_customer_listing_select ON fixed_deposit
        FOR SELECT TO mims_app USING (
            fn_rls_role() IN ('AGENT', 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'CUSTOMER')
            AND EXISTS (
                SELECT 1 FROM account a
                JOIN account_holder ah ON ah.account_id = a.account_id
                JOIN customer c ON c.customer_id = ah.customer_id
                WHERE a.account_id = fixed_deposit.account_id AND (
                    fn_rls_role() IN ('CENTRAL_OPS', 'AUDITOR')
                    OR (fn_rls_in_branch(a.branch_id) AND fn_rls_in_branch(c.branch_id)
                        AND (fn_rls_role() = 'BRANCH_MANAGER' OR EXISTS (
                            SELECT 1 FROM customer_agent ca
                            WHERE ca.customer_id = c.customer_id
                              AND ca.agent_id = fn_rls_user_id() AND ca.is_active)))
                    OR (fn_rls_role() = 'CUSTOMER' AND c.app_user_id = fn_rls_user_id())
                )
            )
        );
    END IF;

    CREATE OR REPLACE VIEW vw_customer_fd_summary
    WITH (security_invoker = true, security_barrier = true) AS
    SELECT c.customer_id, c.branch_id AS customer_branch_id, c.full_name,
           a.account_id, a.account_number, a.branch_id AS account_branch_id,
           fd.fd_id, fd.fd_plan_id, fp.plan_name, fd.principal_amount,
           fd.interest_rate_at_opening, fd.start_date, fd.maturity_date,
           fd.next_interest_date, fd.status
    FROM customer c
    JOIN account_holder ah ON ah.customer_id = c.customer_id
    JOIN account a ON a.account_id = ah.account_id
    JOIN fixed_deposit fd ON fd.account_id = a.account_id
    JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
    WHERE fn_rls_role() IN ('CENTRAL_OPS', 'AUDITOR')
       OR (fn_rls_in_branch(c.branch_id) AND fn_rls_in_branch(a.branch_id)
           AND (fn_rls_role() = 'BRANCH_MANAGER' OR EXISTS (
               SELECT 1 FROM customer_agent ca WHERE ca.customer_id = c.customer_id
                 AND ca.agent_id = fn_rls_user_id() AND ca.is_active)))
       OR (fn_rls_role() = 'CUSTOMER' AND c.app_user_id = fn_rls_user_id());

    GRANT SELECT (fd_id, account_id, fd_plan_id, principal_amount,
                  interest_rate_at_opening, start_date, maturity_date,
                  next_interest_date, status) ON fixed_deposit TO mims_app;
    GRANT SELECT ON vw_customer_fd_summary TO mims_app;
    COMMENT ON VIEW vw_customer_fd_summary IS
        'P04-M02-T01: caller-RLS customer/account-holder/FD relation; exact snapshot values, all statuses, no other-holder disclosure.';
END;
$installer$;

REVOKE ALL ON FUNCTION fn_install_customer_fd_summary() FROM PUBLIC, mims_app;
COMMENT ON FUNCTION fn_install_customer_fd_summary() IS
    'Owner-only bootstrap: 0420 runs before 0480; the rebuild views stage binds the FD view after all table migrations. SECURITY INVOKER, idempotent.';
DO $bind$
BEGIN
    IF to_regclass('public.fixed_deposit') IS NOT NULL THEN
        PERFORM fn_install_customer_fd_summary();
    END IF;
END;
$bind$;
COMMIT;
