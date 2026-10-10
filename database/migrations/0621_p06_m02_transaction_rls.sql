-- P06-M02-T03 / P06-M01-T03, G-25, ADR-0026. Cross-owner handoff recorded.
-- Derive scope from the account, including legacy ledger rows without attribution.
BEGIN;

ALTER TABLE transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_select_scope ON transaction FOR SELECT TO mims_app
USING (EXISTS (
    SELECT 1 FROM account a WHERE a.account_id = transaction.account_id
));

CREATE POLICY transaction_insert_scope ON transaction FOR INSERT TO mims_app
WITH CHECK (
    COALESCE(fn_rls_role() IN ('ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AGENT','CUSTOMER'), false)
    AND EXISTS (SELECT 1 FROM account a WHERE a.account_id = transaction.account_id)
);

COMMENT ON POLICY transaction_select_scope ON transaction IS
    'Ledger visibility follows account RLS, including customer holder ownership; unset context fails closed.';
COMMENT ON POLICY transaction_insert_scope ON transaction IS
    'A visible account and explicit writing role are required; grants and immutability triggers still apply.';

COMMIT;
