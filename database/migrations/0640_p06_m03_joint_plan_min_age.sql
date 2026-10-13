-- Joint plan: every holder must be an adult (requires_all_adult = true), so the plan's own
-- age data now says so. 0140 seeded min_age_years as NULL, which read as "no lower bound" and
-- let an under-18 primary pass fn_check_plan_eligibility before trg_validate_joint_mandate
-- rejected them later. No upper bound: any adult may open or join a Joint account.
BEGIN;

UPDATE savings_plan SET min_age_years = 18 WHERE plan_name = 'Joint';

COMMIT;
