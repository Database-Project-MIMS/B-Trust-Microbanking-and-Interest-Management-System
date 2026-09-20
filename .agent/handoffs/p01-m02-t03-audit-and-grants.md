# P01-M02-T03: Organisation API audit and runtime grants

**From:** Member 2 · **To:** Member 1 and integration lead · **Date/session:** 2026-09-19
**Status:** grants resolved; audit integration pending

## What this gives you

Member 2 has implemented the six branch/agent API handlers and their services. Member 1
authorized the cross-owner grant update, and the normal application connection now has
the required least-privilege organisation-table permissions.

`database/roles/01_app_grants.sql` now contains:

```sql
GRANT SELECT, INSERT, UPDATE ON branch TO mims_app;
GRANT SELECT, INSERT, UPDATE ON agent TO mims_app;
```

Do not grant `DELETE`; deactivation is the only supported lifecycle operation.

## Audit integration needed

The detailed T03 specification requires agent creation to write an audit event in the
same transaction, but `audit_log` and `trg_audit_master_changes` belong to
P01-M01-T05 and do not exist yet. When that contract is published, cover branch and agent
creates/updates either with the shared master-data audit trigger or a transaction-aware
audit helper. Sensitive fields must exclude `password_hash`.

The current `createAgent()` transaction atomically inserts `app_user` and `agent`; its
forced duplicate test proves that a failed profile insert leaves no orphan user.

## Verification

- Organisation API tests: 23/23 pass through the configured `mims_app` connection.
- The grants were applied to the local database without granting `DELETE`.
- No migration was added or modified.

## What's NOT stable yet

P01-M02-T03 remains `IN_PROGRESS` until audit coverage is integrated and tested after
P01-M01-T05 publishes the shared `audit_log` and master-data audit trigger contract.
