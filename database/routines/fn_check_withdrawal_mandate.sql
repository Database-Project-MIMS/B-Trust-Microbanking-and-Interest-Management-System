-- fn_check_withdrawal_mandate: P03-M03-T02 (M3) — mandate check for M4's withdrawal path (I-4).
-- BR-17 / FR-WD-02: do the customers authorising a withdrawal satisfy the account's stored
-- operating mandate? The rule is read from joint_mandate (0242) and account_holder (0241);
-- nothing is keyed on a plan name.
--
--   account with a single holder and no mandate: that holder must be among the signers
--   ANY_ONE      : at least one signer, and every signer is a current holder
--   ALL_HOLDERS  : every current holder signs (and at least required_signatories distinct signers)
--
-- Every signer must be a CURRENT holder of the account: a non-holder id in the array, a NULL
-- element, an empty array or a NULL array all give false. Duplicates count once.
-- A mandate outside its effective_from/effective_to window (Asia/Colombo calendar date), or an
-- account with several holders and no mandate row, also gives false (fail closed; opening
-- guarantees a mandate, so this only guards drift). The no-mandate case looks at the account's
-- actual holders, not at savings_plan.max_holders, so an admin editing a plan cannot lock
-- existing individual accounts.
--
-- fn_withdrawal_mandate_verdict returns WHY (text code) for audit; fn_check_withdrawal_mandate
-- is the boolean published to M4 and is exactly (verdict = 'OK').
--
-- Never raises: an unknown or NULL account, or one the caller cannot see under row-level
-- security (SECURITY INVOKER), returns false. It does not check account status, limits,
-- business hours, the plan minimum or the balance (sp_post_withdrawal / fn_check_plan_minimum).
--
-- Call contract for M4's sp_post_withdrawal: AFTER SELECT ... FOR UPDATE on the account row
-- (which already separated ACCOUNT_NOT_FOUND) and BEFORE the ledger insert, in a READ COMMITTED
-- transaction (each statement then takes a fresh snapshot after the lock; under REPEATABLE READ
-- the holder/mandate reads would come from the transaction's first snapshot). false → reject with
-- MANDATE_NOT_SATISFIED, write no ledger row, record the rejection as an audit event.
-- See .agent/handoffs/i-4-fn-check-withdrawal-mandate.md.

CREATE OR REPLACE FUNCTION fn_withdrawal_mandate_verdict(
    p_account_id uuid,
    p_signer_customer_ids uuid[]
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_holder_count   int;
    v_signer_count   int;
    v_valid_count    int;
    v_mandate_type   varchar(20);
    v_required       int;
    v_effective_from date;
    v_effective_to   date;
    v_today          date := (now() AT TIME ZONE 'Asia/Colombo')::date;
BEGIN
    IF p_account_id IS NULL
       OR p_signer_customer_ids IS NULL
       OR cardinality(p_signer_customer_ids) = 0
       OR array_position(p_signer_customer_ids, NULL) IS NOT NULL THEN
        RETURN 'NO_SIGNERS';
    END IF;

    PERFORM 1 FROM account WHERE account_id = p_account_id;
    IF NOT FOUND THEN
        RETURN 'ACCOUNT_NOT_FOUND';
    END IF;

    SELECT count(*)
    INTO v_holder_count
    FROM account_holder
    WHERE account_id = p_account_id;

    SELECT count(DISTINCT s.customer_id)
    INTO v_signer_count
    FROM unnest(p_signer_customer_ids) AS s(customer_id);

    SELECT count(*)
    INTO v_valid_count
    FROM account_holder ah
    WHERE ah.account_id = p_account_id
      AND ah.customer_id = ANY (p_signer_customer_ids);

    -- Any signer who is not a current holder voids the authorisation.
    IF v_valid_count = 0 OR v_valid_count <> v_signer_count THEN
        RETURN 'SIGNER_NOT_HOLDER';
    END IF;

    SELECT jm.mandate_type, jm.required_signatories, jm.effective_from, jm.effective_to
    INTO v_mandate_type, v_required, v_effective_from, v_effective_to
    FROM joint_mandate jm
    WHERE jm.account_id = p_account_id;

    IF NOT FOUND THEN
        -- No mandate: only an account with a single holder may operate without one.
        IF v_holder_count = 1 THEN
            RETURN 'OK';
        END IF;
        RETURN 'MANDATE_MISSING';
    END IF;

    IF v_effective_from > v_today
       OR (v_effective_to IS NOT NULL AND v_effective_to < v_today) THEN
        RETURN 'MANDATE_NOT_EFFECTIVE';
    END IF;

    IF v_mandate_type = 'ANY_ONE' THEN
        RETURN CASE WHEN v_valid_count >= 1 THEN 'OK' ELSE 'MANDATE_NOT_SATISFIED' END;
    ELSIF v_mandate_type = 'ALL_HOLDERS' THEN
        RETURN CASE WHEN v_valid_count = v_holder_count AND v_valid_count >= v_required
                    THEN 'OK' ELSE 'MANDATE_NOT_SATISFIED' END;
    END IF;

    RETURN 'MANDATE_NOT_SATISFIED';
END;
$fn$;

COMMENT ON FUNCTION fn_withdrawal_mandate_verdict(uuid, uuid[]) IS
    'I-4 helper: reason code behind fn_check_withdrawal_mandate: OK, NO_SIGNERS, ACCOUNT_NOT_FOUND (also RLS-hidden), SIGNER_NOT_HOLDER, MANDATE_MISSING, MANDATE_NOT_EFFECTIVE, MANDATE_NOT_SATISFIED. Never raises. Use it to record why a withdrawal was rejected; do not show codes to clients that could reveal holders.';

CREATE OR REPLACE FUNCTION fn_check_withdrawal_mandate(
    p_account_id uuid,
    p_signer_customer_ids uuid[]
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
    SELECT fn_withdrawal_mandate_verdict(p_account_id, p_signer_customer_ids) = 'OK';
$fn$;

COMMENT ON FUNCTION fn_check_withdrawal_mandate(uuid, uuid[]) IS
    'I-4: true when the distinct p_signer_customer_ids are all current holders of the account and satisfy its stored joint_mandate (ANY_ONE: one holder; ALL_HOLDERS: every holder). No mandate is valid only for a single-holder account. Returns false for an unknown/NULL account, empty/NULL/NULL-containing array, non-holder signer, or a mandate outside its effective dates (Asia/Colombo date); never raises. Call after locking the account row (FOR UPDATE, READ COMMITTED) and before the ledger insert; false means reject with MANDATE_NOT_SATISFIED. For the reason use fn_withdrawal_mandate_verdict.';
