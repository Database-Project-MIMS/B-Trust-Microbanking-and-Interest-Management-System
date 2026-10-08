BEGIN;

-- P05-M02-T01 / ADR-0020. Timestamp-grain facts remain filterable before totals.
-- Current staff membership must never replace immutable posting attribution.
CREATE VIEW vw_rpt01_agent_transactions
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
    a.agent_id,
    a.employee_no,
    a.full_name AS agent_name,
    a.status AS agent_status,
    a.branch_id AS agent_branch_id,
    current_branch.branch_name AS agent_branch_name,
    t.branch_id,
    posting_branch.branch_name,
    t.transaction_type,
    t.transaction_date,
    COUNT(t.transaction_id) AS transaction_count,
    COALESCE(SUM(t.amount), 0.00::numeric) AS total_value
FROM agent AS a
JOIN branch AS current_branch ON current_branch.branch_id = a.branch_id
LEFT JOIN transaction AS t ON t.agent_id = a.agent_id
LEFT JOIN branch AS posting_branch ON posting_branch.branch_id = t.branch_id
GROUP BY
    a.agent_id, a.employee_no, a.full_name, a.status, a.branch_id,
    current_branch.branch_name, t.branch_id, posting_branch.branch_name,
    t.transaction_type, t.transaction_date;

-- I-7 must supply authenticated SQL scope, grants/RLS and access auditing before
-- T02 enables runtime access. SECURITY INVOKER does not itself authorize reports.
REVOKE ALL ON vw_rpt01_agent_transactions FROM PUBLIC, mims_app;

COMMENT ON VIEW vw_rpt01_agent_transactions IS
    'RPT-01 timestamp/type/posting-branch aggregates per agent profile, including inactive and manager profiles. For range-specific zeros LEFT JOIN the roster to filtered facts before summing. Owner-only pending I-7 report authorization; no signed/net interpretation.';
COMMENT ON COLUMN vw_rpt01_agent_transactions.branch_id IS
    'Immutable captured posting branch; NULL remains unattributed, never inferred from current staff membership.';
COMMENT ON COLUMN vw_rpt01_agent_transactions.agent_branch_id IS
    'Current roster branch only; never use this column to scope historical financial facts.';
COMMENT ON COLUMN vw_rpt01_agent_transactions.transaction_date IS
    'Exact posting timestamp, retained for half-open date filters before final aggregation. Empty-history roster rows have NULL.';
COMMENT ON COLUMN vw_rpt01_agent_transactions.total_value IS
    'Exact unsigned NUMERIC sum by type; unbounded result precision, zero for an empty-history roster row.';

COMMIT;
