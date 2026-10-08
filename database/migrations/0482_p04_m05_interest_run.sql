BEGIN;

CREATE TABLE interest_run (
    run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_date      date NOT NULL UNIQUE,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    status          varchar(20) NOT NULL DEFAULT 'RUNNING'
                    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    fd_count        int DEFAULT 0,
    total_interest  numeric(15,2) DEFAULT 0,
    exception_count int DEFAULT 0,
    initiated_by    uuid REFERENCES app_user(user_id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interest_payout (
    interest_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fd_id           uuid NOT NULL REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
    interest_run_id uuid NOT NULL REFERENCES interest_run(run_id) ON DELETE RESTRICT,
    transaction_id  uuid UNIQUE REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
    cycle_date      date NOT NULL,
    payout_date     date NOT NULL,
    interest_amount numeric(15,2) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: same FD cannot be paid twice for same cycle
CREATE UNIQUE INDEX uq_payout_fd_cycle
    ON interest_payout(fd_id, cycle_date);

COMMIT;
