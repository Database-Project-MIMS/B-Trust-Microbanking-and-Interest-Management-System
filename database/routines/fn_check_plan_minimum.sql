-- fn_check_plan_minimum: P03-M03-T01 (M3) — publishes interface I-4 to M4.
-- Post-withdrawal minimum-balance rule (BR-09): would the account still hold at least its
-- plan's minimum_balance after a withdrawal? The minimum is read from savings_plan through
-- account.plan_id (migrations 0140 / 0240), never hardcoded per plan name.
--
-- Never raises: an unknown or NULL account, a NULL resulting balance, or an account the
-- caller cannot see under row-level security (SECURITY INVOKER) all return false, so the
-- check fails closed. It does not check account status, withdrawal limits or the mandate
-- (sp_post_withdrawal) and does not police negative balances (CHECK current_balance >= 0).
--
-- Call contract for M4's sp_post_withdrawal: call it inside the transaction, AFTER
-- SELECT ... FOR UPDATE on the account row and BEFORE inserting the ledger row, with
-- (account_id, current_balance - amount) re-read after the lock. false → reject with
-- BELOW_MINIMUM_BALANCE and write no ledger row. See .agent/handoffs/i-4-fn-check-plan-minimum.md.

CREATE OR REPLACE FUNCTION fn_check_plan_minimum(
    p_account_id uuid,
    p_resulting_balance numeric(15,2)
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_min_balance numeric(15,2);
BEGIN
    IF p_account_id IS NULL OR p_resulting_balance IS NULL THEN
        RETURN false;
    END IF;

    SELECT sp.min_balance
    INTO v_min_balance
    FROM account a
    JOIN savings_plan sp ON sp.plan_id = a.plan_id
    WHERE a.account_id = p_account_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN p_resulting_balance >= v_min_balance;
END;
$fn$;

COMMENT ON FUNCTION fn_check_plan_minimum(uuid, numeric) IS
    'I-4: true when p_resulting_balance (balance after the withdrawal) is at least the account plan minimum read from savings_plan via account.plan_id. Returns false for an unknown/NULL account, NULL balance or an account hidden by RLS; never raises. Call after locking the account row (FOR UPDATE) and before the ledger insert; false means reject with BELOW_MINIMUM_BALANCE.';
