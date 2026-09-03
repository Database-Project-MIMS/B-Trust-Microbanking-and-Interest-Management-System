# MIMS — Microbanking and Interest Management System

**B-Trust Microfinance Bank** · CS3043 Database Systems Semester Project · **Group 32**

A microbanking system covering branches and agents, customer registration, individual
and joint savings accounts, deposits and withdrawals, fixed deposits, a central 30-day
interest cycle, five management reports and a protected audit trail.

The relational database is the authoritative source of financial truth. The UI exists to
exercise and demonstrate the database.

## Stack

Next.js (App Router) · TypeScript · PostgreSQL 16 · `pg` with handwritten parameterized SQL.

**No ORM. No Supabase/Firebase/InsForge. No browser-to-database access.**

## Start here

| You are | Read |
|---|---|
| A team member starting work | [`AGENTS.md`](AGENTS.md), then [`docs/00_documentation-index.md`](docs/00_documentation-index.md) |
| Setting up locally | [`docs/10_local-setup.md`](docs/10_local-setup.md) |
| Reviewing the design | [`docs/03_architecture.md`](docs/03_architecture.md), [`docs/04_database-schema.md`](docs/04_database-schema.md) |
| Demonstrating the system | [`docs/13_system-operation-guide.md`](docs/13_system-operation-guide.md) |

## Project status

**Phase 0 (initialization) complete.** No business features implemented yet.
Current state: [`.agent/current-state.md`](.agent/current-state.md).

## Sample data notice

Only synthetic data is used. No real customer data appears anywhere in this repository.
