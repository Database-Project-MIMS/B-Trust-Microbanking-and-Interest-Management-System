-- Migration: 0540_p05_m03_rpt02_view.sql
-- Task: P05-M03-T01 (RPT-02, REP-ACC) · Owner: Member 3
-- Purpose: vw_rpt02_account_summary, one row per account per ledger event (an account with no ledger rows
--          appears once with NULL transaction columns). The report query (T02) picks the opening and
--          closing balance for a date range from it and aggregates the rest; the view never takes a date
--          range, so it stays usable for any range.
--
-- Balances come from the ledger's own evidence, not from re-summing history on every request:
--   balance_after            transaction.balance_after as stored (G-14, written by every posting routine)
--   balance_after_effective  balance_after, or - for the legacy rows where it is NULL - the signed running
--                            total of the ledger up to that row. NULL only happens for opening deposits
--                            written by sp_open_savings_account before 0541 (the ledger is immutable, so
--                            they cannot be corrected), and an opening deposit is an account's first row,
--                            so the running total equals the true balance.
--   balance_before           balance_after_effective - balance_effect (the balance just before the row)
-- Opening balance for a range starting at :from  = balance_before of the first row at or after :from,
--                                                   else the account's current_balance.
-- Closing balance for a range ending before :to  = balance_after_effective of the last row before :to,
--                                                   else the opening balance.
--
-- Reversals follow RPT-05 (vw_rpt05_customer_activity): a REVERSAL row is counted in its ORIGINAL
-- transaction's category with a negated amount, so deposits/withdrawals/interest are net of corrections and
--   closing - opening = deposits - withdrawals + interest   for any range.
--   activity_type     the category the row belongs to (a reversal takes its original's type)
--   effective_amount  amount, negated for a reversal
--   balance_effect    signed effect on the account balance (+ credit, - debit)
--
-- Ordering: rows of an account are ordered by (transaction_date, transaction_id). That is chronological
-- whenever each posting runs in its own database transaction, which the application always does
-- (AGENTS 11). Postings made inside ONE transaction (the seed loads many in a single block) can share a
-- timestamp - deposits are stamped with the transaction's now(), withdrawals with clock_timestamp() - so
-- their relative order is then not guaranteed. Stored balance_after/balance_before are unaffected; only
-- "which row is first/last in the range" and the running total used for legacy NULL rows depend on it.
--
-- security_invoker: the caller's row-level security on account (and its grants) applies, so a branch
-- manager only sees accounts of their branch; the view adds no scope of its own.
-- Note: the task card's sketch used transaction.posted_at and transaction.status; neither exists. The
-- timestamp is transaction_date and every ledger row is posted (rows are immutable).

BEGIN;

CREATE VIEW vw_rpt02_account_summary
WITH (security_invoker = true, security_barrier = true) AS
WITH ledger AS (
    SELECT
        t.account_id,
        t.transaction_id,
        t.transaction_type,
        t.amount,
        t.transaction_date,
        t.balance_after,
        CASE WHEN t.transaction_type = 'REVERSAL' THEN original.transaction_type
             ELSE t.transaction_type END AS activity_type,
        CASE WHEN t.transaction_type = 'REVERSAL' THEN -t.amount
             ELSE t.amount END AS effective_amount,
        CASE
            WHEN t.transaction_type = 'REVERSAL' THEN
                CASE original.transaction_type WHEN 'WITHDRAWAL' THEN t.amount ELSE -t.amount END
            WHEN t.transaction_type = 'WITHDRAWAL' THEN -t.amount
            ELSE t.amount
        END AS balance_effect
    FROM transaction t
    LEFT JOIN transaction_reversal reversal ON reversal.reversal_transaction_id = t.transaction_id
    LEFT JOIN transaction original ON original.transaction_id = reversal.original_transaction_id
),
running AS (
    SELECT l.*,
           SUM(l.balance_effect) OVER (
               PARTITION BY l.account_id ORDER BY l.transaction_date, l.transaction_id
           ) AS running_effect
    FROM ledger l
)
SELECT
    a.account_id,
    a.account_number,
    a.branch_id,
    a.plan_id,
    sp.plan_name,
    a.status AS account_status,
    a.current_balance,
    a.opened_date,
    r.transaction_id,
    r.transaction_type,
    r.activity_type,
    r.amount,
    r.effective_amount,
    r.balance_effect,
    r.transaction_date,
    r.balance_after,
    COALESCE(r.balance_after, r.running_effect)::numeric(15,2) AS balance_after_effective,
    (COALESCE(r.balance_after, r.running_effect) - r.balance_effect)::numeric(15,2) AS balance_before
FROM account a
JOIN savings_plan sp ON sp.plan_id = a.plan_id
LEFT JOIN running r ON r.account_id = a.account_id;

COMMENT ON VIEW vw_rpt02_account_summary IS
    'RPT-02: one row per account per ledger event (an account with no ledger rows appears once with NULL transaction columns). Reversals are counted in their original category with a negated amount (as in RPT-05). balance_after_effective is the stored balance_after, or the signed running total for legacy NULL opening-deposit rows; balance_before = balance_after_effective - balance_effect. Caller RLS applies (security_invoker).';

GRANT SELECT ON vw_rpt02_account_summary TO mims_app;

COMMIT;
