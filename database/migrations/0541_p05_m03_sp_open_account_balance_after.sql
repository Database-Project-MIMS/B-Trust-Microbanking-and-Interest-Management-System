-- Migration: 0541_p05_m03_sp_open_account_balance_after.sql
-- Task: P05-M03-T01 (RPT-02 prerequisite, G-14) · Owner: Member 3
-- Purpose: sp_open_savings_account (0243) wrote the initial-deposit ledger row WITHOUT balance_after,
--          the column M4 added in 0361. Migration 0361 only backfilled rows that existed when it ran,
--          and the ledger is immutable, so every opening deposit made since has balance_after = NULL.
--          From this migration on the opening deposit records it. Older NULL rows cannot be updated;
--          vw_rpt02_account_summary (0540) derives their balance instead.
-- Change: one statement. The body below is 0243's procedure unchanged except that the initial-deposit
--         INSERT adds balance_after (= the deposit, because the account is new and starts at 0).
-- Transaction boundary, signature, SECURITY INVOKER and error contract are exactly as in 0243.

BEGIN;

CREATE OR REPLACE PROCEDURE sp_open_savings_account(
    IN  p_plan_id            UUID,
    IN  p_branch_id          UUID,
    IN  p_opened_by_agent_id UUID,
    IN  p_holders            JSONB,
    IN  p_mandate            JSONB,
    IN  p_initial_deposit    NUMERIC,
    IN  p_channel_id         UUID,
    IN  p_actor_user_id      UUID,
    OUT p_account_id         UUID,
    OUT p_account_number     VARCHAR,
    OUT p_current_balance    NUMERIC
)
LANGUAGE plpgsql
AS $sp$
DECLARE
    v_plan           savings_plan%ROWTYPE;
    v_branch_code    VARCHAR;
    v_agent_branch   UUID;
    v_agent_status   VARCHAR;
    v_session_actor  TEXT;
    v_holder_count   INT;
    v_element        JSONB;
    v_found          INT;
    v_primary_dob    DATE;
    v_unverified     INT;
    v_mandate_type   VARCHAR;
    v_signatories    INT;
    v_mandate_id     UUID;
    v_deposit        NUMERIC(15,2);
    v_transaction_id UUID;
    v_reference      VARCHAR;
BEGIN
    -- ── Actor: the audit trail and the ledger need a real user ─────────────────────────
    IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: an acting user is required'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_actor';
    END IF;

    v_session_actor := NULLIF(current_setting('app.current_user_id', true), '');
    IF v_session_actor IS NULL THEN
        -- No service context (for example a script): attribute the audit triggers to the actor.
        PERFORM set_config('app.current_user_id', p_actor_user_id::text, true);
    ELSIF v_session_actor <> p_actor_user_id::text THEN
        RAISE EXCEPTION 'ACTOR_MISMATCH: the acting user does not match the session user'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_actor';
    END IF;

    -- ── Plan: locked FOR SHARE so a concurrent plan edit cannot change the rules mid-open ──
    SELECT * INTO v_plan
      FROM savings_plan
     WHERE plan_id = p_plan_id AND status = 'ACTIVE'
       FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PLAN_NOT_FOUND: savings plan % does not exist or is not active', p_plan_id
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_plan';
    END IF;

    -- ── Opening agent and branch (ADR-0008: the branch comes from trusted scope) ───────
    SELECT a.branch_id, a.status, b.branch_code
      INTO v_agent_branch, v_agent_status, v_branch_code
      FROM agent a
      JOIN branch b ON b.branch_id = a.branch_id
     WHERE a.agent_id = p_opened_by_agent_id;
    IF NOT FOUND OR v_agent_status <> 'ACTIVE' OR v_agent_branch IS DISTINCT FROM p_branch_id THEN
        RAISE EXCEPTION 'AGENT_NOT_ELIGIBLE: agent % is not an active agent of branch %',
            p_opened_by_agent_id, p_branch_id
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_agent';
    END IF;

    -- ── Holder count (fail fast; the 0242 trigger enforces it again) ───────────────────
    v_holder_count := CASE WHEN jsonb_typeof(p_holders) = 'array' THEN jsonb_array_length(p_holders) ELSE 0 END;
    IF v_holder_count < v_plan.min_holders OR v_holder_count > v_plan.max_holders THEN
        RAISE EXCEPTION 'INVALID_HOLDER_COUNT: % holder(s) given, plan allows % to %',
            v_holder_count, v_plan.min_holders, v_plan.max_holders
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_holder_count';
    END IF;

    -- ── Payload shape: reject malformed input before any cast can raise a raw error ────
    FOR v_element IN SELECT value FROM jsonb_array_elements(p_holders) LOOP
        IF jsonb_typeof(v_element) <> 'object'
           OR jsonb_typeof(v_element -> 'customer_id') IS DISTINCT FROM 'string'
           OR (v_element ->> 'customer_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR (v_element ->> 'holder_type') IS NULL
           OR (v_element ->> 'holder_type') NOT IN ('PRIMARY', 'JOINT') THEN
            RAISE EXCEPTION 'INVALID_HOLDERS_PAYLOAD: each holder needs a uuid customer_id and a holder_type of PRIMARY or JOINT'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_holders_payload';
        END IF;
    END LOOP;

    -- ── Every holder must exist, be ACTIVE and be visible to the caller ────────────────
    -- Lock before you decide (AGENTS 11): FOR SHARE, in id order, so a concurrent
    -- deactivation of a holder waits for this transaction (or this one sees its result).
    PERFORM 1
       FROM customer
      WHERE customer_id IN (SELECT (value ->> 'customer_id')::uuid FROM jsonb_array_elements(p_holders))
      ORDER BY customer_id
        FOR SHARE;

    SELECT count(*) INTO v_found
      FROM jsonb_to_recordset(p_holders) AS h(customer_id UUID, holder_type TEXT)
      JOIN customer c ON c.customer_id = h.customer_id
     WHERE c.status = 'ACTIVE';
    IF v_found <> v_holder_count THEN
        RAISE EXCEPTION 'HOLDER_NOT_FOUND: every holder must be an existing active customer'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_holder_exists';
    END IF;

    -- ── Eligibility of the primary applicant, data-driven from savings_plan ────────────
    -- Adult-only plans additionally reject any under-18 joint holder in the 0242 trigger.
    SELECT c.date_of_birth INTO v_primary_dob
      FROM jsonb_to_recordset(p_holders) AS h(customer_id UUID, holder_type TEXT)
      JOIN customer c ON c.customer_id = h.customer_id
     WHERE h.holder_type = 'PRIMARY'
     LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MISSING_PRIMARY_HOLDER: exactly one PRIMARY holder is required'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_holder_one_primary';
    END IF;

    IF NOT fn_check_plan_eligibility(p_plan_id, v_primary_dob, v_holder_count) THEN
        RAISE EXCEPTION 'PLAN_ELIGIBILITY_FAILED: the primary applicant or holder count does not satisfy plan %',
            v_plan.plan_name
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_eligibility';
    END IF;

    -- ── Documentation: every holder needs at least one verified document (ERD Assumption 3) ──
    SELECT count(*) INTO v_unverified
      FROM jsonb_to_recordset(p_holders) AS h(customer_id UUID, holder_type TEXT)
     WHERE NOT EXISTS (
               SELECT 1
                 FROM customer_document d
                WHERE d.customer_id = h.customer_id
                  AND d.verified_by IS NOT NULL);
    IF v_unverified > 0 THEN
        RAISE EXCEPTION 'DOCUMENTS_NOT_VERIFIED: % holder(s) have no verified document', v_unverified
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_documents';
    END IF;

    -- ── Mandate: required on multi-holder plans, forbidden on single-holder plans ──────
    IF v_plan.max_holders > 1 THEN
        IF p_mandate IS NULL OR jsonb_typeof(p_mandate) <> 'object' THEN
            RAISE EXCEPTION 'MANDATE_REQUIRED: plan % needs an operating mandate', v_plan.plan_name
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_mandate';
        END IF;
        v_mandate_type := p_mandate ->> 'mandate_type';
        IF v_mandate_type IS NULL OR v_mandate_type NOT IN ('ANY_ONE', 'ALL_HOLDERS') THEN
            RAISE EXCEPTION 'INVALID_MANDATE_TYPE: mandate_type must be ANY_ONE or ALL_HOLDERS'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_type';
        END IF;
        IF p_mandate ? 'required_signatories'
           AND (jsonb_typeof(p_mandate -> 'required_signatories') <> 'number'
                OR (p_mandate ->> 'required_signatories') !~ '^[0-9]{1,2}$') THEN
            RAISE EXCEPTION 'INVALID_MANDATE_SIGNATORIES: required_signatories must be a whole number from 1 to 4'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_signatories_fit';
        END IF;
        v_signatories := COALESCE(
            (p_mandate ->> 'required_signatories')::INT,
            CASE v_mandate_type WHEN 'ANY_ONE' THEN 1 WHEN 'ALL_HOLDERS' THEN v_holder_count END);
    ELSIF p_mandate IS NOT NULL THEN
        RAISE EXCEPTION 'MANDATE_NOT_ALLOWED: plan % is a single-holder plan', v_plan.plan_name
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_multi_holder_plan';
    END IF;

    -- ── Initial deposit (optional) ─────────────────────────────────────────────────────
    IF p_initial_deposit IS NOT NULL AND p_initial_deposit <> 0 THEN
        IF p_initial_deposit < 0
           OR p_initial_deposit >= 10000000000000
           OR p_initial_deposit <> round(p_initial_deposit, 2) THEN
            RAISE EXCEPTION 'INVALID_DEPOSIT_AMOUNT: the initial deposit must be positive with at most two decimals'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_deposit';
        END IF;
        v_deposit := p_initial_deposit;

        IF v_deposit < v_plan.min_balance THEN
            RAISE EXCEPTION 'BELOW_MINIMUM_BALANCE: initial deposit % is below the plan minimum %',
                v_deposit, v_plan.min_balance
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_minimum_balance';
        END IF;

        -- BR-08: a deposit is only accepted in business hours (M1's fn_is_business_hour reads
        -- business_calendar, then the BUSINESS_HOUR_* parameters). Opening with no deposit is
        -- not a posting, so it is not time-restricted. sp_post_deposit (Phase 3) will own this
        -- check for every other deposit.
        IF NOT fn_is_business_hour(now()) THEN
            RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS: an initial deposit can only be taken during business hours'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_business_hours';
        END IF;

        IF p_channel_id IS NULL THEN
            RAISE EXCEPTION 'CHANNEL_REQUIRED: a transaction channel is required for an initial deposit'
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_channel';
        END IF;
        PERFORM 1 FROM transaction_channel WHERE channel_id = p_channel_id AND status = 'ACTIVE';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'CHANNEL_NOT_FOUND: transaction channel % does not exist or is not active', p_channel_id
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_open_account_channel';
        END IF;
    END IF;

    -- ── Writes ─────────────────────────────────────────────────────────────────────────
    p_account_number := fn_next_account_number(v_branch_code);

    INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, current_balance)
    VALUES (p_plan_id, p_branch_id, p_opened_by_agent_id, p_account_number, 0)
    RETURNING account_id INTO p_account_id;

    -- All holders in ONE statement: trg_validate_joint_mandate checks the whole set (0242).
    INSERT INTO account_holder (account_id, customer_id, holder_type)
    SELECT p_account_id, h.customer_id, h.holder_type
      FROM jsonb_to_recordset(p_holders) AS h(customer_id UUID, holder_type TEXT);

    IF v_plan.max_holders > 1 THEN
        INSERT INTO joint_mandate (account_id, mandate_type, required_signatories)
        VALUES (p_account_id, v_mandate_type, v_signatories)
        RETURNING mandate_id INTO v_mandate_id;

        -- joint_mandate has no audit trigger yet (M1 follow-up), so record it here.
        INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
        VALUES (p_actor_user_id, 'USER', 'joint_mandate', v_mandate_id, 'INSERT',
                jsonb_build_object('account_id', p_account_id,
                                   'mandate_type', v_mandate_type,
                                   'required_signatories', v_signatories));
    END IF;

    IF v_deposit IS NOT NULL THEN
        v_reference := 'OPEN-' || p_account_number;

        -- balance_after (G-14, column added in 0361): the account is brand new and empty, so its balance
        -- after this first deposit is the deposit. The ledger is immutable, so a row written without it
        -- could never be corrected later; RPT-02 (vw_rpt02_account_summary) relies on it.
        INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
                                 transaction_type, amount, balance_after, narration)
        VALUES (p_account_id, p_actor_user_id, p_channel_id, v_reference,
                'DEPOSIT', v_deposit, v_deposit, 'Initial deposit on account opening')
        RETURNING transaction_id INTO v_transaction_id;

        -- Ledger first, then the balance, in the same transaction: they cannot disagree.
        UPDATE account
           SET current_balance = current_balance + v_deposit
         WHERE account_id = p_account_id;

        INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, new_values)
        VALUES (p_actor_user_id, 'USER', 'transaction', v_transaction_id, 'INSERT',
                jsonb_build_object('account_id', p_account_id,
                                   'transaction_type', 'DEPOSIT',
                                   'amount', v_deposit,
                                   'reference_number', v_reference));
    END IF;

    SELECT current_balance INTO p_current_balance FROM account WHERE account_id = p_account_id;
END;
$sp$;

COMMENT ON PROCEDURE sp_open_savings_account(UUID, UUID, UUID, JSONB, JSONB, NUMERIC, UUID, UUID) IS
    'Atomic account opening: validates plan, agent, holders, eligibility, documents, mandate and deposit; then writes account, holders (one statement), mandate and optional initial deposit (with balance_after). Caller owns the transaction. Errors: see header of migration 0243.';

COMMIT;
