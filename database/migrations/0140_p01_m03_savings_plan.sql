BEGIN;

-- CREATING SAVINGS PLANS TABLE

CREATE TABLE savings_plan (
    plan_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name           varchar(100) NOT NULL UNIQUE,
    interest_rate       interest_rate NOT NULL,
    min_balance         money_amount NOT NULL DEFAULT 0,
    description         varchar(255),
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    min_age_years       int,
    max_age_years       int,
    min_holders         int NOT NULL DEFAULT 1,
    max_holders         int NOT NULL DEFAULT 1,
    requires_all_adult  boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz,
    CONSTRAINT chk_savings_plan_age_range
        CHECK (max_age_years IS NULL OR min_age_years IS NULL OR max_age_years >= min_age_years),
    CONSTRAINT chk_savings_plan_holder_range
        CHECK (max_holders >= min_holders),
    CONSTRAINT chk_savings_plan_min_balance_nonneg
        CHECK (min_balance >= 0)
);

CREATE TRIGGER trg_savings_plan_set_updated_at
    BEFORE UPDATE ON savings_plan
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Seed the five BR-03..BR-07 products
INSERT INTO savings_plan
    (plan_name, interest_rate, min_balance, description,
     min_age_years, max_age_years, min_holders, max_holders, requires_all_adult)
VALUES
    ('Children', 0.1200,    0.00, 'Savings plan for minors up to age 12',
        NULL, 12,   1, 1, false),
    ('Teen',     0.1100,  500.00, 'Savings plan for teenagers aged 13-17',
        13,   17,   1, 1, false),
    ('Adult',    0.1000, 1000.00, 'Standard savings plan for adults aged 18-59',
        18,   59,   1, 1, true),
    ('Senior',   0.1300, 1000.00, 'Savings plan for seniors aged 60 and above',
        60,   NULL, 1, 1, true),
    ('Joint',    0.0700, 5000.00, 'Joint savings plan for 2-4 adult holders',
        NULL, NULL, 2, 4, true);

COMMIT;