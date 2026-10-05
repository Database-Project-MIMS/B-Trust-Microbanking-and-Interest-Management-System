-- Migration: 0220_p02_m02_customer.sql
-- Task: P02-M02-T01 · Owner: Member 2 (Vibodha)
-- Purpose: Independent customer identity with optional self-service login (ADR-0007).
-- Requirements: FR-CUS-01/02/04, FR-ACC-02, SRS 6.7; G-20 approved.
-- Concepts: L03 DDL/keys, L05 constraints, L08 timestamps, L10 B-tree/GIN indexes.

BEGIN;

CREATE TABLE customer (
    customer_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id     uuid,
    branch_id       uuid NOT NULL,
    customer_number varchar(30) NOT NULL,
    nic_passport_no varchar(50) NOT NULL,
    full_name       varchar(150) NOT NULL,
    date_of_birth   date NOT NULL,
    gender          varchar(20),
    phone           varchar(20),
    address         varchar(255),
    email           varchar(150) NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_customer_app_user_id UNIQUE (app_user_id),
    CONSTRAINT uq_customer_number UNIQUE (customer_number),
    CONSTRAINT uq_customer_nic_passport_no UNIQUE (nic_passport_no),
    CONSTRAINT uq_customer_email UNIQUE (email),
    CONSTRAINT fk_customer_app_user FOREIGN KEY (app_user_id)
        REFERENCES app_user(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_branch FOREIGN KEY (branch_id)
        REFERENCES branch(branch_id) ON DELETE RESTRICT,
    CONSTRAINT ck_customer_birth_date_past CHECK (date_of_birth < CURRENT_DATE),
    CONSTRAINT ck_customer_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TRIGGER trg_customer_set_updated_at
BEFORE UPDATE ON customer
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Serves branch-scoped customer lists and branch FK checks (FR-CUS-02).
CREATE INDEX ix_customer_branch ON customer(branch_id);

-- pg_trgm is supplied by foundation 0000. Supports fuzzy (%) and ILIKE name search.
CREATE INDEX ix_customer_full_name_trgm
ON customer USING gin (full_name gin_trgm_ops);

COMMENT ON TABLE customer IS
    'Agent-managed customer identity. Optional login is linked without replacing customer_id (ADR-0007).';
COMMENT ON COLUMN customer.app_user_id IS
    'Nullable unique login link; customer registration never requires credentials.';
COMMENT ON COLUMN customer.customer_number IS
    'Unique customer business identifier assigned by the registration workflow.';
COMMENT ON INDEX ix_customer_branch IS
    'Branch-scoped customer list/search and branch foreign-key lookup.';
COMMENT ON INDEX ix_customer_full_name_trgm IS
    'GIN trigram support for fuzzy and substring full_name search (FR-CUS-04, L10).';

-- scripts/migrate.mjs records filename/checksum in schema_migration.
-- Runtime grants/RLS/audit binding are M1 Phase 2 tasks; no broad grants here.
COMMIT;
