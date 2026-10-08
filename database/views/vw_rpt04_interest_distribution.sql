CREATE OR REPLACE VIEW vw_rpt04_interest_distribution AS
SELECT
    ir.cycle_date,
    EXTRACT(YEAR FROM ir.cycle_date)    AS cycle_year,
    EXTRACT(MONTH FROM ir.cycle_date)   AS cycle_month,
    sp.plan_name                        AS savings_plan_name,
    fp.plan_name                        AS fd_product_name,
    a.branch_id,
    b.branch_name,
    COUNT(ip.interest_id)               AS distribution_count,
    SUM(ip.interest_amount)             AS total_interest,
    AVG(ip.interest_amount)             AS avg_interest,
    MIN(ip.interest_amount)             AS min_interest,
    MAX(ip.interest_amount)             AS max_interest
FROM interest_payout ip
JOIN interest_run ir ON ir.run_id = ip.interest_run_id
JOIN fixed_deposit fd ON fd.fd_id = ip.fd_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
JOIN account a ON a.account_id = fd.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN savings_plan sp ON sp.plan_id = a.plan_id
GROUP BY ROLLUP (
    (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
    (sp.plan_name),
    (fp.plan_name),
    (a.branch_id, b.branch_name)
);

GRANT SELECT ON vw_rpt04_interest_distribution TO mims_app;
