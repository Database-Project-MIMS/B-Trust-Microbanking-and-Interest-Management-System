-- ADR-0026: preserve authorized self/manager historical aggregates without exposing ledger rows.
BEGIN;
CREATE FUNCTION fn_agent_activity_scoped(p_agent uuid,p_from date,p_to date)
RETURNS TABLE(type text,count text,total text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;v_branch uuid;
BEGIN
  SELECT r.role_name,a.branch_id INTO v_role,v_branch
  FROM app_user u JOIN role r ON r.role_id=u.role_id
  LEFT JOIN agent a ON a.agent_id=u.user_id AND a.status='ACTIVE'
  LEFT JOIN branch b ON b.branch_id=a.branch_id AND b.status='ACTIVE'
  WHERE u.user_id=fn_rls_user_id() AND u.status='ACTIVE' AND r.status='ACTIVE'
    AND r.role_name=fn_rls_role() AND r.role_name IN ('ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AGENT')
    AND (r.role_name IN ('ADMIN','CENTRAL_OPS') OR
      (b.branch_id=fn_rls_branch_id() AND (r.role_name<>'AGENT' OR u.user_id=p_agent)));
  IF v_role IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to>p_from+365
    OR NOT EXISTS (SELECT 1 FROM agent a JOIN app_user u ON u.user_id=a.agent_id
      JOIN role r ON r.role_id=u.role_id WHERE a.agent_id=p_agent AND r.role_name='AGENT'
      AND (v_role<>'BRANCH_MANAGER' OR a.branch_id=v_branch)) THEN
    RAISE EXCEPTION 'AGENT_ACTIVITY_DENIED' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT t.transaction_type::text,COUNT(*)::text,SUM(t.amount)::text
    FROM transaction t WHERE t.agent_id=p_agent
      AND t.transaction_date >= (p_from::timestamp AT TIME ZONE 'Asia/Colombo')
      AND t.transaction_date < ((p_to+1)::timestamp AT TIME ZONE 'Asia/Colombo')
      AND (v_role<>'BRANCH_MANAGER' OR t.branch_id=v_branch)
    GROUP BY t.transaction_type ORDER BY t.transaction_type;
END;
$$;
REVOKE ALL ON FUNCTION fn_agent_activity_scoped(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_agent_activity_scoped(uuid,date,date) TO mims_app;
COMMENT ON FUNCTION fn_agent_activity_scoped(uuid,date,date) IS
  'Current stored identity guard; returns aggregate type/count/amount only. Agent self-history and manager posting-branch scope; ordinary ledger RLS remains unchanged.';
COMMIT;
