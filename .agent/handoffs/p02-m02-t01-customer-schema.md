# P02-M02-T01 — Customer schema handoff

**From:** M2 (Vibodha) · **To:** M1, M3, M5 and M2's next tasks
**Date:** 2026-10-05 · **Status:** implemented and verified locally; publication pending
**Branch:** feat/p02-m02-customer-schema · **Migration:** 0220_p02_m02_customer.sql

## Stable database contract

Use `customer.customer_id` for assignment, document and account-holder FKs. It is an
independent UUID and never requires an app_user row. The optional `app_user_id` is
nullable and unique, with ON DELETE RESTRICT; multiple unlinked customers are allowed.
Linking a login does not replace customer_id. ADR-0007 remains authoritative.

Customer number/NIC-passport/email are required and separately unique, with constraints
`uq_customer_number`, `uq_customer_nic_passport_no`, `uq_customer_email`; optional login
uniqueness is `uq_customer_app_user_id`. Branch FK is `fk_customer_branch`; login FK
is `fk_customer_app_user`. Duplicate INSERT/UPDATE raises 23505. Birth date must be
before database CURRENT_DATE (`ck_customer_birth_date_past`); status is ACTIVE/INACTIVE
(`ck_customer_status`). Creation/update timestamps are non-null and trigger-maintained.

The branch B-tree is `ix_customer_branch`; the name GIN index is
`ix_customer_full_name_trgm` with gin_trgm_ops. Queries can combine branch_id = $1
with `full_name % $2` for fuzzy names or `full_name ILIKE $2` for substring matching.
Unique values are exact/case-sensitive; input normalization and identity masking belong
to registration/search services, not a silently different schema rule.

## Remaining owner work

- **M1:** Customer RLS and scoped runtime grants remain P02-M01-T01. No mims_app
  customer grant is included in 0220; runtime access fails closed until you add it.
  Customer/account audit binding remains P02-M01-T02. Before binding the current
  `fn_audit_master_changes()` to customer, resolve customer_id before branch_id and
  sanitize identity values; the current function would otherwise use the branch as
  entity_id. No M1-owned grant/auth/audit file was changed here.
- **M3:** Holder FK can now reference customer_id with ON DELETE RESTRICT. Joint
  adult checks read date_of_birth; do not link holders to app_user_id.
- **M2:** Assignment 0221 and document 0222 work can begin independently. Registration
  must await both, audit/scoped access, and its own service/API/UI task. Customer-number
  generation, validation and login-role checks are later service responsibilities.
- **M5:** Customer table is available for later synthetic seed contribution, but complete
  customer/account/joint seed sets still depend on account opening. No permanent
  customer seed rows were added by this schema task.

Child tables are not created in T01; their customer FKs must use RESTRICT. Deactivate
referenced customers rather than delete history. The schema does not yet expose a
customer registration API or usable customer page.

## Verification and review

`npm run verify:customer-schema` builds a disposable PostgreSQL 18.6 cluster, invokes
the existing db:rebuild with its own database name, reapplies/verifies migrations,
runs **65 tests (27 customer + 38 organization regressions)**, typecheck and lint,
then removes the cluster. Zero failures/skips. All 12 numbered migrations rebuild
from empty. The normal development DB also received 0220 additively and verifies;
existing development data was not reset. Log: ignored test-results/customer-schema.log.

**/review layer 1 — PASS:** matches the approved DB-only task/ADR-0007 blueprint.
**Layer 2 — PASS:** named SQL constraints, parameterized fixture queries, lib/db pool,
shared timestamp trigger, justified indexes, no merged migration or other owner file edit.
**Layer 3 — PASS for T01:** constraints, optional login, FK restrictions, name search,
rollback, permissions and organization regressions are checked against PostgreSQL.

**Integration condition:** Current checkout lacks the earlier uncommitted Phase 1
closeout changes. This run is task-specific evidence, not a renewed full Phase 1
certification. The legacy migration-runner test was excluded because it resets mims_dev
and edits an existing migration. No API/UI was added; no UI imprint is applicable.
The user prohibited commits, merges and PR creation; technical implementation is
complete locally, while team review/publication remains user-controlled.

/remember save refreshed memory/current state/M2 context. All five overview summary
tables were reviewed; only M2's newly completed customer-schema row is struck through.
No other member's task completion is inferred from the customer-table delivery.
