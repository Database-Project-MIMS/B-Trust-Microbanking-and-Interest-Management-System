BEGIN;

CREATE TABLE fixed_deposit (
    fd_id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                uuid NOT NULL REFERENCES account(account_id) ON DELETE RESTRICT,
    fd_plan_id                uuid NOT NULL REFERENCES fd_plan(fd_plan_id) ON DELETE RESTRICT,
    principal_amount          numeric(15,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate_at_opening  numeric(6,4) NOT NULL CHECK (interest_rate_at_opening > 0 AND interest_rate_at_opening <= 1),
    start_date                date NOT NULL,
    maturity_date             date NOT NULL,
    next_interest_date        date NOT NULL,
    status                    varchar(20) NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE', 'MATURED', 'CLOSED')),
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz,
    CONSTRAINT chk_fd_maturity_after_start CHECK (maturity_date > start_date),
    CONSTRAINT chk_fd_next_interest_after_start CHECK (next_interest_date >= start_date)
);

-- One active FD per account (G-01, BR-12)
CREATE UNIQUE INDEX uq_one_active_fd_per_account
    ON fixed_deposit(account_id) WHERE status = 'ACTIVE';

-- FDs due for interest payout
CREATE INDEX ix_fd_due_interest
    ON fixed_deposit(status, next_interest_date) WHERE status = 'ACTIVE';

INSERT INTO schema_migration(version, name)
VALUES (480, '0480_p04_m05_fixed_deposit');

COMMIT;
