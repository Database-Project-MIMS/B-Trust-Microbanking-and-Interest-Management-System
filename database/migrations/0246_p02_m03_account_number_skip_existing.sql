-- Migration: 0246_p02_m03_account_number_skip_existing.sql
-- Task: P03-M03-T02 review fix · Owner: Member 3 (0243 follow-up; 0243 is merged and not edited)
-- Problem: account_number_seq starts at 1, but the deterministic seed (database/seed/10_accounts.sql)
--          inserts BR-COL-00000001..5 etc. directly. On a freshly seeded database the first
--          sp_open_savings_account at a seeded branch drew BR-COL-00000001 and failed with
--          uq_account_account_number (5 tests in sp-open-savings-account.test.mjs).
-- Fix: fn_next_account_number draws from the sequence until the number is unused. SECURITY DEFINER
--      with a fixed search_path so row-level security cannot hide an existing account from the check;
--      the signature, return type and format are unchanged. The unique constraint stays the last
--      line of defence against a concurrent insert of the same literal number.

BEGIN;

CREATE OR REPLACE FUNCTION fn_next_account_number(p_branch_code VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_number VARCHAR;
BEGIN
    IF p_branch_code IS NULL OR btrim(p_branch_code) = '' THEN
        RAISE EXCEPTION 'A branch code is required to generate an account number'
            USING ERRCODE = 'P0001', CONSTRAINT = 'ck_account_number_branch_code';
    END IF;

    LOOP
        v_number := upper(btrim(p_branch_code)) || '-' || lpad(nextval('account_number_seq')::text, 8, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM account WHERE account_number = v_number);
    END LOOP;

    RETURN v_number;
END;
$fn$;

COMMIT;
