-- P04-M03-T01 (M3): publishes interface I-6 to M5 — account-side fixed-deposit eligibility.
-- BR-11, FR-FD-01, FR-FD-02. Functions only: no table, grant or data change.
--
-- fn_check_account_fd_eligible(account_id) is the contract in the task card
-- (3_Nisith/09_P4_fd-eligibility-closure-panel.md): true only for an existing ACTIVE account. STABLE,
-- SECURITY INVOKER, never raises, takes no lock. The caller locks the row FOR UPDATE first, then calls
-- it, and compares the balance itself so an inactive account (409 ACCOUNT_NOT_ACTIVE) and a short
-- balance (409 INSUFFICIENT_FUNDS) stay distinct errors.
--
-- fn_fd_funding_verdict(account_id, principal) is an optional richer helper that does the lock, the
-- status check, the one-active-FD pre-check and the balance check in one call and says WHY. It
-- takes the account row lock itself (SELECT ... FOR UPDATE), so the status and balance it judges
-- cannot change underneath the caller before the transaction ends. Nothing is keyed on a plan name.
--
-- fn_fd_funding_verdict checks, in this order (the first failure is the verdict):
--   INVALID_PRINCIPAL     NULL, zero or negative principal (decided before any lock is taken)
--   ACCOUNT_NOT_FOUND     unknown or NULL account, or one the caller cannot see under RLS
--   ACCOUNT_NOT_ACTIVE    account.status <> 'ACTIVE' (FROZEN or CLOSED)
--   ACTIVE_FD_EXISTS      the account already has an FD with status 'ACTIVE' (BR-12, ADR-0011);
--                         MATURED and CLOSED FDs do not block a new one
--   INSUFFICIENT_BALANCE  account.current_balance < p_principal (BR-09: no overdraft)
--   OK
--
-- ACTIVE_FD_EXISTS is a best-effort early error, not the guard. It reads fixed_deposit as the CALLER,
-- and fixed_deposit has row-level security (0420/0421): only AGENT (assigned customers), BRANCH_MANAGER,
-- CENTRAL_OPS, AUDITOR and CUSTOMER contexts can see FD rows at all, so for any other context (for
-- example ADMIN) or a context the actor guard rejects, an existing active FD is invisible and the verdict
-- can be OK. The unique index uq_one_active_fd_per_account (0480) is the authoritative guard: every
-- opener that follows this contract locks the account row first, so two concurrent opens on one account
-- serialize here, and any FD this check cannot see is still stopped by the index (23505 -> 409
-- ACTIVE_FD_EXISTS in sp_open_fixed_deposit). The check deliberately does not bypass RLS.
--
-- Deliberately NOT checked: the plan minimum balance. BR-09 governs withdrawals; the I-6 task card
-- asks only for ACTIVE + sufficient balance. If the team decides FD principal must also preserve the
-- plan minimum, the caller can add fn_check_plan_minimum(account_id, current_balance - principal).
--
-- Side effect of fn_fd_funding_verdict: takes a row lock on the account and writes nothing else (no
-- balance change, no ledger row, no audit row). It is therefore VOLATILE, not STABLE, and SECURITY
-- INVOKER so the caller's row-level security applies. It never raises for bad input, but like any
-- SELECT ... FOR UPDATE it waits for a competing lock on the account (so it can hit lock_timeout or a
-- deadlock) and cannot run in a read-only transaction (SQLSTATE 25006).
--
-- Call contract for M5's sp_open_fixed_deposit: inside the opening transaction (READ COMMITTED, as
-- for I-4), either (a) SELECT ... FOR UPDATE the account, then fn_check_account_fd_eligible and a
-- balance comparison, or (b) call fn_fd_funding_verdict, which locks for you. Then debit the principal
-- and insert the fixed_deposit row in the same transaction. See
-- .agent/handoffs/i-6-fn-check-account-fd-eligible.md.

BEGIN;

CREATE OR REPLACE FUNCTION fn_fd_funding_verdict(
    p_account_id uuid,
    p_principal numeric(15,2)
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $fn$
DECLARE
    v_status  varchar(20);
    v_balance numeric(15,2);
BEGIN
    IF p_account_id IS NULL OR p_principal IS NULL OR p_principal <= 0 THEN
        RETURN 'INVALID_PRINCIPAL';
    END IF;

    SELECT a.status, a.current_balance
    INTO v_status, v_balance
    FROM account a
    WHERE a.account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'ACCOUNT_NOT_FOUND';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        RETURN 'ACCOUNT_NOT_ACTIVE';
    END IF;

    PERFORM 1
    FROM fixed_deposit fd
    WHERE fd.account_id = p_account_id
      AND fd.status = 'ACTIVE';
    IF FOUND THEN
        RETURN 'ACTIVE_FD_EXISTS';
    END IF;

    IF v_balance < p_principal THEN
        RETURN 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN 'OK';
END;
$fn$;

COMMENT ON FUNCTION fn_fd_funding_verdict(uuid, numeric) IS
    'I-6 helper (optional, richer than fn_check_account_fd_eligible): locks the account row (FOR UPDATE) and returns why an FD of p_principal can or cannot be funded from it: OK, INVALID_PRINCIPAL, ACCOUNT_NOT_FOUND (also RLS-hidden), ACCOUNT_NOT_ACTIVE, ACTIVE_FD_EXISTS, INSUFFICIENT_BALANCE. Never raises for bad input, but waits for a competing account lock and cannot run in a read-only transaction (25006). Call first inside the opening transaction; the lock holds until it ends. ACTIVE_FD_EXISTS reads fixed_deposit under the caller RLS and can miss an FD the caller cannot see (for example an ADMIN context); the unique index uq_one_active_fd_per_account remains the authoritative one-active-FD guard.';

CREATE OR REPLACE FUNCTION fn_check_account_fd_eligible(
    p_account_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_status varchar(20);
BEGIN
    IF p_account_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT a.status INTO v_status FROM account a WHERE a.account_id = p_account_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN v_status = 'ACTIVE';
END;
$fn$;

COMMENT ON FUNCTION fn_check_account_fd_eligible(uuid) IS
    'I-6: true when the account exists, is visible to the caller and has status ACTIVE (BR-11). Status only: it does not check the balance or an existing FD, and it takes no lock. Lock the row (SELECT ... FOR UPDATE) first, then call it, then compare current_balance to the principal yourself (false -> 409 ACCOUNT_NOT_ACTIVE; short balance -> 409 INSUFFICIENT_FUNDS). Never raises. For a one-call locked check with reasons use fn_fd_funding_verdict.';

COMMIT;
