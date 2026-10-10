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

## Run with Docker

Start Docker Desktop in Linux-container mode (or Docker Engine with Compose), then:

```sh
node scripts/configure-docker.mjs
docker compose --env-file .env.docker up --build -d
```

Open [MIMS](http://localhost:3000). PostgreSQL data persists in a named volume;
the app starts after database setup succeeds. [Docker guide](docs/22_docker-setup.md)
covers credentials, logs, updates and stopping the stack. This is a local synthetic-data demo.

To connect the Docker app to Neon, use the separate `compose.neon.yaml` stack and
an ignored `.env.neon` containing the restricted `mims_app` connection. Follow
[Docker with Neon](docs/22_docker-setup.md#run-the-docker-app-against-neon).
GitHub Actions handles schema deployment; this app-only stack does not migrate or seed.

## Project status

The verified local implementation includes organization/customer/account APIs, ledger
operations, staff transfers, savings interest, FD opening/maturity, reports and audit.
The current rebuild has 28 tables and 70 migrations. [Predeployment audit](docs/21_predeployment-audit.md)
records the verification and remaining deployment/settlement limits. M2 T01/T02 are merged;
T03 and cross-owner closeout remain local REVIEW work. Live HTTPS remains pending.
Current state: [`.agent/current-state.md`](.agent/current-state.md).

## Sample data notice

Only synthetic data is used. No real customer data appears anywhere in this repository.
