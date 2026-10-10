-- P06-M02-T03 / G-28. Narrow customer operation; direct account UPDATE remains denied.
BEGIN;
CREATE PROCEDURE public.sp_try_customer_withdrawal(
    p_account_id uuid, p_amount numeric, p_channel_id uuid,
    p_initiated_by_user_id uuid, p_signer_customer_ids uuid[],
    p_idempotency_key varchar, p_narration varchar,
    OUT p_transaction_id uuid, OUT p_reference_number varchar,
    OUT p_balance_after numeric, OUT p_posted_at timestamptz,
    OUT p_rejection_code varchar
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_customer_id uuid;
BEGIN
    IF public.fn_rls_role() IS DISTINCT FROM 'CUSTOMER'
       OR public.fn_rls_user_id() IS DISTINCT FROM p_initiated_by_user_id THEN
        RAISE EXCEPTION 'Customer withdrawal context denied' USING ERRCODE='42501';
    END IF;
    SELECT c.customer_id INTO v_customer_id
    FROM public.customer c JOIN public.app_user u ON u.user_id=c.app_user_id
    JOIN public.role r ON r.role_id=u.role_id
    WHERE u.user_id=p_initiated_by_user_id AND u.status='ACTIVE' AND r.status='ACTIVE'
      AND r.role_name='CUSTOMER' AND c.status='ACTIVE';
    IF v_customer_id IS NULL OR p_signer_customer_ids IS DISTINCT FROM ARRAY[v_customer_id] THEN
        RAISE EXCEPTION 'Customer signer denied' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.account_holder ah
                   WHERE ah.account_id=p_account_id AND ah.customer_id=v_customer_id) THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE='P0001';
    END IF;
    -- Existing core locks and revalidates ownership/mandate/status/limits, using exact SQL money.
    CALL public.sp_try_post_withdrawal(p_account_id,p_amount,p_channel_id,p_initiated_by_user_id,
        p_signer_customer_ids,p_idempotency_key,p_narration,p_transaction_id,p_reference_number,
        p_balance_after,p_posted_at,p_rejection_code);
END;
$$;
REVOKE ALL ON PROCEDURE public.sp_try_customer_withdrawal(uuid,numeric,uuid,uuid,uuid[],varchar,varchar) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE public.sp_try_customer_withdrawal(uuid,numeric,uuid,uuid,uuid[],varchar,varchar) TO mims_app;
COMMENT ON PROCEDURE public.sp_try_customer_withdrawal(uuid,numeric,uuid,uuid,uuid[],varchar,varchar) IS
  'Pinned-path customer-only operation: stored actor/profile and own sole signer; existing audited core owns locks. No direct customer UPDATE permission.';
COMMIT;
