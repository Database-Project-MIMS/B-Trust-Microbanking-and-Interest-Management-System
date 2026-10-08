-- Migration: 0542_p05_m03_transaction_ledger_seq.sql
-- Task: P05-M03-T01 follow-up (RPT-02 ordering, gap G-24, ADR-0023) · Owner: Member 3 (table owner: Member 4)
-- Purpose: give every ledger row a strict posting-order key, so "the first/last row of an account in a range"
--          never depends on timestamps.
--
-- Why timestamps are not enough:
--   * sp_post_deposit / sp_open_savings_account stamp transaction_date with now(), the transaction's START
--     time, while sp_post_withdrawal uses clock_timestamp(). Two deposits posted in one transaction (the seed
--     does this) get the same timestamp; a deposit that waits for the account lock behind a later-starting
--     transaction gets an EARLIER timestamp than the row posted before it.
--   * Measured on the pure seed: 73 of 125 rows tie, the balance chain breaks 86 times when ordered by
--     (transaction_date, transaction_id), and 6 of 10 accounts' "last row" disagrees with current_balance.
--
-- The key: ledger_seq, drawn from transaction_ledger_seq by the column DEFAULT at INSERT time. Every posting
-- routine locks the account row before it inserts, so within one account the sequence order IS the posting
-- order (gaps after a rollback are expected and harmless). No posting routine changes: they name their
-- columns and omit ledger_seq, so the default applies.
--
-- Existing rows: ALTER TABLE ... ADD COLUMN with a volatile DEFAULT rewrites the table and evaluates the
-- default once per row in physical (insertion) order, so history is numbered in the order it was written. A
-- rewrite does not fire row triggers, so the immutability trigger (trg_financial_transaction_immutable) is not
-- involved and is not disabled. The ledger is append-only, so physical order equals insertion order.
--
-- UNIQUE (account_id, ledger_seq): a database-enforced strict order per account that also serves the ordered
-- per-account lookups the report makes. The existing ix_transaction_account_date stays for statements.
-- The sequence is NO CYCLE (bigint). mims_app needs USAGE because the default runs with the inserting role.

BEGIN;

CREATE SEQUENCE transaction_ledger_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

ALTER TABLE transaction
    ADD COLUMN ledger_seq bigint NOT NULL DEFAULT nextval('transaction_ledger_seq');

CREATE UNIQUE INDEX ux_transaction_account_ledger_seq ON transaction (account_id, ledger_seq);

GRANT USAGE ON SEQUENCE transaction_ledger_seq TO mims_app;

COMMENT ON COLUMN transaction.ledger_seq IS
    'Posting order of the ledger row, from transaction_ledger_seq at INSERT. Within one account (rows are written under the account row lock) a larger value was posted later, regardless of transaction_date. Not shown to users. Gaps are normal.';

COMMIT;
