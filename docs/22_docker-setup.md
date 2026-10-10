# 22 — Docker setup

This local demonstration stack runs the existing Next.js app on Node 22 and
PostgreSQL 16. Docker Desktop must use Linux containers; Docker Engine with
Compose also works. A host Node installation is needed only for the optional
secret generator. This does not deploy MIMS to a public environment.

## Start

From the repository root:

```sh
node scripts/configure-docker.mjs
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps -a
docker compose --env-file .env.docker logs setup
```

Alternatively copy `.env.docker.example` to `.env.docker` and fill all blank values.
Use independent random hexadecimal passwords and secrets (at least 32 characters).
The generator creates six independent 32-byte values and refuses to overwrite an
existing file. `.env.docker` is ignored by Git and excluded from Docker builds.
Use `--env-file .env.docker` on every Compose command; the ordinary host `.env`
does not supply Docker configuration.

Open [MIMS](http://localhost:3000). Demo usernames and the synthetic password
are documented in `13_system-operation-guide.md` and `database/seed/02_users.sql`.
Set both `MIMS_HTTP_PORT` and `APP_BASE_URL` when using another port, e.g. 3001 and
`http://localhost:3001`. PostgreSQL has no published host port and does not use
or modify a host PostgreSQL installation or its development database.

## Services and data

| Service | Purpose | Credentials |
|---|---|---|
| `db` | Persistent PostgreSQL, roles created only on the first empty volume | Bootstrap superuser and initial role passwords |
| `setup` | One-shot numbered migrations, then routines → triggers → views → indexes → roles; optional initial demo seed; verification | `mims_owner` only |
| `app` | Standalone production Next.js server, running as non-root `node` | `mims_app` and application secrets only |

Compose waits for the database health check and a successful setup exit before
starting the app. The app health check requests the public sign-in page; it is
an HTTP liveness probe, not an authenticated database health test. `/api/health`
retains its existing session requirement.

`setup` uses the same SQL stages as `db:rebuild`, without its destructive reset
path. The seed runs only with `MIMS_SEED_DEMO=1` and an empty `app_user` table.
Subsequent setup runs verify migration checksums, apply pending migrations and
reapply idempotent SQL stages, preserving existing data. A setup failure prevents
app startup. Inspect its logs and correct the cause before rerunning it.
Do not run setup concurrently with another migration job or serve traffic during
SQL updates. For a local image/schema update:

```sh
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker build setup app
docker compose --env-file .env.docker run --rm setup
docker compose --env-file .env.docker up -d
```

The named `postgres-data` volume persists through `down`, restarts and image
rebuilds. Restarting existing containers alone does not apply new migrations.
Changing a password in `.env.docker` does not change roles inside an existing
volume: coordinate a SQL password rotation before restarting clients.

```sh
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker down
```

For an intentionally disposable demo reset only, `docker compose --env-file
.env.docker down --volumes` permanently deletes this Compose project's data.
Back up wanted data first. Never use that command as a routine stop action.

## Images and security

`Dockerfile` has dependency, tooling, build and runtime stages. `npm ci` uses the
lockfile; the web image contains the traced standalone server and static assets.
`MIMS_STANDALONE=1` enables standalone output during Docker builds; ordinary
`npm run build` / `npm start` retain their existing behavior. The build uses a
credential-free placeholder URL for module evaluation and needs no live database.
Secrets are supplied at container runtime, never through build arguments.

The default Compose stack is localhost-only and deliberately seeds synthetic
data. For a real deployment, use separate databases/secrets, disable demo seeding,
terminate HTTPS at a trusted reverse proxy, set the public HTTPS `APP_BASE_URL`,
and run `scripts/check-deployment-security.mjs` with the actual runtime environment.
Preserve the app's secure cookies; do not disable them to expose plain HTTP remotely.
TLS, backup scheduling and automatic interest scheduling require explicit deployment
configuration; this local stack does not supply them.

The implementation follows [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
[Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order/)
and the [official PostgreSQL image initialization contract](https://hub.docker.com/_/postgres).

## Run the Docker app against Neon

Use `compose.neon.yaml` alone for an app connected to Neon. It creates only the
app, without a local database, setup, migrations or seeds. GitHub Actions remains
responsible for migrations; see [Neon deployment](23_neon-migrations.md).
Use staging first. Confirm its migration workflow succeeds and provision the
required bootstrap/reference data and users separately before testing sign-in.
The migration workflow does not seed an empty database.

1. Run `node scripts/configure-docker.mjs --neon`. This creates ignored `.env.neon`
   with three independent application secrets and a blank connection field. It
   refuses to overwrite an existing file.
2. Edit `.env.neon` locally. Set `NEON_DATABASE_URL` to the selected Neon database's
   **mims_app** connection with TLS enabled. Pooled or direct connections work.
   Never use the owner connection or put the migration secret in this file.
3. Start Docker Desktop with its Linux engine, then run:

```sh
docker compose -f compose.neon.yaml --env-file .env.neon config --quiet
docker compose -f compose.neon.yaml --env-file .env.neon up --build -d
docker compose -f compose.neon.yaml --env-file .env.neon ps
docker compose -f compose.neon.yaml --env-file .env.neon logs app
```

Open [MIMS with Neon](http://localhost:3001). This separate `mims-neon` project
uses port 3001; the original local stack still uses port 3000. Change both
`MIMS_NEON_HTTP_PORT` and `APP_BASE_URL` if another port is required.
Do not combine this Compose file with `compose.yaml`. Use `config --quiet`;
ordinary `config` output includes resolved secrets.

The startup check rejects owner/admin roles, missing TLS, short application
secrets and owner credentials in the app environment. HTTP is allowed only for
loopback access. A public deployment requires HTTPS at a configured reverse proxy
and an HTTPS `APP_BASE_URL`; this Compose file exposes only localhost.
Complete required schema deployment before starting an updated app image.

To stop this app, run:

```sh
docker compose -f compose.neon.yaml --env-file .env.neon down
```

This app-only stack has no database volume and does not reset Neon or the original
local database. After rotating the Neon app password, update `.env.neon` and run
`up -d --force-recreate` with the same Compose file and environment options.
Runtime credentials are excluded from Git and the Docker build context.
The explicit environment mapping follows [Compose environment precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/).

## Verification

```sh
docker compose --env-file .env.docker config --quiet
node --test tests/ops/docker-compose.test.mjs tests/ops/docker-neon.test.mjs tests/ops/docker-secret-generator.test.mjs
npm run test:db -- --tap
```

Compose tests require its CLI but not a running engine. Database tests use the
existing disposable cluster harness, including Docker setup from empty, a rerun
that preserves modified users and exact ledger/account/payout/audit state, and
missing-owner rejection. A production standalone build verifies traced output.
Actual Linux image build/start checks require a working Docker engine.

2026-10-10 local verification: **3,401 tests /116 suites** pass with zero failures,
cancellations or skips; clean 70-migration rebuild/checksums, backup/restore,
typecheck, lint, ordinary production build, separate standalone build and 2/2
Compose contract checks pass. Host Node 24.15.0/PostgreSQL 18.6. Actual Linux image
build/start was attempted but Docker Desktop's Linux engine endpoint was unavailable;
Node 22/PostgreSQL 16 container execution remains unverified.

2026-10-10 Neon Docker supplement: **8/8 operations checks**, full lint,
typecheck and production standalone build pass. The user's private configuration
passes role/TLS validation and Compose `config --quiet`; missing application
secrets were generated locally without exposing values. Build required an approved
run outside the sandbox after Windows EPERM errors. Actual image/start and live
Neon connectivity remain unverified because the Docker Linux engine is unavailable.
