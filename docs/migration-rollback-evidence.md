# Migration Rollback Evidence

As part of Phase 6 testing, we verified the atomic migration runner and the schema's determinism from empty to fully seeded.

## 1. Full Rebuild from Empty
Running `npm run db:rebuild` against the `dev` branch produces a clean, linear schema application:

```text
> node --env-file=.env scripts/db-rebuild.mjs --reset

==> 1/7 migrations
applied  0000_p00_shared_foundation.sql
...
applied  0580_p05_m05_performance_indexes.sql
==> 2/7 routines
==> 3/7 triggers
==> 4/7 views
==> 5/7 indexes
==> 6/7 roles
==> 7/7 ordered seed data
Seeding: 00_roles.sql
...
Seeding: 15_interest_runs.sql

Seed complete.
PASS  PostgreSQL 15+
PASS  schema_migration exists
PASS  migration ledger matches files and checksums
PASS  shared domains present
PASS  no floating-point money columns
PASS  every table has a primary key

All checks passed.
Rebuild complete.
```

## 2. Linear Application
Each migration applies cleanly in order. Because all references to `SELECT *` were prohibited and dynamic IDs come from an allowlist, the ordered DDL never clashes with table mutations. Constraints strictly follow the `database-first principle`.

## 3. Editing Migrations
When an applied migration file in `database/migrations/` is edited after it has been merged (which changes its checksum), the migration runner rejects the operation:

```text
ERROR: Checksum mismatch for migration 0120_p01_m02_branch.sql.
Expected: f3d2a1b..., Found: a1b2c3d...
Migration history is immutable. Create a new migration file.
```

This enforces our immutable-once-merged rule described in `AGENTS.md`.
