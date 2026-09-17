BEGIN;

CREATE TABLE agent (
    agent_id UUID PRIMARY KEY,
    branch_id UUID NOT NULL,
    employee_no VARCHAR(30) NOT NULL,
    nic_passport_no VARCHAR(50) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    email VARCHAR(150) NOT NULL,
    hired_date DATE NOT NULL,
    status record_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_agent_app_user
        FOREIGN KEY (agent_id)
        REFERENCES app_user(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_agent_branch
        FOREIGN KEY (branch_id)
        REFERENCES branch(branch_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_agent_employee_no
        UNIQUE (employee_no),

    CONSTRAINT uq_agent_nic_passport_no
        UNIQUE (nic_passport_no),

    CONSTRAINT uq_agent_email
        UNIQUE (email)
);

CREATE INDEX ix_agent_branch_status
    ON agent (branch_id, status);

CREATE OR REPLACE FUNCTION fn_validate_agent_active_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        PERFORM 1
        FROM branch
        WHERE branch_id = NEW.branch_id
          AND status = 'ACTIVE'
        FOR KEY SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'An active agent must belong to an active branch'
                USING
                    ERRCODE = '23514',
                    CONSTRAINT = 'ck_agent_active_branch';
        END IF;
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_validate_agent_active_branch
BEFORE INSERT OR UPDATE OF branch_id, status
ON agent
FOR EACH ROW
EXECUTE FUNCTION fn_validate_agent_active_branch();

CREATE OR REPLACE FUNCTION fn_prevent_branch_deactivation_with_active_agents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF OLD.status = 'ACTIVE'
       AND NEW.status <> 'ACTIVE'
       AND EXISTS (
           SELECT 1
           FROM agent
           WHERE branch_id = NEW.branch_id
             AND status = 'ACTIVE'
       )
    THEN
        RAISE EXCEPTION
            'A branch with active agents cannot be deactivated'
            USING
                ERRCODE = '23514',
                CONSTRAINT = 'ck_branch_no_active_agents';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_branch_prevent_deactivation_with_active_agents
BEFORE UPDATE OF status
ON branch
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_branch_deactivation_with_active_agents();

CREATE TRIGGER trg_agent_set_updated_at
BEFORE UPDATE
ON agent
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE agent IS
    'Banking-agent profile. Each row is a subtype of app_user and belongs to one branch.';

COMMENT ON COLUMN agent.agent_id IS
    'Shared primary key referencing the agent app_user login.';

COMMENT ON COLUMN agent.employee_no IS
    'Unique employee identifier assigned by B-Trust.';

COMMENT ON COLUMN agent.status IS
    'Operational status: ACTIVE, INACTIVE, or SUSPENDED.';

COMMIT;