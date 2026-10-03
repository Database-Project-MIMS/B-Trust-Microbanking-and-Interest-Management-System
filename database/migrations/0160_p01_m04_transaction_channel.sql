BEGIN;

CREATE TABLE transaction_channel (
    channel_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name  varchar(100) NOT NULL UNIQUE,
    status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO transaction_channel (channel_name)
VALUES ('BRANCH_COUNTER'), ('ONLINE'), ('SYSTEM');

-- grant to the main app role
GRANT SELECT, INSERT ON transaction_channel TO mims_app;

COMMIT;