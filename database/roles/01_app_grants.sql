-- Grants for Member 5 (Selith) - FD Products
GRANT SELECT, INSERT, UPDATE ON fd_plan TO mims_app;

-- Grants for Member 1 (Identity) - Required to fix the failing auth tests
GRANT SELECT, INSERT, UPDATE ON login_attempt TO mims_app;
GRANT SELECT, INSERT, UPDATE ON app_user TO mims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_session TO mims_app;
GRANT SELECT ON role TO mims_app;

-- Grants for Member 2 (Organisation)
GRANT SELECT, INSERT, UPDATE ON branch TO mims_app;
GRANT SELECT, INSERT, UPDATE ON agent TO mims_app;

-- Grants for Member 3 (Nisith) - Savings Plans
GRANT SELECT, UPDATE ON savings_plan TO mims_app;

-- Grants for Member 3 (Nisith) - Accounts (P02-M03-T01)
GRANT SELECT, INSERT, UPDATE ON account TO mims_app;

-- Grants for Member 3 (Nisith) - Account holders (P02-M03-T02)
GRANT SELECT, INSERT, UPDATE ON account_holder TO mims_app;

-- Grants for Member 3 (Nisith) - Joint mandate (P02-M03-T03). No DELETE.
GRANT SELECT, INSERT, UPDATE ON joint_mandate TO mims_app;

-- Grants for Member 3 (Nisith) - Account numbers (P02-M03-T04). fn_next_account_number runs as the caller.
GRANT USAGE ON SEQUENCE account_number_seq TO mims_app;

-- Grants for Member 3 (Nisith) - Account opening idempotency (P02-M03-T05). Insert-only.
GRANT SELECT, INSERT ON account_opening_request TO mims_app;

-- Grants for Member 1 (Nadija) - Customer (P02-M01-T01). No DELETE; rows limited by RLS (0201).
GRANT SELECT, INSERT, UPDATE ON customer TO mims_app;

-- Grants for Member 1 (Nadija) - Parameters & Audit
GRANT SELECT, INSERT, UPDATE ON system_parameter TO mims_app;
GRANT SELECT, INSERT         ON business_calendar TO mims_app;
GRANT SELECT, INSERT         ON audit_log TO mims_app;
-- Health reads only the migration inventory after server session/role checks.
GRANT SELECT ON schema_migration TO mims_app;
