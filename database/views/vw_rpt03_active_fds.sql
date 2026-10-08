CREATE OR REPLACE VIEW vw_rpt03_active_fds AS
SELECT
    fd.fd_id,
    fd.account_id,
    a.account_number,
    a.branch_id,                          -- for branch-scope filtering
    b.branch_name,
    fd.fd_plan_id,
    fp.plan_name                          AS product_name,
    fp.tenure_months,
    fd.principal_amount,
    fd.interest_rate_at_opening,          -- snapshot rate, not plan rate
    fd.start_date,
    fd.maturity_date,
    fd.next_interest_date,
    fd.status                             AS fd_status,
    -- Holder information (aggregated)
    string_agg(c.full_name, ', ' ORDER BY ah.joined_date) AS holder_names,
    COUNT(ah.account_holder_id)           AS holder_count,
    -- Calculated fields
    fn_calculate_fd_interest(
        fd.principal_amount,
        fd.interest_rate_at_opening
    )                                     AS estimated_next_payout
FROM fixed_deposit fd
JOIN account a ON a.account_id = fd.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
LEFT JOIN account_holder ah ON ah.account_id = a.account_id
LEFT JOIN customer c ON c.customer_id = ah.customer_id
WHERE fd.status = 'ACTIVE'
GROUP BY fd.fd_id, fd.account_id, a.account_number, a.branch_id,
         b.branch_name, fd.fd_plan_id, fp.plan_name, fp.tenure_months,
         fd.principal_amount, fd.interest_rate_at_opening,
         fd.start_date, fd.maturity_date, fd.next_interest_date, fd.status;
