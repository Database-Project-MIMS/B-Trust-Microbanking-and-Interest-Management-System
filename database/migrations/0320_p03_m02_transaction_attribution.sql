BEGIN;

-- P03-M02-T01 / G-07, authorized by ADR-0016.
-- Posting-time snapshots: never backfill immutable history from current membership.
-- Nullable columns preserve legacy inserts and system/unattributed postings.
ALTER TABLE transaction
    ADD COLUMN agent_id uuid,
    ADD COLUMN branch_id uuid,
    ADD CONSTRAINT fk_transaction_agent
        FOREIGN KEY (agent_id) REFERENCES agent(agent_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_transaction_branch
        FOREIGN KEY (branch_id) REFERENCES branch(branch_id) ON DELETE RESTRICT;

-- Equality on agent/branch followed by a business-timestamp range (RPT-01, SRS 6.7).
-- transaction_date is the existing ledger timestamp; there is no posted_at column.
CREATE INDEX ix_transaction_agent_date ON transaction (agent_id, transaction_date);
CREATE INDEX ix_transaction_branch_date ON transaction (branch_id, transaction_date);

COMMENT ON COLUMN transaction.agent_id IS
    'Reporting agent captured at posting time; NULL means legacy, system, or unattributed. Never infer history from current agent membership.';
COMMENT ON COLUMN transaction.branch_id IS
    'Operating branch captured at posting time; NULL means attribution was not captured. Independent of current agent membership.';

-- scripts/migrate.mjs records the filename and checksum in the same transaction.
-- Existing INSERT column lists, grants, RLS, and the immutability trigger are retained.
COMMIT;
