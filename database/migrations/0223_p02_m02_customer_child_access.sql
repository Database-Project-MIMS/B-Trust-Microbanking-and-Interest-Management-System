-- P02-M02-T05: scoped runtime access for registration and profile child rows.
-- M2 tables; M1 security coordination: .agent/handoffs/p02-m02-t05-customer-api-ui.md.
-- Uses 0201 helpers; customer RLS is bound later by 0261 in clean rebuild order.
-- No DELETE/UPDATE grants: verification and reassignment are separate operations.
BEGIN;

ALTER TABLE customer_agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_document ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_agent_select_scope ON customer_agent FOR SELECT TO mims_app
USING (EXISTS (SELECT 1 FROM customer c WHERE c.customer_id = customer_agent.customer_id
  AND (fn_rls_is_bank_wide() OR fn_rls_in_branch(c.branch_id)
    OR (fn_rls_role() = 'CUSTOMER' AND c.app_user_id = fn_rls_user_id()))));
CREATE POLICY customer_document_select_scope ON customer_document FOR SELECT TO mims_app
USING (EXISTS (SELECT 1 FROM customer c WHERE c.customer_id = customer_document.customer_id
  AND (fn_rls_is_bank_wide() OR fn_rls_in_branch(c.branch_id)
    OR (fn_rls_role() = 'CUSTOMER' AND c.app_user_id = fn_rls_user_id()))));

CREATE POLICY customer_agent_insert_scope ON customer_agent FOR INSERT TO mims_app
WITH CHECK (EXISTS (SELECT 1 FROM customer c WHERE c.customer_id = customer_agent.customer_id
  AND fn_rls_in_branch(c.branch_id))
  AND (fn_rls_role() = 'BRANCH_MANAGER' OR agent_id = fn_rls_user_id()));
CREATE POLICY customer_document_insert_scope ON customer_document FOR INSERT TO mims_app
WITH CHECK (EXISTS (SELECT 1 FROM customer c WHERE c.customer_id = customer_document.customer_id
  AND fn_rls_in_branch(c.branch_id)) AND verified_by IS NULL AND verified_date IS NULL);

GRANT SELECT, INSERT ON customer_agent, customer_document TO mims_app;
COMMIT;
