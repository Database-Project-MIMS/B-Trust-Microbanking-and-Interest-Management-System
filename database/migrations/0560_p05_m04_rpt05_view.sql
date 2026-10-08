-- P05-M04-T01: one row per customer/account/ledger event.
-- A joint account event is attributed once to each account holder.
BEGIN;

CREATE VIEW vw_rpt05_customer_activity
WITH (security_invoker = true, security_barrier = true) AS
SELECT
    c.customer_id,
    c.full_name,
    c.branch_id,
    a.account_id,
    a.account_number,
    a.branch_id AS account_branch_id,
    a.plan_id,
    a.status AS account_status,
    t.transaction_id,
    t.transaction_type,
    t.amount,
    t.transaction_date,
    CASE WHEN t.transaction_type = 'REVERSAL'
         THEN original.transaction_type
         ELSE t.transaction_type
    END AS activity_type,
    CASE WHEN t.transaction_type = 'REVERSAL'
         THEN -t.amount
         ELSE t.amount
    END AS effective_amount
FROM customer c
LEFT JOIN account_holder ah ON ah.customer_id = c.customer_id
LEFT JOIN account a ON a.account_id = ah.account_id
LEFT JOIN transaction t ON t.account_id = a.account_id
LEFT JOIN transaction_reversal reversal
    ON reversal.reversal_transaction_id = t.transaction_id
LEFT JOIN transaction original
    ON original.transaction_id = reversal.original_transaction_id;

COMMENT ON VIEW vw_rpt05_customer_activity IS
    'RPT-05 customer-account activity. Joint entries appear for each holder; reversal amounts negate the original category.';

GRANT SELECT ON vw_rpt05_customer_activity TO mims_app;

COMMIT;
