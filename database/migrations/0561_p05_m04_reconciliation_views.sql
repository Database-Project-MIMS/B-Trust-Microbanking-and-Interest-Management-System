CREATE VIEW vw_reconciliation_balance AS
SELECT
    a.account_id,
    a.account_number,
    a.current_balance AS stored_balance,
    COALESCE(SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN -orig.amount
                    ELSE orig.amount
                 END
                 FROM transaction_reversal tr
                 JOIN transaction orig ON orig.transaction_id = tr.original_transaction_id
                 WHERE tr.reversal_transaction_id = t.transaction_id)
            ELSE 0
        END
    ), 0) AS computed_balance,
    a.current_balance - COALESCE(SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN -orig.amount
                    ELSE orig.amount
                 END
                 FROM transaction_reversal tr
                 JOIN transaction orig ON orig.transaction_id = tr.original_transaction_id
                 WHERE tr.reversal_transaction_id = t.transaction_id)
            ELSE 0
        END
    ), 0) AS discrepancy
FROM account a
LEFT JOIN transaction t ON t.account_id = a.account_id
GROUP BY a.account_id, a.account_number, a.current_balance;

CREATE VIEW vw_reconciliation_running_balance AS
SELECT
    t.transaction_id,
    t.account_id,
    t.balance_after AS stored_balance_after,
    SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN t.amount
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT') THEN -orig.amount
                    ELSE orig.amount
                 END
                 FROM transaction_reversal tr
                 JOIN transaction orig ON orig.transaction_id = tr.original_transaction_id
                 WHERE tr.reversal_transaction_id = t.transaction_id)
            ELSE 0
        END
    ) OVER (
        PARTITION BY t.account_id
        ORDER BY t.transaction_date, t.transaction_id
    ) AS computed_running_balance
FROM transaction t;
