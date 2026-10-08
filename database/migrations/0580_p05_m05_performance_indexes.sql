BEGIN;

CREATE INDEX ix_payout_cycle ON interest_payout (cycle_date);

-- Rename existing indexes to match the exact spec requirements
ALTER INDEX ix_transaction_account_date RENAME TO ix_txn_account_date;
ALTER INDEX ix_transaction_agent_date RENAME TO ix_txn_agent_date;

COMMIT;
