-- Migration: 0241_p02_m03_account_holder.sql
-- Task: P02-M03-T02 (G-08 / ADR-0009 holder_type) · Owner: Member 3
-- Purpose: Customer-to-account intersection that makes joint accounts possible.
-- Concepts: L02 intersection entity, L03 keys, L05 constraints, L10 partial unique index.
-- The 2-4 adult holder count rule spans rows and is enforced by
-- trg_validate_joint_mandate (P02-M03-T03) and sp_open_savings_account (P02-M03-T04).

BEGIN;

CREATE TABLE account_holder (
    account_holder_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id        UUID         NOT NULL,
    customer_id       UUID         NOT NULL,
    holder_type       VARCHAR(20)  NOT NULL DEFAULT 'PRIMARY',
    joined_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_account_holder_account
        FOREIGN KEY (account_id)
        REFERENCES account(account_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_account_holder_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
        ON DELETE RESTRICT,

    -- BR-02: the same customer cannot be added twice to one account.
    CONSTRAINT uq_account_holder_account_customer
        UNIQUE (account_id, customer_id),

    CONSTRAINT ck_account_holder_type
        CHECK (holder_type IN ('PRIMARY', 'JOINT'))
);

-- Every account has at most one PRIMARY holder (the applicant); the rest are JOINT.
CREATE UNIQUE INDEX uq_account_holder_one_primary
    ON account_holder (account_id)
    WHERE holder_type = 'PRIMARY';

-- "My accounts" and customer-scoped reads (BR-S3, RPT-05).
CREATE INDEX ix_account_holder_customer
    ON account_holder (customer_id);

COMMENT ON TABLE account_holder IS
    'Customer-account intersection. Individual accounts have one PRIMARY holder; joint accounts add JOINT holders (ADR-0009).';

COMMENT ON COLUMN account_holder.holder_type IS
    'PRIMARY (the applicant, exactly one per account) or JOINT (additional holder). Holder count and adult rule: trg_validate_joint_mandate.';

COMMENT ON INDEX uq_account_holder_one_primary IS
    'Partial unique index: at most one PRIMARY holder per account.';

COMMENT ON INDEX ix_account_holder_customer IS
    'Customer-to-accounts lookup for "my accounts", RLS and reports.';

COMMIT;
