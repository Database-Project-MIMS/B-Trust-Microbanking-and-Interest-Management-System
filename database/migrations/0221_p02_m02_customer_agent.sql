-- P02-M02-T02 · M2 · FR-CUS-02/03, G-10 · L05 keys/checks, L10 partial index.
BEGIN;

CREATE TABLE customer_agent (
    cust_agent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    assigned_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_customer_agent_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_agent_agent FOREIGN KEY (agent_id)
        REFERENCES agent(agent_id) ON DELETE RESTRICT,
    CONSTRAINT ck_customer_agent_dates
        CHECK (end_date IS NULL OR end_date >= assigned_date)
);

CREATE UNIQUE INDEX ux_customer_agent_one_active
    ON customer_agent(customer_id) WHERE is_active;
-- The partial index excludes history; this index serves full customer history/FK lookup.
CREATE INDEX ix_customer_agent_customer ON customer_agent(customer_id);
-- Serves agent-assignment lists and restrictive agent FK checks.
CREATE INDEX ix_customer_agent_agent ON customer_agent(agent_id);

CREATE TRIGGER trg_customer_agent_set_updated_at
BEFORE UPDATE ON customer_agent
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE customer_agent IS
    'Effective-dated customer assignment history. Registration/reassignment supplies one current assignment.';
COMMENT ON INDEX ux_customer_agent_one_active IS
    'At most one active assignment per customer, including concurrent writes (G-10).';

-- Runner owns schema_migration filename/checksum recording; scoped grants/RLS are M1 work.
COMMIT;
