
BEGIN;

-- ── Audit triggers (T02) ─────────────────────────────────────────────────────
CREATE TRIGGER trg_audit_customer
    AFTER INSERT OR UPDATE ON customer
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

CREATE TRIGGER trg_audit_account
    AFTER INSERT OR UPDATE ON account
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();
DO $$
BEGIN
    IF to_regclass('public.account_holder') IS NOT NULL THEN
        EXECUTE 'CREATE TRIGGER trg_audit_account_holder
                 AFTER INSERT OR UPDATE OR DELETE ON account_holder
                 FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes()';
    END IF;
END;
$$;

-- ── RLS: customer (T01) ──────────────────────────────────────────────────────
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_select_scope ON customer FOR SELECT
    USING (
        fn_rls_is_bank_wide()
        OR fn_rls_in_branch(branch_id)
        -- A CUSTOMER login sees only its own customer row.
        OR (fn_rls_role() = 'CUSTOMER' AND app_user_id IS NOT NULL AND app_user_id = fn_rls_user_id())
    );

CREATE POLICY customer_insert_scope ON customer FOR INSERT
    WITH CHECK (fn_rls_can_write(branch_id));

CREATE POLICY customer_update_scope ON customer FOR UPDATE
    USING (fn_rls_can_write(branch_id))
    WITH CHECK (fn_rls_can_write(branch_id));

-- ── RLS: account (T01) ───────────────────────────────────────────────────────
ALTER TABLE account ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_select_scope ON account FOR SELECT
    USING (fn_rls_is_bank_wide() OR fn_rls_in_branch(branch_id));

CREATE POLICY account_insert_scope ON account FOR INSERT
    WITH CHECK (fn_rls_can_write(branch_id));

CREATE POLICY account_update_scope ON account FOR UPDATE
    USING (fn_rls_can_write(branch_id))
    WITH CHECK (fn_rls_can_write(branch_id));

DO $$
BEGIN
    IF to_regclass('public.account_holder') IS NOT NULL THEN
        EXECUTE $policy$
            CREATE POLICY account_select_customer_own ON account FOR SELECT
            USING (
                fn_rls_role() = 'CUSTOMER'
                AND EXISTS (
                    SELECT 1 FROM account_holder ah
                    JOIN customer c ON c.customer_id = ah.customer_id
                    WHERE ah.account_id = account.account_id
                      AND c.app_user_id = fn_rls_user_id()
                )
            )
        $policy$;
    END IF;
END;
$$;

COMMIT;
