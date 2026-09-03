-- =============================================================================
-- 0000_p00_shared_foundation.sql
-- Phase 0 · shared foundation · owner: integration lead
--
-- This migration contains ONLY infrastructure every member depends on.
-- It deliberately creates NO business table. Business tables begin in Phase 1
-- inside each member's reserved migration block (see AGENTS.md §12).
--
-- Concepts: L03 (DDL), L05 (domains, constraints), L07 (application/DB boundary)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- gen_random_uuid() for surrogate primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Trigram index support for customer/account name search (Phase 2, L10).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- Migration tracking
-- -----------------------------------------------------------------------------
-- Every migration records itself here. scripts/migrate.mjs refuses to re-apply an
-- already-recorded file, and refuses to apply a file whose checksum changed
-- (a merged migration is immutable — AGENTS.md §8).
CREATE TABLE IF NOT EXISTS schema_migration (
    filename        text        PRIMARY KEY,
    checksum        text        NOT NULL,
    applied_at      timestamptz NOT NULL DEFAULT now(),
    applied_by      text        NOT NULL DEFAULT current_user
);

COMMENT ON TABLE schema_migration IS
    'Applied migration ledger. Filenames are immutable once recorded.';

-- -----------------------------------------------------------------------------
-- Shared domains — one definition of "money" and "rate" for the whole schema
-- -----------------------------------------------------------------------------
-- SRS 6.1: exact decimal only. Floating point is prohibited for financial values.
-- Domains make that impossible to get wrong on a per-table basis.

DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'money_amount') THEN
        CREATE DOMAIN money_amount AS numeric(15,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'positive_money') THEN
        CREATE DOMAIN positive_money AS numeric(15,2) CHECK (VALUE > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interest_rate') THEN
        CREATE DOMAIN interest_rate AS numeric(6,4) CHECK (VALUE >= 0 AND VALUE <= 1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status') THEN
        CREATE DOMAIN record_status AS varchar(20)
            CHECK (VALUE IN ('ACTIVE','INACTIVE','SUSPENDED'));
    END IF;
END
$do$;

COMMENT ON DOMAIN money_amount   IS 'LKR monetary value. Exact decimal, 2 places. Never float.';
COMMENT ON DOMAIN positive_money IS 'Strictly positive monetary value, for transaction amounts (DB-CON-03).';
COMMENT ON DOMAIN interest_rate  IS 'Annual rate as a fraction: 10 percent = 0.1000, 13 percent = 0.1300.';
COMMENT ON DOMAIN record_status  IS 'Standard master-record lifecycle status (FR-ORG-03).';

-- -----------------------------------------------------------------------------
-- Shared trigger function: maintain updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION set_updated_at() IS
    'BEFORE UPDATE trigger. Attach to every table carrying updated_at (DB-CON-06).';

COMMIT;
