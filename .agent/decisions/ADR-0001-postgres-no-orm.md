# ADR-0001: PostgreSQL 16 with node-postgres, no ORM

**Date:** Phase 0 · **Status:** Accepted

## Decision

PostgreSQL 16. Data access is handwritten, parameterized SQL through `node-postgres`
(`pg`), confined to `lib/db`. No ORM (Prisma, Drizzle, Sequelize, TypeORM), no
Supabase, no Firebase, no InsForge.

## Why

The assignment (CS3043 Database Systems) is graded on demonstrated command of SQL,
transactions, indexing, and PL/pgSQL routines — an ORM would hide exactly the material
being assessed. This is stated explicitly and repeatedly in the project brief.

## What it rules out

- Any query builder or ORM dependency, even for "boring" CRUD
- BaaS platforms that own the schema or hide the connection (Supabase, Firebase,
  InsForge)
- Client-side database credentials of any kind

## Consequence

Every member writes real SQL for every table they touch. `lib/db` (M4-stewarded) is the
only module that imports `pg`, so connection handling, error mapping and transaction
helpers are consistent across all five slices rather than five different styles.
