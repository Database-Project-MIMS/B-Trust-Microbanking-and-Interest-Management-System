-- Migration: 0242_p02_m03_joint_mandate.sql
-- Task: P02-M03-T03 (G-08 / ADR-0009 joint mandate) · Owner: Member 3
-- Purpose: Stored operating mandate for joint accounts, plus the cross-row holder rules
--          that no row-level CHECK can express (holder count, one PRIMARY, adult holders).
-- Concepts: L02 entity, L05 constraints, L08 statement-level triggers with transition
--           tables, L11 locking (lock before you decide).
-- All eligibility numbers come from savings_plan columns (0140); nothing branches on plan_name.
--
-- Contract for P02-M03-T04: insert ALL holders of an account in ONE multi-row INSERT, then
-- the mandate. The holder trigger fires once per statement and sees the whole holder set.
-- Adding a holder later keeps an ALL_HOLDERS mandate in step with the holder count.

BEGIN;

CREATE TABLE joint_mandate (
    mandate_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id           UUID         NOT NULL,
    mandate_type         VARCHAR(20)  NOT NULL,
    required_signatories INT          NOT NULL DEFAULT 1,
    effective_from       DATE         NOT NULL DEFAULT CURRENT_DATE,
    effective_to         DATE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_joint_mandate_account
        FOREIGN KEY (account_id)
        REFERENCES account(account_id)
        ON DELETE RESTRICT,

    -- One effective mandate per account (ADR-0009).
    CONSTRAINT uq_joint_mandate_account
        UNIQUE (account_id),

    CONSTRAINT ck_joint_mandate_type
        CHECK (mandate_type IN ('ANY_ONE', 'ALL_HOLDERS')),

    -- A joint account has at most four holders, so no mandate can need more signatures.
    CONSTRAINT ck_joint_mandate_signatories_range
        CHECK (required_signatories BETWEEN 1 AND 4),

    -- ADR-0009: ANY_ONE means exactly one signatory.
    CONSTRAINT ck_joint_mandate_any_one_single
        CHECK (mandate_type <> 'ANY_ONE' OR required_signatories = 1),

    CONSTRAINT ck_joint_mandate_effective_range
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER trg_joint_mandate_set_updated_at
BEFORE UPDATE
ON joint_mandate
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------------------
-- Holder rules. One checker, called by the INSERT and UPDATE triggers on account_holder.
--
-- SECURITY DEFINER: the counts must see every holder and customer of the account, not only
-- the rows the calling role's row-level security lets it read. EXECUTE is revoked from
-- PUBLIC, so only the owner (and so the trigger wrappers below) can call it.
--
-- Lock before you decide (AGENTS 11): the account rows are locked FOR NO KEY UPDATE, in id
-- order, before counting. Two concurrent statements adding holders to one account are
-- serialised, so the second counts after the first has committed. NO KEY UPDATE does not
-- conflict with the FOR KEY SHARE lock a foreign-key check takes, so it cannot deadlock
-- against the holder INSERT itself.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_account_holder_sets(p_account_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    r RECORD;
BEGIN
    PERFORM 1
       FROM account
      WHERE account_id = ANY (p_account_ids)
      ORDER BY account_id
        FOR NO KEY UPDATE;

    FOR r IN
        SELECT a.account_id,
               sp.min_holders,
               sp.max_holders,
               sp.requires_all_adult,
               (SELECT count(*)
                  FROM account_holder ah
                 WHERE ah.account_id = a.account_id)                          AS holder_count,
               (SELECT count(*)
                  FROM account_holder ah
                 WHERE ah.account_id = a.account_id
                   AND ah.holder_type = 'PRIMARY')                            AS primary_count,
               (SELECT count(*)
                  FROM account_holder ah
                  JOIN customer c ON c.customer_id = ah.customer_id
                 WHERE ah.account_id = a.account_id
                   AND c.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date) AS underage_count
          FROM account a
          JOIN savings_plan sp ON sp.plan_id = a.plan_id
         WHERE a.account_id = ANY (p_account_ids)
         ORDER BY a.account_id
    LOOP
        IF r.holder_count < r.min_holders OR r.holder_count > r.max_holders THEN
            RAISE EXCEPTION 'INVALID_HOLDER_COUNT: account % has % holder(s), plan allows % to %',
                r.account_id, r.holder_count, r.min_holders, r.max_holders
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_holder_count';
        END IF;

        IF r.primary_count <> 1 THEN
            RAISE EXCEPTION 'MISSING_PRIMARY_HOLDER: account % has % PRIMARY holder(s), exactly one is required',
                r.account_id, r.primary_count
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_holder_one_primary';
        END IF;

        IF r.requires_all_adult AND r.underage_count > 0 THEN
            RAISE EXCEPTION 'UNDERAGE_HOLDER: account % has % holder(s) under 18 and its plan requires adult holders',
                r.account_id, r.underage_count
                USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_holder_adult';
        END IF;

        -- ADR-0009: ALL_HOLDERS needs one signatory per holder. Keep the stored mandate in
        -- step when the holder set changes, so it can never go stale (ANY_ONE is always 1).
        UPDATE joint_mandate
           SET required_signatories = r.holder_count
         WHERE account_id = r.account_id
           AND mandate_type = 'ALL_HOLDERS'
           AND required_signatories <> r.holder_count;
    END LOOP;
END;
$fn$;

-- Trigger wrappers. Transition tables allow only one event per trigger and no column list,
-- so INSERT and UPDATE each get a trigger. UPDATE also re-checks the account a holder left.
CREATE OR REPLACE FUNCTION fn_trg_account_holder_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    PERFORM fn_check_account_holder_sets(ARRAY(SELECT DISTINCT account_id FROM new_holders));
    RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION fn_trg_account_holder_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    PERFORM fn_check_account_holder_sets(ARRAY(
        SELECT account_id FROM new_holders
        UNION
        SELECT account_id FROM old_holders));
    RETURN NULL;
END;
$fn$;

CREATE TRIGGER trg_validate_joint_mandate
AFTER INSERT
ON account_holder
REFERENCING NEW TABLE AS new_holders
FOR EACH STATEMENT
EXECUTE FUNCTION fn_trg_account_holder_inserted();

CREATE TRIGGER trg_validate_joint_mandate_update
AFTER UPDATE
ON account_holder
REFERENCING OLD TABLE AS old_holders NEW TABLE AS new_holders
FOR EACH STATEMENT
EXECUTE FUNCTION fn_trg_account_holder_updated();

-- ---------------------------------------------------------------------------------------
-- Mandate rules: the mandate must fit the account it governs.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_joint_mandate_fit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_max_holders  INT;
    v_holder_count INT;
BEGIN
    -- Same lock as the holder check, so a mandate write and a holder change cannot interleave.
    PERFORM 1 FROM account WHERE account_id = NEW.account_id FOR NO KEY UPDATE;

    SELECT sp.max_holders
      INTO v_max_holders
      FROM account a
      JOIN savings_plan sp ON sp.plan_id = a.plan_id
     WHERE a.account_id = NEW.account_id;

    IF v_max_holders IS NULL OR v_max_holders < 2 THEN
        RAISE EXCEPTION 'MANDATE_NOT_ALLOWED: account % is on a single-holder plan and cannot have a joint mandate',
            NEW.account_id
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_multi_holder_plan';
    END IF;

    SELECT count(*)
      INTO v_holder_count
      FROM account_holder
     WHERE account_id = NEW.account_id;

    IF NEW.required_signatories > v_holder_count THEN
        RAISE EXCEPTION 'INVALID_MANDATE_SIGNATORIES: % signatories required but account % has % holder(s)',
            NEW.required_signatories, NEW.account_id, v_holder_count
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_signatories_fit';
    END IF;

    IF NEW.mandate_type = 'ALL_HOLDERS' AND NEW.required_signatories <> v_holder_count THEN
        RAISE EXCEPTION 'INVALID_MANDATE_SIGNATORIES: ALL_HOLDERS needs % signatories (one per holder), got %',
            v_holder_count, NEW.required_signatories
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_joint_mandate_signatories_fit';
    END IF;

    RETURN NULL;
END;
$fn$;

CREATE TRIGGER trg_joint_mandate_fit
AFTER INSERT OR UPDATE OF account_id, mandate_type, required_signatories
ON joint_mandate
FOR EACH ROW
EXECUTE FUNCTION fn_validate_joint_mandate_fit();

-- Definer functions are never callable by application roles; only the triggers run them.
REVOKE EXECUTE ON FUNCTION fn_check_account_holder_sets(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_trg_account_holder_inserted() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_trg_account_holder_updated() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_validate_joint_mandate_fit() FROM PUBLIC;

COMMENT ON TABLE joint_mandate IS
    'Operating mandate of a joint account: ANY_ONE or ALL_HOLDERS, one per account (ADR-0009, G-08). Read by the withdrawal path in Phase 3 (BR-17).';

COMMENT ON COLUMN joint_mandate.required_signatories IS
    'ANY_ONE: always 1. ALL_HOLDERS: always the current holder count (kept in step by the holder trigger).';

COMMENT ON FUNCTION fn_check_account_holder_sets(UUID[]) IS
    'Locks the accounts, then checks holder count within the plan min/max, exactly one PRIMARY, no holder under 18 when the plan requires adults, and syncs ALL_HOLDERS signatories. Data-driven from savings_plan.';

COMMENT ON FUNCTION fn_validate_joint_mandate_fit() IS
    'A mandate is only valid on a multi-holder plan, with signatories not exceeding holders; ALL_HOLDERS equals the holder count.';

COMMIT;
