BEGIN;

CREATE OR REPLACE VIEW vw_reconciliation_balance AS
SELECT
    a.account_id,
    a.account_number,
    a.current_balance AS stored_balance,
    COALESCE(SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN t.amount
            WHEN t.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT') THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN -orig.amount
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
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN t.amount
            WHEN t.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT') THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN -orig.amount
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

CREATE OR REPLACE VIEW vw_reconciliation_running_balance AS
SELECT
    t.transaction_id,
    t.account_id,
    t.balance_after AS stored_balance_after,
    SUM(
        CASE
            WHEN t.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN t.amount
            WHEN t.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT') THEN -t.amount
            WHEN t.transaction_type = 'REVERSAL' THEN
                (SELECT CASE
                    WHEN orig.transaction_type IN ('DEPOSIT', 'INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY') THEN -orig.amount
                    ELSE orig.amount
                 END
                 FROM transaction_reversal tr
                 JOIN transaction orig ON orig.transaction_id = tr.original_transaction_id
                 WHERE tr.reversal_transaction_id = t.transaction_id)
            ELSE 0
        END
    ) OVER (
        PARTITION BY t.account_id
        ORDER BY t.ledger_seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS computed_running_balance
FROM transaction t;

GRANT SELECT ON vw_reconciliation_balance,vw_reconciliation_running_balance TO mims_app;


CREATE OR REPLACE VIEW vw_rpt02_account_summary
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
        (CASE (CASE WHEN t.transaction_type='REVERSAL' THEN original.transaction_type ELSE t.transaction_type END)
          WHEN 'TRANSFER_OUT' THEN 'WITHDRAWAL' WHEN 'TRANSFER_IN' THEN 'DEPOSIT' WHEN 'FD_MATURITY' THEN 'DEPOSIT'
          ELSE (CASE WHEN t.transaction_type='REVERSAL' THEN original.transaction_type ELSE t.transaction_type END) END)::varchar(50) AS activity_type,
        CASE WHEN t.transaction_type = 'REVERSAL' THEN -t.amount
             ELSE t.amount END AS effective_amount,
        CASE
            WHEN t.transaction_type = 'REVERSAL' THEN
                CASE WHEN original.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT') THEN t.amount ELSE -t.amount END
            WHEN t.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT') THEN -t.amount
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


CREATE OR REPLACE VIEW vw_rpt05_customer_activity
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
    (CASE (CASE WHEN t.transaction_type='REVERSAL' THEN original.transaction_type ELSE t.transaction_type END)
      WHEN 'TRANSFER_OUT' THEN 'WITHDRAWAL' WHEN 'TRANSFER_IN' THEN 'DEPOSIT' WHEN 'FD_MATURITY' THEN 'DEPOSIT'
      ELSE (CASE WHEN t.transaction_type='REVERSAL' THEN original.transaction_type ELSE t.transaction_type END) END)::varchar(50) AS activity_type,
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


CREATE OR REPLACE VIEW vw_rpt04_interest_distribution AS
SELECT
    ir.cycle_date,
    EXTRACT(YEAR FROM ir.cycle_date)    AS cycle_year,
    EXTRACT(MONTH FROM ir.cycle_date)   AS cycle_month,
    sp.plan_name                        AS savings_plan_name,
    COALESCE(fp.plan_name,'Savings interest')::varchar(100) AS fd_product_name,
    a.branch_id,
    b.branch_name,
    COUNT(ip.interest_id)               AS distribution_count,
    SUM(ip.interest_amount)             AS total_interest,
    AVG(ip.interest_amount)             AS avg_interest,
    MIN(ip.interest_amount)             AS min_interest,
    MAX(ip.interest_amount)             AS max_interest
FROM interest_payout ip
JOIN interest_run ir ON ir.run_id = ip.interest_run_id
LEFT JOIN fixed_deposit fd ON fd.fd_id = ip.fd_id
LEFT JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
JOIN account a ON a.account_id = ip.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN savings_plan sp ON sp.plan_id = a.plan_id
GROUP BY ROLLUP (
    (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
    (sp.plan_name),
    (COALESCE(fp.plan_name,'Savings interest')),
    (a.branch_id, b.branch_name)
);

GRANT SELECT ON vw_rpt04_interest_distribution TO mims_app;



-- P05-M02-T02 / ADR-0022. An aggregate-only capability, not a raw ledger grant.
CREATE OR REPLACE FUNCTION fn_rpt01_scope(p_branch uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $guard$
DECLARE v_role text; v_branch uuid;
BEGIN
    SELECT r.role_name,
           CASE WHEN r.role_name = 'BRANCH_MANAGER' THEN a.branch_id END
    INTO v_role, v_branch
    FROM public.app_user u JOIN public.role r ON r.role_id = u.role_id
    LEFT JOIN public.agent a ON a.agent_id = u.user_id
    LEFT JOIN public.branch b ON b.branch_id = a.branch_id
    WHERE u.user_id = public.fn_rls_user_id()
      AND u.status = 'ACTIVE' AND r.status = 'ACTIVE'
      AND r.role_name = public.fn_rls_role()
      AND r.role_name IN ('ADMIN', 'CENTRAL_OPS', 'AUDITOR', 'BRANCH_MANAGER')
      AND (r.role_name <> 'BRANCH_MANAGER'
           OR (a.status = 'ACTIVE' AND b.status = 'ACTIVE'
               AND a.branch_id = public.fn_rls_branch_id()));
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REPORT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    IF v_role = 'BRANCH_MANAGER' THEN
        IF p_branch IS NOT NULL AND p_branch <> v_branch THEN
            RAISE EXCEPTION 'REPORT_SCOPE_DENIED' USING ERRCODE = '42501';
        END IF;
        RETURN v_branch;
    END IF;
    RETURN p_branch;
END;
$guard$;

CREATE OR REPLACE FUNCTION fn_rpt01_rows(p_from date, p_to date, p_branch uuid, p_agent uuid)
RETURNS TABLE (
    agent_id uuid, employee_no varchar, agent_name varchar, agent_status text,
    branch_id uuid, branch_name text, transaction_count numeric,
    deposit_count numeric, deposit_total numeric, withdrawal_count numeric,
    withdrawal_total numeric, interest_count numeric, interest_total numeric,
    reversal_count numeric, reversal_total numeric, reversal_credit numeric,
    reversal_debit numeric, unresolved_reversal_count numeric, net_total numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $report$
DECLARE v_branch uuid;
BEGIN
    v_branch := public.fn_rpt01_scope(p_branch);
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
       OR p_from > p_to THEN
        RAISE EXCEPTION 'INVALID_REPORT_RANGE' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    WITH filtered AS MATERIALIZED (
        SELECT f.agent_id, f.branch_id, f.transaction_type,
               f.transaction_count, f.total_value
        FROM public.vw_rpt01_agent_transactions f
        WHERE (p_agent IS NULL OR f.agent_id = p_agent)
          AND f.transaction_date >= (p_from::timestamp AT TIME ZONE 'Asia/Colombo')
          AND f.transaction_date < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
          AND (v_branch IS NULL OR f.branch_id = v_branch)
    ), reversals AS (
        SELECT t.agent_id, t.branch_id,
            COALESCE(SUM(t.amount) FILTER (WHERE o.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT')), 0.00) AS credit,
            COALESCE(SUM(t.amount) FILTER (WHERE o.transaction_type IN ('DEPOSIT','INTEREST_CREDIT','TRANSFER_IN','FD_MATURITY')), 0.00) AS debit,
            COUNT(*) FILTER (WHERE o.transaction_id IS NULL)::numeric AS unresolved
        FROM public.transaction t
        LEFT JOIN public.transaction_reversal r ON r.reversal_transaction_id = t.transaction_id
        LEFT JOIN public.transaction o ON o.transaction_id = r.original_transaction_id
            AND o.account_id = t.account_id AND o.amount = t.amount
            AND o.transaction_type IN ('DEPOSIT','WITHDRAWAL','INTEREST_CREDIT','TRANSFER_IN','TRANSFER_OUT','FD_MATURITY')
        WHERE t.transaction_type = 'REVERSAL' AND t.agent_id IS NOT NULL
          AND (p_agent IS NULL OR t.agent_id = p_agent)
          AND (v_branch IS NULL OR t.branch_id = v_branch)
          AND t.transaction_date >= (p_from::timestamp AT TIME ZONE 'Asia/Colombo')
          AND t.transaction_date < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
        GROUP BY t.agent_id, t.branch_id
    ), grouped AS (
        SELECT a.agent_id, a.employee_no, a.full_name, a.status::text AS status,
            CASE WHEN COUNT(f.agent_id) = 0 THEN COALESCE(v_branch, a.branch_id) ELSE f.branch_id END AS posting_branch,
            COALESCE(SUM(f.transaction_count), 0)::numeric AS count_all,
            COALESCE(SUM(f.transaction_count) FILTER (WHERE f.transaction_type IN ('DEPOSIT','TRANSFER_IN','FD_MATURITY')), 0)::numeric AS count_d,
            COALESCE(SUM(f.total_value) FILTER (WHERE f.transaction_type IN ('DEPOSIT','TRANSFER_IN','FD_MATURITY')), 0.00) AS total_d,
            COALESCE(SUM(f.transaction_count) FILTER (WHERE f.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT')), 0)::numeric AS count_w,
            COALESCE(SUM(f.total_value) FILTER (WHERE f.transaction_type IN ('WITHDRAWAL','TRANSFER_OUT')), 0.00) AS total_w,
            COALESCE(SUM(f.transaction_count) FILTER (WHERE f.transaction_type = 'INTEREST_CREDIT'), 0)::numeric AS count_i,
            COALESCE(SUM(f.total_value) FILTER (WHERE f.transaction_type = 'INTEREST_CREDIT'), 0.00) AS total_i,
            COALESCE(SUM(f.transaction_count) FILTER (WHERE f.transaction_type = 'REVERSAL'), 0)::numeric AS count_r,
            COALESCE(SUM(f.total_value) FILTER (WHERE f.transaction_type = 'REVERSAL'), 0.00) AS total_r
        FROM public.agent a LEFT JOIN filtered f ON f.agent_id = a.agent_id
        WHERE (p_agent IS NULL OR a.agent_id = p_agent)
          AND (v_branch IS NULL OR a.branch_id = v_branch
               OR EXISTS (SELECT 1 FROM filtered h WHERE h.agent_id = a.agent_id))
        GROUP BY a.agent_id, a.employee_no, a.full_name, a.status, a.branch_id, f.branch_id
    )
    SELECT g.agent_id, g.employee_no, g.full_name, g.status, g.posting_branch,
           COALESCE(b.branch_name::text, 'Unattributed posting branch'),
           g.count_all, g.count_d, g.total_d, g.count_w, g.total_w, g.count_i, g.total_i,
           g.count_r, g.total_r, COALESCE(r.credit, 0.00), COALESCE(r.debit, 0.00),
           COALESCE(r.unresolved, 0::numeric),
           CASE WHEN COALESCE(r.unresolved, 0) = 0
                THEN g.total_d + g.total_i - g.total_w + COALESCE(r.credit, 0.00) - COALESCE(r.debit, 0.00)
           END
    FROM grouped g LEFT JOIN public.branch b ON b.branch_id = g.posting_branch
    LEFT JOIN reversals r ON r.agent_id = g.agent_id AND r.branch_id IS NOT DISTINCT FROM g.posting_branch;
END;
$report$;

CREATE OR REPLACE FUNCTION fn_rpt01_exclusions(p_from date, p_to date, p_branch uuid)
RETURNS TABLE (transaction_count bigint, unsigned_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $excluded$
DECLARE v_branch uuid;
BEGIN
    v_branch := public.fn_rpt01_scope(p_branch);
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
       OR p_from > p_to THEN
        RAISE EXCEPTION 'INVALID_REPORT_RANGE' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT COUNT(t.transaction_id), COALESCE(SUM(t.amount), 0.00)
    FROM public.transaction t
    WHERE t.agent_id IS NULL AND (v_branch IS NULL OR t.branch_id = v_branch)
      AND t.transaction_date >= (p_from::timestamp AT TIME ZONE 'Asia/Colombo')
      AND t.transaction_date < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Colombo');
END;
$excluded$;

REVOKE ALL ON FUNCTION fn_rpt01_scope(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_rpt01_rows(date,date,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_rpt01_exclusions(date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_rpt01_scope(uuid),
    fn_rpt01_rows(date,date,uuid,uuid), fn_rpt01_exclusions(date,date,uuid) TO mims_app;
COMMENT ON FUNCTION fn_rpt01_rows(date,date,uuid,uuid) IS
    'RPT-01 fixed scoped aggregates; stored active report actor required, immutable posting branch, exact totals and linked reversal direction. No raw ledger capability.';


COMMIT;
