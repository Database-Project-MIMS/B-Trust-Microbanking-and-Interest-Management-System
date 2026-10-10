-- Authoritative listing bootstrap is in 0420; current-actor read guard is in 0421.
-- Clean rebuild: 0480 has now created fixed_deposit. Safe to run repeatedly.
SELECT fn_install_customer_fd_summary();
SELECT fn_install_customer_fd_scope_guard();
