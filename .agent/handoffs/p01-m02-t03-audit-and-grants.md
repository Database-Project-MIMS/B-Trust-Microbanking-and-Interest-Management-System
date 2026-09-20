# P01-M02-T03: Organisation API audit and runtime grants

**From:** Member 2 · **To:** Member 1 and integration lead · **Date/session:** 2026-09-19
**Status:** published

## What this gives you

Member 2 has implemented the six branch/agent API handlers and their services. Functional
tests pass with the migration owner, but the normal application connection uses
`mims_app`, which currently lacks the required organisation-table privileges.

Member 1 owns `database/roles/**`. Please add least-privilege runtime grants equivalent
to:

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

- Organisation API tests: 23/23 pass with the migration-owner connection.
- Running the same handlers through the configured `mims_app` connection currently
  returns safe `500` responses because PostgreSQL denies branch/agent access.
- No migration or M1-owned role file was modified by Member 2.

## What's NOT stable yet

P01-M02-T03 remains `IN_PROGRESS` until the grants are applied reproducibly and audit
coverage is integrated and tested.
