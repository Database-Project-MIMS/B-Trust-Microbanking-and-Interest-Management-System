# P01-M02-T03: Organisation API audit and runtime grants

**From:** Member 2 · **To:** Member 1 and integration lead · **Date/session:** 2026-09-19
**Status:** complete

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

## Audit integration

P01-M01-T05's audit contract landed in `dev`. Migration
`0122_p01_m02_organization_audit.sql` binds sanitized master-data triggers to `branch`
and `agent` and corrects entity-ID extraction for rows that contain both `agent_id` and
`branch_id`.

Agent creation atomically inserts `app_user`, `agent` and their audit effects. A failed
profile insert leaves no orphan user or audit row. `password_hash`, `nic_passport_no`
and `token_hash` are removed by the shared trigger function before persistence.

## Verification

- Organisation API tests: 23/23 pass through the configured `mims_app` connection,
  including audit assertions and rollback isolation.
- Organisation audit DB tests: 1/1 passes.
- The grants were applied to the local database without granting `DELETE`.
- No migration was added or modified.

## Completion

P01-M02-T03 is complete. P01-M02-T04 is the next Member 2 task.

## Integration repairs included

The merged T05 parameter routes referenced a missing `@/lib/auth` module and treated the
shared `query()` helper as a raw `pg` result. The follow-up aligns both parameter routes
with `requireUser()` / `requireRole()`, adds CSRF verification to `PUT`, and corrects the
parameter service's array return handling. These changes restore `npm run typecheck` and
the production build; parameter updates remain audited by the database trigger.
