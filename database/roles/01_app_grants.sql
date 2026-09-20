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
