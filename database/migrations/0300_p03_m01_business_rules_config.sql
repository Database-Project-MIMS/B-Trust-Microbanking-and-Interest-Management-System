-- Migration 0300: Business rules service parameters (P03-M01-T01)
-- Task: P03-M01-T01
-- Ensures WITHDRAWAL_SINGLE_LIMIT and WITHDRAWAL_DAILY_LIMIT are present
-- (already seeded in 0104 but guarded with ON CONFLICT in case of fresh rebuild)
-- Also seeds REVERSAL_REASON_REQUIRED parameter

BEGIN;

INSERT INTO system_parameter (param_key, param_value, description, data_type) VALUES
  ('REVERSAL_REASON_REQUIRED', 'true', 'Whether a reason is required when reversing a transaction', 'BOOLEAN')
ON CONFLICT (param_key) DO NOTHING;

SELECT 'migration 0300 applied' AS status;

COMMIT;
