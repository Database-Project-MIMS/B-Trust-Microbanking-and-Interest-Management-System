-- Migration: 0700_p07_m00_notification_outbox.sql
-- Purpose: Transactional outbox for customer e-mail notifications.
--          Ledger and account changes enqueue one row per recipient in the SAME transaction;
--          a dispatcher (services/notification-service.ts) sends them after commit.
-- Concepts: L11 triggers, L05 constraints, transactions/atomicity, row locking (SKIP LOCKED).
-- The outbox is derived data, not financial history, so its parent FKs cascade; direct deletes are rejected.
-- Rules: an enqueue failure must never roll back a financial operation (see fn_enqueue_notification).
--        The outbox holds no balances and only the last four characters of an account number.

BEGIN;

CREATE TABLE notification_outbox (
    notification_id uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      varchar(40)  NOT NULL,
    event_key       varchar(120) NOT NULL,
    customer_id     uuid         NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
    account_id      uuid         REFERENCES account(account_id) ON DELETE CASCADE,
    to_email        varchar(150) NOT NULL,
    payload         jsonb        NOT NULL DEFAULT '{}'::jsonb,
    status          varchar(20)  NOT NULL DEFAULT 'PENDING',
    attempts        integer      NOT NULL DEFAULT 0,
    next_attempt_at timestamptz  NOT NULL DEFAULT now(),
    last_error      varchar(200),
    sent_at         timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz,

    CONSTRAINT ck_notification_status
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    CONSTRAINT ck_notification_event_type
        CHECK (event_type IN (
            'ACCOUNT_OPENED', 'ACCOUNT_HOLDER_ADDED', 'ACCOUNT_STATUS_CHANGED', 'FD_OPENED',
            'TXN_DEPOSIT', 'TXN_WITHDRAWAL', 'TXN_TRANSFER_IN', 'TXN_TRANSFER_OUT',
            'TXN_INTEREST_CREDIT', 'TXN_REVERSAL', 'TXN_FD_MATURITY')),
    CONSTRAINT ck_notification_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_notification_sent_state CHECK ((status = 'SENT') = (sent_at IS NOT NULL)),
    -- Idempotency backstop: one notice per event per customer, whatever retries happen.
    CONSTRAINT uq_notification_event_customer UNIQUE (event_key, customer_id)
);

-- The dispatcher only ever scans rows that still need work.
CREATE INDEX ix_notification_outbox_due
    ON notification_outbox (next_attempt_at)
    WHERE status = 'PENDING';

COMMENT ON TABLE notification_outbox IS
    'Transactional outbox: one row per customer e-mail. Written by triggers in the business transaction, sent after commit.';
COMMENT ON COLUMN notification_outbox.next_attempt_at IS
    'Earliest time the dispatcher may (re)try. A claim pushes it forward, acting as a lease that expires if a worker dies.';
COMMENT ON COLUMN notification_outbox.payload IS
    'Minimal display fields only (masked account number, amount, reference). Never balances or credentials.';

-- ---------------------------------------------------------------------------------------
-- Immutability: only delivery-state columns may change; rows are never deleted.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notification_outbox_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- A cascade from a deleted parent (nested trigger depth) is allowed; accounts and customers
        -- with ledger history can never be deleted anyway (ON DELETE RESTRICT elsewhere).
        IF pg_trigger_depth() > 1 THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE: notification records cannot be deleted'
            USING ERRCODE = 'P0001';
    END IF;
    IF NEW.notification_id IS DISTINCT FROM OLD.notification_id
       OR NEW.event_type   IS DISTINCT FROM OLD.event_type
       OR NEW.event_key    IS DISTINCT FROM OLD.event_key
       OR NEW.customer_id  IS DISTINCT FROM OLD.customer_id
       OR NEW.account_id   IS DISTINCT FROM OLD.account_id
       OR NEW.to_email     IS DISTINCT FROM OLD.to_email
       OR NEW.payload      IS DISTINCT FROM OLD.payload
       OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE: only delivery state may change'
            USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status IN ('SENT', 'FAILED') AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE: a finished notification cannot change status'
            USING ERRCODE = 'P0001';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_notification_outbox_guard
    BEFORE UPDATE OR DELETE ON notification_outbox
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notification_outbox_guard();

-- The runtime role reads the queue and updates delivery state only. INSERT happens solely through
-- the SECURITY DEFINER triggers below, so the application cannot forge or delete notices.
GRANT SELECT ON notification_outbox TO mims_app;
GRANT UPDATE (status, attempts, next_attempt_at, last_error, sent_at, updated_at)
    ON notification_outbox TO mims_app;

-- ---------------------------------------------------------------------------------------
-- fn_enqueue_notification: one row per ACTIVE holder (or one named customer) of an account.
-- SECURITY DEFINER: it must read holders/customers regardless of the caller's RLS scope.
-- Failure isolation: any error becomes a WARNING and the business transaction continues.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enqueue_notification(
    p_event_type  varchar,
    p_event_key   varchar,
    p_account_id  uuid,
    p_payload     jsonb,
    p_customer_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    BEGIN
        INSERT INTO notification_outbox (event_type, event_key, customer_id, account_id, to_email, payload)
        SELECT p_event_type, p_event_key, c.customer_id, p_account_id, c.email,
               p_payload || jsonb_build_object(
                   'recipientName', c.full_name,
                   'accountMask', '****' || right(a.account_number, 4))
          FROM account a
          JOIN account_holder h ON h.account_id = a.account_id
          JOIN customer c       ON c.customer_id = h.customer_id
         WHERE a.account_id = p_account_id
           AND c.status = 'ACTIVE'
           AND (p_customer_id IS NULL OR c.customer_id = p_customer_id)
        ON CONFLICT (event_key, customer_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notification enqueue skipped for % (SQLSTATE %)', p_event_type, SQLSTATE;
    END;
END;
$fn$;

REVOKE ALL ON FUNCTION fn_enqueue_notification(varchar, varchar, uuid, jsonb, uuid) FROM PUBLIC;

COMMENT ON FUNCTION fn_enqueue_notification(varchar, varchar, uuid, jsonb, uuid) IS
    'Enqueues one e-mail per active holder. Never raises: a notification problem must not roll back money movement.';

-- ---------------------------------------------------------------------------------------
-- Ledger rows: deposits, withdrawals, transfers, interest, reversals, FD maturity.
-- The FD opening principal debit is skipped; the FD_OPENED notice covers it.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notify_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    IF NEW.narration IS NOT DISTINCT FROM 'Fixed Deposit Opening Principal Debit' THEN
        RETURN NEW;
    END IF;
    PERFORM fn_enqueue_notification(
        'TXN_' || NEW.transaction_type,
        'TXN:' || NEW.transaction_id::text,
        NEW.account_id,
        jsonb_build_object(
            'amount', NEW.amount::text,
            'referenceNumber', NEW.reference_number,
            'occurredAt', NEW.transaction_date));
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_notify_transaction
    AFTER INSERT ON transaction
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_transaction();

-- ---------------------------------------------------------------------------------------
-- Holders: a holder inserted in the same transaction as its account is an account opening;
-- any later insert is a joint holder being added. Only the new holder is told.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notify_account_holder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_plan_name varchar;
    v_created   timestamptz;
BEGIN
    SELECT a.created_at, sp.plan_name INTO v_created, v_plan_name
      FROM account a JOIN savings_plan sp ON sp.plan_id = a.plan_id
     WHERE a.account_id = NEW.account_id;

    PERFORM fn_enqueue_notification(
        CASE WHEN v_created = transaction_timestamp() THEN 'ACCOUNT_OPENED' ELSE 'ACCOUNT_HOLDER_ADDED' END,
        'HOLDER:' || NEW.account_holder_id::text,
        NEW.account_id,
        jsonb_build_object('planName', v_plan_name, 'holderType', NEW.holder_type, 'occurredAt', now()),
        NEW.customer_id);
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_notify_account_holder
    AFTER INSERT ON account_holder
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_account_holder();

-- ---------------------------------------------------------------------------------------
-- Account status changes (freeze, reactivate, close).
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notify_account_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    PERFORM fn_enqueue_notification(
        'ACCOUNT_STATUS_CHANGED',
        'ACCT_STATUS:' || NEW.account_id::text || ':' || NEW.status || ':' || txid_current()::text,
        NEW.account_id,
        jsonb_build_object('oldStatus', OLD.status, 'newStatus', NEW.status, 'occurredAt', now()));
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_notify_account_status
    AFTER UPDATE OF status ON account
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION trg_fn_notify_account_status();

-- ---------------------------------------------------------------------------------------
-- Fixed deposit opened.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notify_fixed_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    PERFORM fn_enqueue_notification(
        'FD_OPENED',
        'FD:' || NEW.fd_id::text,
        NEW.account_id,
        jsonb_build_object(
            'principal', NEW.principal_amount::text,
            'interestRate', NEW.interest_rate_at_opening::text,
            'startDate', NEW.start_date,
            'maturityDate', NEW.maturity_date,
            'occurredAt', now()));
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_notify_fixed_deposit
    AFTER INSERT ON fixed_deposit
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_fixed_deposit();

COMMIT;
