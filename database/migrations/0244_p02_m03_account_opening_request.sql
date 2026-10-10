-- Migration: 0244_p02_m03_account_opening_request.sql
-- Task: P02-M03-T05 (AGENTS 9, FR-DEP-04 pattern) · Owner: Member 3
-- Purpose: Idempotency record for POST /api/accounts. A repeated Idempotency-Key from the
--          same user returns the original account instead of opening a second one and
--          crediting a second initial deposit.
-- Concepts: L05 UNIQUE as a real guarantee, L11 atomicity (the row is written in the same
--           transaction as the account, so a failed open leaves no key behind).
-- The service takes pg_advisory_xact_lock on (user, key) before reading, so two concurrent
-- requests with one key serialise; the UNIQUE constraint is the backstop.

BEGIN;

CREATE TABLE account_opening_request (
    request_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL,
    idempotency_key VARCHAR(80)  NOT NULL,
    request_hash    CHAR(64)     NOT NULL,
    account_id      UUID         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_account_opening_request_user
        FOREIGN KEY (user_id)
        REFERENCES app_user(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_account_opening_request_account
        FOREIGN KEY (account_id)
        REFERENCES account(account_id)
        ON DELETE RESTRICT,

    -- A key is scoped to the user who sent it.
    CONSTRAINT uq_account_opening_request_user_key
        UNIQUE (user_id, idempotency_key),

    -- One request opens at most one account, and an account has one opening request.
    CONSTRAINT uq_account_opening_request_account
        UNIQUE (account_id),

    CONSTRAINT ck_account_opening_request_key_format
        CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),

    CONSTRAINT ck_account_opening_request_hash_format
        CHECK (request_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE account_opening_request IS
    'Idempotency record for account opening: (user, key) -> account, with a SHA-256 of the canonical request so a reused key with a different body is detected. Insert-only.';

COMMENT ON COLUMN account_opening_request.request_hash IS
    'SHA-256 (hex) of the canonical request body. A repeat with the same hash replays the original result; a different hash is a client error.';

COMMIT;
