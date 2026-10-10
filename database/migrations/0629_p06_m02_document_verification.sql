-- ADR-0027: narrow execute-only verification; no direct child UPDATE grant.
BEGIN;
CREATE FUNCTION fn_verify_customer_document(p_doc_id uuid,p_actor uuid)
RETURNS TABLE(doc_id uuid,customer_id uuid,verified_by uuid,verified_date timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_branch uuid; v_doc customer_document%ROWTYPE;
BEGIN
  SELECT r.role_name,a.branch_id INTO v_role,v_branch
    FROM app_user u JOIN role r ON r.role_id=u.role_id
    JOIN agent a ON a.agent_id=u.user_id JOIN branch b ON b.branch_id=a.branch_id
    WHERE u.user_id=p_actor AND u.status='ACTIVE' AND r.status='ACTIVE'
      AND a.status='ACTIVE' AND b.status='ACTIVE' AND r.role_name IN ('AGENT','BRANCH_MANAGER')
    FOR SHARE OF u,r,a,b;
  IF NOT FOUND OR p_actor IS DISTINCT FROM fn_rls_user_id()
    OR v_role IS DISTINCT FROM fn_rls_role() OR v_branch IS DISTINCT FROM fn_rls_branch_id() THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  SELECT d.* INTO v_doc FROM customer_document d JOIN customer c ON c.customer_id=d.customer_id
    WHERE d.doc_id=p_doc_id AND c.branch_id=v_branch AND c.status='ACTIVE'
    FOR UPDATE OF d FOR SHARE OF c;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM customer_document d WHERE d.doc_id=p_doc_id) THEN
      RAISE EXCEPTION 'DOCUMENT_NOT_AUTHORIZED' USING ERRCODE='42501';
    END IF;
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF v_role='AGENT' THEN
    PERFORM 1 FROM customer_agent ca WHERE ca.customer_id=v_doc.customer_id
      AND ca.agent_id=p_actor AND ca.is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_doc.verified_by IS NOT NULL AND v_doc.verified_by<>p_actor THEN
    RAISE EXCEPTION 'DOCUMENT_ALREADY_VERIFIED' USING ERRCODE='P0001';
  END IF;
  IF v_doc.verified_by IS NULL THEN
    UPDATE customer_document d SET verified_by=p_actor,verified_date=date_trunc('milliseconds',clock_timestamp())
      WHERE d.doc_id=p_doc_id RETURNING d.* INTO v_doc;
    INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,old_values,new_values)
      VALUES(p_actor,'USER','customer_document',p_doc_id,'UPDATE',
        jsonb_build_object('verified_by',NULL,'verified_date',NULL),
        jsonb_build_object('verified_by',v_doc.verified_by,'verified_date',to_char(v_doc.verified_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  END IF;
  RETURN QUERY SELECT v_doc.doc_id,v_doc.customer_id,v_doc.verified_by,v_doc.verified_date;
END $$;
REVOKE ALL ON FUNCTION fn_verify_customer_document(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_verify_customer_document(uuid,uuid) TO mims_app;
COMMIT;
