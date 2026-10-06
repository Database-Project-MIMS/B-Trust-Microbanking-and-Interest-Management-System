-- P02-M02-T03 · M2 · KYC metadata/verification · L05 FK/CHECK, L08 timestamp trigger.
BEGIN;

CREATE TABLE customer_document (
    doc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL,
    doc_type varchar(50) NOT NULL,
    file_path varchar(500) NOT NULL,
    uploaded_date timestamptz NOT NULL DEFAULT now(),
    verified_by uuid,
    verified_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_customer_document_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_document_verifier FOREIGN KEY (verified_by)
        REFERENCES app_user(user_id) ON DELETE RESTRICT,
    CONSTRAINT ck_customer_document_verification
        CHECK ((verified_by IS NULL) = (verified_date IS NULL))
);

-- Customer profile/document eligibility and restrictive customer FK lookup.
CREATE INDEX ix_customer_document_customer ON customer_document(customer_id);

CREATE TRIGGER trg_customer_document_set_updated_at
BEFORE UPDATE ON customer_document
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN customer_document.file_path IS 'Metadata path only; no file contents stored here.';
COMMENT ON COLUMN customer_document.verified_by IS 'Paired with verified_date; verifier login is retained by RESTRICT.';

-- Account-opening documentation eligibility is M3's routine, not this row-level CHECK.
-- Runner owns migration recording; runtime scoped grants/RLS/audit bindings remain M1 work.
COMMIT;
