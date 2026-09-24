-- fn_check_plan_eligibility: P01-M03-T02 (M3)
-- Checks whether a primary applicant (by birth date and requested holder count)
-- qualifies for a savings plan, reading the plan's own eligibility columns
-- (migration 0140) instead of branching on plan_name. See docs/specs/0002-plan-eligibility-function.md.
--
-- Never raises: any missing plan, inactive plan, or invalid input returns false.
-- Does not check requires_all_adult for holders beyond the primary applicant —
-- that is Phase 2's trg_validate_joint_mandate (P02-M03-T03).

CREATE OR REPLACE FUNCTION fn_check_plan_eligibility(
    p_plan_id uuid,
    p_date_of_birth date,
    p_holder_count int
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
    v_status varchar(20);
    v_min_age_years int;
    v_max_age_years int;
    v_min_holders int;
    v_max_holders int;
    v_age int;
BEGIN
    IF p_date_of_birth IS NULL OR p_holder_count IS NULL OR p_holder_count <= 0 THEN
        RETURN false;
    END IF;

    SELECT status, min_age_years, max_age_years, min_holders, max_holders
    INTO v_status, v_min_age_years, v_max_age_years, v_min_holders, v_max_holders
    FROM savings_plan
    WHERE plan_id = p_plan_id;

    IF NOT FOUND OR v_status != 'ACTIVE' THEN
        RETURN false;
    END IF;

    v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_date_of_birth));

    IF v_min_age_years IS NOT NULL AND v_age < v_min_age_years THEN
        RETURN false;
    END IF;

    IF v_max_age_years IS NOT NULL AND v_age > v_max_age_years THEN
        RETURN false;
    END IF;

    IF p_holder_count < v_min_holders OR p_holder_count > v_max_holders THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$fn$;

COMMENT ON FUNCTION fn_check_plan_eligibility(uuid, date, int) IS
    'Primary-applicant eligibility check for a savings plan: age and holder-count bounds read from savings_plan, never a hardcoded plan_name branch. Returns false on any missing plan, inactive plan, or invalid input, never raises. Does not check requires_all_adult for holders beyond the primary applicant.';
