BEGIN;

CREATE TABLE branch (
    branch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_code VARCHAR(20) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status record_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_branch_branch_code UNIQUE (branch_code)
);

CREATE TRIGGER trg_branch_set_updated_at
BEFORE UPDATE ON branch
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE branch IS
    'B-Trust branch master data. Referenced branches are deactivated rather than deleted.';

COMMENT ON COLUMN branch.branch_code IS
    'Unique business identifier assigned to a branch.';

COMMENT ON COLUMN branch.status IS
    'Branch lifecycle status: ACTIVE, INACTIVE, or SUSPENDED.';

COMMIT;