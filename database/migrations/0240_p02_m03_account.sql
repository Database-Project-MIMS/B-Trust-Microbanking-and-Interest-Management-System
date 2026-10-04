-- Migration: 0240_p02_m03_account.sql
-- Task: P02-M03-T01 (G-06 / ADR-0008 owning branch, G-18 non-negative balance)
BEGIN;

CREATE TABLE account (
    account_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id            UUID          NOT NULL,
    branch_id          UUID          NOT NULL,
    opened_by_agent_id UUID          NOT NULL,
    account_number     VARCHAR(50)   NOT NULL,
    opened_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    current_balance    money_amount  NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT fk_account_plan
        FOREIGN KEY (plan_id)
        REFERENCES savings_plan(plan_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_account_branch
        FOREIGN KEY (branch_id)
        REFERENCES branch(branch_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_account_opened_by_agent
        FOREIGN KEY (opened_by_agent_id)
        REFERENCES agent(agent_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_account_account_number
        UNIQUE (account_number),

    CONSTRAINT ck_account_status
        CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),

    -- G-18: last line of defence behind row locking in the posting routines.
    CONSTRAINT ck_account_balance_non_negative
        CHECK (current_balance >= 0)
);

CREATE INDEX ix_account_plan
    ON account (plan_id);

-- ADR-0008: supports branch-scoped (and RLS) access to active accounts.
CREATE INDEX ix_account_branch_status
    ON account (branch_id, status);

CREATE INDEX ix_account_status
    ON account (status);

-- ADR-0008 / D-4: the owning branch is a snapshot taken at opening. It must not
-- move when the opening agent transfers branch, so no UPDATE may change it.
CREATE OR REPLACE FUNCTION fn_prevent_account_branch_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        RAISE EXCEPTION
            'The owning branch of an account is fixed at opening and cannot change'
            USING
                ERRCODE = '23514',
                CONSTRAINT = 'ck_account_branch_immutable';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_account_prevent_branch_change
BEFORE UPDATE OF branch_id
ON account
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_account_branch_change();

CREATE TRIGGER trg_account_set_updated_at
BEFORE UPDATE
ON account
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE account IS
    'Savings account. Held by one or more customers through account_holder; balance is written only by posting routines.';

COMMENT ON COLUMN account.branch_id IS
    'Owning branch, copied from trusted branch scope at opening and never changed (ADR-0008, D-4). RLS and report anchor.';

COMMENT ON COLUMN account.current_balance IS
    'Controlled running balance (D-1). Never negative (G-18); reconciled against the ledger in Phase 5.';

COMMENT ON COLUMN account.status IS
    'ACTIVE, FROZEN or CLOSED. Closing requires zero balance and no active FD (BR-18).';

COMMIT;
