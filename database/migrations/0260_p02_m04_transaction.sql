BEGIN;

-- DEFERRED PHASE 3 COLUMNS:
-- Do not add these until their respective approval gates are cleared in Phase 3.
-- * agent_id, branch_id (G-07 - M2's task)
-- * idempotency_key (G-04)
-- * balance_after (G-14)
-- * status, reversed_by_transaction_id (G-02)

CREATE TABLE transaction (
    transaction_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id            uuid NOT NULL REFERENCES account(account_id) ON DELETE RESTRICT,
    initiated_by_user_id  uuid NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    channel_id            uuid NOT NULL REFERENCES transaction_channel(channel_id) ON DELETE RESTRICT,
    reference_number      varchar(50) NOT NULL,
    transaction_type      varchar(50) NOT NULL 
                          CHECK (transaction_type IN ('DEPOSIT','WITHDRAWAL','INTEREST_CREDIT','REVERSAL')),
    amount                numeric(15,2) NOT NULL CHECK (amount > 0),
    transaction_date      timestamptz NOT NULL DEFAULT now(),
    narration             varchar(255),
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_transaction_account_date ON transaction(account_id, transaction_date DESC);

CREATE OR REPLACE FUNCTION trg_fn_financial_transaction_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'TRANSACTION_IMMUTABLE: posted transactions cannot be updated or deleted'
        USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_financial_transaction_immutable
    BEFORE UPDATE OR DELETE ON transaction
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_financial_transaction_immutable();

-- Grant explicitly without UPDATE or DELETE permissions
GRANT SELECT, INSERT ON transaction TO mims_app;

COMMIT;