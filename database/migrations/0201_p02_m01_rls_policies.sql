
BEGIN;

CREATE OR REPLACE FUNCTION fn_rls_user_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION fn_rls_branch_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_branch_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION fn_rls_role() RETURNS text
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_user_role', true), '') $$;

-- Bank-wide read access.
CREATE OR REPLACE FUNCTION fn_rls_is_bank_wide() RETURNS boolean
LANGUAGE sql STABLE AS
$$ SELECT COALESCE(fn_rls_role() IN ('ADMIN', 'CENTRAL_OPS', 'AUDITOR'), false) $$;

-- Staff scoped to exactly one branch.
CREATE OR REPLACE FUNCTION fn_rls_in_branch(p_branch uuid) RETURNS boolean
LANGUAGE sql STABLE AS
$$ SELECT COALESCE(
       fn_rls_role() IN ('AGENT', 'BRANCH_MANAGER')
       AND fn_rls_branch_id() IS NOT NULL
       AND p_branch = fn_rls_branch_id(), false) $$;

-- Roles allowed to change rows.
CREATE OR REPLACE FUNCTION fn_rls_can_write(p_branch uuid) RETURNS boolean
LANGUAGE sql STABLE AS
$$ SELECT COALESCE(fn_rls_role() IN ('ADMIN', 'CENTRAL_OPS'), false) OR fn_rls_in_branch(p_branch) $$;

COMMENT ON FUNCTION fn_rls_is_bank_wide() IS
    'True only when the transaction-local role is an explicit bank-wide role; unset is false (fail-closed).';

COMMIT;
