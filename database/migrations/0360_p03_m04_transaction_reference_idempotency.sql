-- Migration 0360: Transaction Reference Number and Idempotency Indexes (M4)
-- Task: P03-M04-T01 (G-04, G-05, BR-10, FR-DEP-02, FR-DEP-04, ADR-0010)
--
-- 1. Sequence & generator function for unique reference numbers (TXN-YYYYMMDD-XXXXXXXX)
-- 2. Enforce UNIQUE NOT NULL on transaction.reference_number (G-05, OQ-08 resolved by ADR-0010)
-- 3. Add transaction.idempotency_key with partial unique index (G-04, FR-DEP-04)

BEGIN;

-- Sequence for unique transaction reference numbers across the system
CREATE SEQUENCE transaction_reference_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Function generating formatted transaction reference numbers
CREATE OR REPLACE FUNCTION fn_next_transaction_reference()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq bigint;
BEGIN
    v_seq := nextval('transaction_reference_seq');
    RETURN 'TXN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_seq::text, 8, '0');
END;
$$;

-- reference_number was created NOT NULL in 0260; enforce UNIQUE
ALTER TABLE transaction
    ADD CONSTRAINT ux_transaction_reference UNIQUE (reference_number);

-- Add client-supplied idempotency key (nullable for seeded and interest credit runs)
ALTER TABLE transaction
    ADD COLUMN idempotency_key varchar(80);

-- Partial unique index ensures client retries are deduplicated without restricting multiple NULLs
CREATE UNIQUE INDEX ux_transaction_idempotency
    ON transaction (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Permissions for mims_app role
GRANT USAGE ON SEQUENCE transaction_reference_seq TO mims_app;
GRANT EXECUTE ON FUNCTION fn_next_transaction_reference() TO mims_app;

COMMIT;
