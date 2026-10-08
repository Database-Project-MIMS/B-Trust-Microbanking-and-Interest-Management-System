-- Migration: 0543_p05_m03_rpt02_view_v2.sql
-- Task: P05-M03-T01 follow-up (RPT-02 review findings, ADR-0023) · Owner: Member 3
-- Purpose: replace vw_rpt02_account_summary (0540) with a version that fixes the three review findings.
-- 0540 may already be applied or pushed, and a shared migration is immutable, so this migration drops and
-- re-creates the view (nothing depends on it yet: the report built on it, P05-M03-T02, comes after).
--
--   1. Ordering. Rows are ordered by transaction.ledger_seq (0542), the posting-order key, not by timestamp.
--      "First / last row of an account in a range" is therefore right even when postings tie on
--      transaction_date or when a deposit that waited for the account lock carries an earlier timestamp.
--   2. No overflow. 0540 cast the derived balances to numeric(15,2); one out-of-range ledger row (or a running
--      total past 10^13) then made EVERY query on the view fail with "numeric field overflow". The balances
--      are now plain numeric. The values print exactly as before for valid data (scale 2).
--   3. No whole-ledger window. 0540 computed a running total with a window function over every account's
--      ledger on each query. It is only needed for legacy rows whose balance_after is NULL (opening deposits
--      written before 0541), so it is now a correlated sum evaluated ONLY for those rows (the one-time filter
--      skips it for every other row), and filters on account_id reach the ledger through the index
--      ux_transaction_account_ledger_seq.
--
-- Everything else is as documented in 0540: one row per account per ledger event (an account with no ledger rows
-- appears once, with NULL transaction columns); balance_before = balance_after_effective - balance_effect;
-- reversals count in their ORIGINAL transaction's category with a negated amount (as in RPT-05), so
-- closing - opening = deposits - withdrawals + interest for any range. security_invoker + security_barrier: the
-- caller's row-level security applies. New column: ledger_seq.
--
-- How a report uses it for a range [from, to]:
--   opening balance = balance_before of the row with the smallest ledger_seq among rows with transaction_date
--                     >= from (else the account's current_balance);
--   closing balance = balance_after_effective of the row with the largest ledger_seq among rows with
--                     transaction_date < to + 1 day (else the opening balance).
-- (Dates are Asia/Colombo calendar days. A late-stamped row inside the range boundary is the one remaining case
-- where timestamp and posting order can disagree; the seq decides which row is first/last among those the
-- date filter keeps.)

BEGIN;

DROP VIEW vw_rpt02_account_summary;

CREATE VIEW vw_rpt02_account_summary
WITH (security_invoker = true, security_barrier = true) AS
WITH ledger AS NOT MATERIALIZED (
    SELECT
        t.account_id,
        t.transaction_id,
        t.ledger_seq,
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
    r.ledger_seq,
    r.transaction_type,
    r.activity_type,
    r.amount,
    r.effective_amount,
    r.balance_effect,
    r.transaction_date,
    r.balance_after,
    COALESCE(r.balance_after, legacy.running_effect) AS balance_after_effective,
    COALESCE(r.balance_after, legacy.running_effect) - r.balance_effect AS balance_before
FROM account a
JOIN savings_plan sp ON sp.plan_id = a.plan_id
LEFT JOIN ledger r ON r.account_id = a.account_id
LEFT JOIN LATERAL (
    -- Only for legacy rows (balance_after IS NULL): the signed ledger total up to and including this row.
    SELECT SUM(l.balance_effect) AS running_effect
    FROM ledger l
    WHERE r.balance_after IS NULL
      AND l.account_id = r.account_id
      AND l.ledger_seq <= r.ledger_seq
) legacy ON true;

COMMENT ON VIEW vw_rpt02_account_summary IS
    'RPT-02 (v2, 0543): one row per account per ledger event (an account with no ledger rows appears once with NULL transaction columns), ordered by ledger_seq. Reversals count in their original category with a negated amount (as in RPT-05). balance_after_effective is the stored balance_after, or the signed running total for legacy NULL opening-deposit rows; balance_before = balance_after_effective - balance_effect. Plain numeric (no overflow cast). Caller RLS applies (security_invoker).';

GRANT SELECT ON vw_rpt02_account_summary TO mims_app;

COMMIT;
