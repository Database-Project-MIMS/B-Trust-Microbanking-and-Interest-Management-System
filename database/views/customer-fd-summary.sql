-- Authoritative definition and least-privilege bootstrap are in migration 0420.
-- Clean rebuild: 0480 has now created fixed_deposit. Safe to run repeatedly.
SELECT fn_install_customer_fd_summary();
