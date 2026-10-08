-- Migration: 0122_p01_m02_organization_audit.sql
-- Task: P01-M02-T03
-- Purpose: Audit branch and agent master-data changes in the same transaction.

BEGIN;

CREATE OR REPLACE FUNCTION fn_audit_master_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_values_safe jsonb;
    new_values_safe jsonb;
    entity_id_text  text;
BEGIN
    old_values_safe := CASE
        WHEN TG_OP = 'INSERT' THEN NULL
        ELSE to_jsonb(OLD) - ARRAY['password_hash', 'nic_passport_no', 'token_hash']
    END;
    new_values_safe := CASE
        WHEN TG_OP = 'DELETE' THEN NULL
        ELSE to_jsonb(NEW) - ARRAY['password_hash', 'nic_passport_no', 'token_hash']
    END;

    entity_id_text := COALESCE(
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
        user_id,
        actor_type,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
    ) VALUES (
        NULL,
        'SYSTEM',
        TG_TABLE_NAME,
        entity_id_text::uuid,
        TG_OP,
        old_values_safe,
        new_values_safe
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_branch
    AFTER INSERT OR UPDATE OR DELETE ON branch
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

CREATE TRIGGER trg_audit_agent
    AFTER INSERT OR UPDATE OR DELETE ON agent
    FOR EACH ROW EXECUTE FUNCTION fn_audit_master_changes();

COMMENT ON FUNCTION fn_audit_master_changes() IS
    'Writes sanitized master-data changes to audit_log in the caller transaction.';

COMMIT;
