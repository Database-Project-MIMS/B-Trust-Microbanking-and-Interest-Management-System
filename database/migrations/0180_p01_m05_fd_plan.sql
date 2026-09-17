-- Migration 0180: FD product schema (M5)
-- Table: fd_plan — three fixed deposit products (BR-13)

BEGIN;

CREATE TABLE fd_plan (
    fd_plan_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name      varchar(100) NOT NULL UNIQUE,
    tenure_months  int NOT NULL CHECK (tenure_months > 0),
    interest_rate  numeric(6,4) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 1),
    description    varchar(255),
    status         varchar(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'INACTIVE')),
    effective_from date DEFAULT CURRENT_DATE,
    effective_to   date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz,
    CONSTRAINT chk_fd_plan_effective_dates 
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Seed the three BR-13 products
INSERT INTO fd_plan (plan_name, tenure_months, interest_rate, description)
VALUES
    ('6 Month FD',  6,  0.1300, 'Fixed deposit — 6-month tenure at 13% per annum'),
    ('1 Year FD',   12, 0.1400, 'Fixed deposit — 12-month tenure at 14% per annum'),
    ('3 Year FD',   36, 0.1500, 'Fixed deposit — 36-month tenure at 15% per annum');

COMMIT;
