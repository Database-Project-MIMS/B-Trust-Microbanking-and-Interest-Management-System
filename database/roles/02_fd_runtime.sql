-- Legacy routines are rebuilt after migrations; revoke their public runtime entry.
-- Migrations/seed owner retains execution for deterministic SQL fixtures.
REVOKE ALL ON FUNCTION sp_open_fixed_deposit(uuid,uuid,numeric,uuid,uuid) FROM PUBLIC,mims_app;
REVOKE ALL ON FUNCTION sp_run_interest_cycle(date,uuid) FROM PUBLIC,mims_app;
