-- P04-M02-T02 / ADR-0019: validate FD read context against current stored identity.
-- 0421 precedes 0480; the existing M2 views stage binds after all table migrations.
BEGIN;

CREATE FUNCTION fn_customer_fd_actor_is_current() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $guard$
    SELECT EXISTS (
        SELECT 1 FROM app_user u JOIN role r ON r.role_id = u.role_id
        LEFT JOIN agent a ON a.agent_id = u.user_id AND a.status = 'ACTIVE'
        LEFT JOIN branch b ON b.branch_id = a.branch_id AND b.status = 'ACTIVE'
        WHERE u.user_id = fn_rls_user_id() AND u.status = 'ACTIVE'
          AND r.status = 'ACTIVE' AND r.role_name = fn_rls_role()
          AND r.role_name IN ('AGENT', 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'CUSTOMER')
          AND (r.role_name NOT IN ('AGENT', 'BRANCH_MANAGER')
               OR (b.branch_id IS NOT NULL AND b.branch_id = fn_rls_branch_id()))
    );
$guard$;
REVOKE ALL ON FUNCTION fn_customer_fd_actor_is_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_customer_fd_actor_is_current() TO mims_app;
COMMENT ON FUNCTION fn_customer_fd_actor_is_current() IS
    'P04-M02-T02: fail-closed SELECT context consistency; active stored role/user and current active staff branch. Caller authenticates sessions.';

CREATE FUNCTION fn_install_customer_fd_scope_guard() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $installer$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'fixed_deposit'::regclass
                   AND polname = 'fixed_deposit_customer_listing_actor_guard') THEN
        CREATE POLICY fixed_deposit_customer_listing_actor_guard ON fixed_deposit
        AS RESTRICTIVE FOR SELECT TO mims_app
        USING ((SELECT fn_customer_fd_actor_is_current()));
    END IF;
END;
$installer$;
REVOKE ALL ON FUNCTION fn_install_customer_fd_scope_guard() FROM PUBLIC, mims_app;
COMMENT ON FUNCTION fn_install_customer_fd_scope_guard() IS
    'Owner-only idempotent 0421 late binder; ANDs stored identity validation with existing FD SELECT scope. No write policy or grant.';

DO $bind$
BEGIN
    IF to_regclass('public.fixed_deposit') IS NOT NULL THEN
        PERFORM fn_install_customer_fd_scope_guard();
    END IF;
END;
$bind$;
COMMIT;
