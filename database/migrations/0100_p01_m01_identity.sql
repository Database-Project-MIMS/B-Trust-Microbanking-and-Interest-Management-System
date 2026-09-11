BEGIN;

create table role (
    role_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name     varchar(50) NOT NULL UNIQUE,
    description   varchar(255),
    status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz
);

create table app_user (
    user_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         uuid NOT NULL REFERENCES role(role_id) ON DELETE RESTRICT,
    username        varchar(100) NOT NULL UNIQUE,
    password_hash   varchar(255) NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    registered_date date NOT NULL DEFAULT CURRENT_DATE,
    last_login      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz
    
);
CREATE INDEX ix_app_user_role_status ON app_user(role_id, status);

create table user_session (
    session_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    token_hash   varchar(255) NOT NULL UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,
    ip_address   varchar(45),
    user_agent   varchar(500)
);

CREATE TABLE login_attempt (
    attempt_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username_attempted  varchar(100) NOT NULL,
    success             boolean NOT NULL,
    ip_address          varchar(45),
    attempted_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_login_attempt_user_time
    ON login_attempt(username_attempted, attempted_at DESC);

COMMIT;