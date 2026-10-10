# 10 — Local Setup

From a clean machine to a running MIMS with sample data.

For Docker Desktop or Docker Engine, use [Docker setup](22_docker-setup.md):
the app, PostgreSQL and owner-only setup run in containers with persistent data.
The host-native instructions below remain available.

For automatic deployment of SQL migrations to Neon, see
[Neon migration setup](23_neon-migrations.md). The tracked example leaves all
connection and security secrets empty; supply them only in ignored local files
or the appropriate deployment environment.

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 LTS or 22 LTS | `node -v` |
| npm | 10+ | `npm -v` |
| PostgreSQL | **16** (15 acceptable) | `psql --version` |
| Git | any recent | `git --version` |

`.nvmrc` pins the Node version — `nvm use` picks it up.

## 1. Clone and install

```bash
git clone <repository-url> mims
cd mims
nvm use          # optional
npm install
```

`npm install` must **not** pull in an ORM. If you see `prisma`, `drizzle`, `sequelize` or
`typeorm` in the tree, stop — something violated AGENTS.md §4.

## 2. Create the database and roles

```bash
npm run db:create        # prompts for the mims_owner and mims_app passwords
```

This creates two roles deliberately:

- **`mims_owner`** — owns the schema; used only by migrations
- **`mims_app`** — the runtime role; cannot `DROP`, cannot `UPDATE`/`DELETE` posted ledger
  rows (NFR-SEC-03)

Doing it manually instead:

```sql
CREATE ROLE mims_owner LOGIN PASSWORD '...';
CREATE ROLE mims_app   LOGIN PASSWORD '...';
CREATE DATABASE mims_dev OWNER mims_owner;
```

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in `.env` (never commit it — it is gitignored):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mims_app` connection — used by the application |
| `DATABASE_MIGRATION_URL` | `mims_owner` connection — used only by migration scripts |
| `SESSION_SECRET`, `CSRF_SECRET` | `openssl rand -base64 32` each |
| `INTEREST_WORKER_TOKEN` | Shared secret for the scheduled interest run |
| `PGPOOL_MAX` | Pool size (default 10) |

**No `NEXT_PUBLIC_*` variable may contain a secret** — anything with that prefix is shipped
to the browser.

For production, provide `DATABASE_MIGRATION_URL` only to the migration job, never
to the Next.js runtime. Set `APP_BASE_URL` to the public HTTPS origin and run
`npm run verify:deployment` in the runtime environment before starting the app.
The reverse proxy must terminate TLS and redirect HTTP to HTTPS; a successful
local `npm run build` does not prove that the deployed site uses HTTPS.

## 4. Build the schema

```bash
npm run db:migrate       # apply migrations in order
npm run db:status        # show applied vs pending
npm run db:grants        # apply runtime permissions using the owner connection
```

`db:rebuild` runs everything in the documented order (`database/README.md`): migrations →
routines → triggers → views → indexes → roles → seed.

```bash
npm run db:rebuild       # rebuild an empty configured database
```

## 5. Seed sample data

```bash
npm run db:seed
```

Currently loads the Phase 1 foundation: 3 branches, 6 ordinary agents, 5 savings plans
and 3 FD products. The full planned target of 18 customers, 22 accounts (3 joint),
12 FDs and 140+ transactions depends on future schema/routine tasks
(`06_seed-data-spec.md`); it is not yet delivered.

## 6. Verify

```bash
npm run db:verify
```

Checks PostgreSQL ≥ 15, every migration filename/checksum matches, shared domains present, **no floating-point
money column**, and a primary key on every table. All checks must pass.

## 7. Run

```bash
npm run dev              # http://localhost:3000
```

Development sign-in credentials are listed in `13_system-operation-guide.md`.

## 8. Tests

```bash
npm test                 # everything
npm run test:db          # SQL constraints, routines, concurrency
npm run test:api         # route handlers, authorization, injection
npm run typecheck
npm run lint
npm run verify:phase1    # isolated rebuild + all tests + typecheck/lint/build
```

Test commands create and remove a disposable PostgreSQL cluster using synthetic data;
they do not reset the configured development database. Local PostgreSQL binaries must
be available. On Windows versions 18/17/16/15 are discovered under Program Files;
otherwise set `PG_BIN` to the installation's bin directory or put binaries on PATH.
An owner role with CREATEDB is created only inside the disposable cluster.

## Resetting

```bash
npm run db:rebuild -- --reset  # explicit nonempty mims_dev/mims_test_* reset + seed
```

The database must always be reconstructible from empty with no manual table editing
(SRS §6.8). If `db:rebuild` fails, that is a defect — do not patch the database by hand.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | No `.env` | `cp .env.example .env` and fill it in |
| `password authentication failed` | Wrong password, or `pg_hba.conf` set to `peer` | Check `.env`; set `pg_hba.conf` to `scram-sha-256` for local TCP and reload |
| `permission denied for table …` | Using `mims_app` for migrations | Migrations use `DATABASE_MIGRATION_URL` |
| `relation "schema_migration" does not exist` | Migration `0000` never applied | `npm run db:migrate` |
| **`already applied but its contents changed`** | Someone edited a merged migration | Revert that file and add a **new** migration (AGENTS.md §8) |
| `extension "pgcrypto" is not available` | `postgresql-contrib` missing | `sudo apt install postgresql-contrib` |
| `too many connections` | Pool too large, or dev server restarts leaking pools | Lower `PGPOOL_MAX`; the pool is reused across hot reloads by design |
| `Module not found: pg` in a client component | `pg` imported outside `lib/db` | Only `lib/db` may import `pg`; the file needs `import "server-only"` |
| Ports clash | 3000 in use | `PORT=3001 npm run dev` |
| Wrong timezone in timestamps | Server not on Asia/Colombo | Values are `TIMESTAMPTZ`; format for display, do not change storage |

## Disposable frontend QA

`npm run verify:phase1 -- --preview` builds a temporary database and synthetic QA identities,
then starts a localhost Next development server. Its URL is written to ignored
`test-results/preview-url.json`; create `test-results/preview-stop` to terminate the server
and clean up the cluster. Stop it before production build (shared .next directory).
Use only disposable credentials in `tests/helpers/browser-fixture.mjs`, never real users.
`--catalog` regenerates docs/18/19 from the clean rebuild; `--tap` requests diagnostic test
output. The normal configured development database is preserved by these commands.
