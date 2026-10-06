-- Migration: 0200_p02_m01_audit_coverage.sql
-- Task: P02-M01-T02 · Owner: Member 1 (Nadija)
-- Purpose: Audit/masking FUNCTIONS for customer, account and account_holder coverage.
--          Trigger binding lives in 0261_p02_m01_rls_audit_bind.sql because customer (0220)
--          and account (0240) do not exist yet when this migration runs.
--          NIC/passport and e-mail are MASKED in audit old/new values (NFR-PRIV).
-- Concepts: L11 triggers, L05 integrity, audit trail (BR-audit).
--
-- Agent/branch/user behaviour from 0122 is preserved: password_hash, token_hash and agent
-- nic_passport_no stay removed. Customer nic_passport_no is masked (last 4 chars kept) and
-- email is masked (first char kept) so audit rows remain useful but not disclosing.

BEGIN;

CREATE OR REPLACE FUNCTION fn_mask_audit_values(p_table text, p_row jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_row IS NULL THEN NULL
        ELSE
            (
                -- Never store secrets, anywhere.
                (p_row - ARRAY['password_hash', 'token_hash'])
                -- Agent NIC stays fully removed (existing contract, 0122).
                - CASE WHEN p_table = 'agent' THEN ARRAY['nic_passport_no'] ELSE ARRAY[]::text[] END
            )
            -- Customer NIC/passport: keep only the last four characters.
            || CASE
                WHEN p_table = 'customer' AND p_row ? 'nic_passport_no'
                    THEN jsonb_build_object(
                        'nic_passport_no',
                        '****' || right(p_row ->> 'nic_passport_no', 4))
                ELSE '{}'::jsonb
            END
            -- Customer e-mail: keep only the first character.
            || CASE
                WHEN p_table = 'customer' AND p_row ? 'email'
                    THEN jsonb_build_object(
                        'email',
                        left(p_row ->> 'email', 1) || '***@***')
                ELSE '{}'::jsonb
            END
    END;
$$;

COMMENT ON FUNCTION fn_mask_audit_values(text, jsonb) IS
    'Removes secrets and masks customer NIC/passport and e-mail before values enter audit_log.';

CREATE OR REPLACE FUNCTION fn_audit_master_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_values_safe jsonb;
    new_values_safe jsonb;
    raw_old         jsonb;
    raw_new         jsonb;
    entity_id_text  text;
BEGIN
    raw_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    raw_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    old_values_safe := fn_mask_audit_values(TG_TABLE_NAME, raw_old);
    new_values_safe := fn_mask_audit_values(TG_TABLE_NAME, raw_new);

    -- Table-specific identifier first so child tables never log a parent's id as their own.
    entity_id_text := COALESCE(
        CASE TG_TABLE_NAME
            WHEN 'customer' THEN COALESCE(raw_new ->> 'customer_id', raw_old ->> 'customer_id')
            WHEN 'account'  THEN COALESCE(raw_new ->> 'account_id',  raw_old ->> 'account_id')
            WHEN 'account_holder' THEN COALESCE(
                raw_new ->> 'holder_id', raw_old ->> 'holder_id',
                raw_new ->> 'account_holder_id', raw_old ->> 'account_holder_id')
            ELSE NULL
        END,
        new_values_safe ->> 'agent_id',
        new_values_safe ->> 'branch_id',
        new_values_safe ->> 'user_id',
        new_values_safe ->> 'role_id',
        new_values_safe ->> 'param_id',
        old_values_safe ->> 'agent_id',
        old_values_safe ->> 'branch_id',
        old_values_safe ->> 'user_id',
        old_values_safe ->> 'role_id',
        old_values_safe ->> 'param_id'
    );

    INSERT INTO audit_log (
        user_id, actor_type, entity_type, entity_id, action, old_values, new_values
    ) VALUES (
        -- Transaction-local actor supplied by the service layer (lib/db/rls-context); NULL = SYSTEM.
        NULLIF(current_setting('app.current_user_id', true), '')::uuid,
        CASE WHEN NULLIF(current_setting('app.current_user_id', true), '') IS NULL
             THEN 'SYSTEM' ELSE 'USER' END,
        TG_TABLE_NAME,
        entity_id_text::uuid,
        TG_OP,
        old_values_safe,
        new_values_safe
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_audit_master_changes() IS
    'Writes sanitized/masked master-data changes to audit_log in the caller transaction.';

COMMIT;
