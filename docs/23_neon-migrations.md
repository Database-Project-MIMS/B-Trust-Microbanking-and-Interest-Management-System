# 23 — Automatic Neon migrations

The workflow `.github/workflows/neon-migrations.yml` validates changes and deploys
the database using the existing SQL runner. It does not deploy the Next.js app.

| Event | Validation | Deployment target |
|---|---|---|
| Pull request to `dev` or `main` affecting database/tooling paths | Disposable PostgreSQL 16 rebuild, full tests, typecheck, lint, build | None; no Neon secrets |
| Push to `dev` affecting those paths | Same checks | `neon-staging` |
| Push to `main` affecting those paths | Same checks | `neon-production` |
| Manual run on `dev` or `main` | Same checks | Corresponding environment |
| Manual run on another branch | Same checks | None |

The repository uses `dev` as its integration branch. Historical `develop`
examples do not name an existing integration branch here. Database SQL, tooling,
tests, dependency lockfile, Node pin, environment example and this workflow trigger
automatic validation/deployment. App-only changes do not trigger this workflow.

## One-time setup

1. Create separate Neon staging and production databases/branches. Provision
   `mims_owner` as the login owning the target database and public schema, and
   `mims_app` as the restricted runtime login. Both roles must exist before the
   migrations run. The owner needs permission to install `pgcrypto` and `pg_trgm`.
   Do not give `mims_app` owner membership or BYPASSRLS.
2. In GitHub **Settings → Environments**, create `neon-staging` and
   `neon-production`. Restrict staging deployments to `dev` and production to
   `main`. Configure production reviewers if the team's release policy requires
   them; GitHub environment rules apply before secrets are available.
3. Add a secret named **`DATABASE_MIGRATION_URL` to each environment**. Copy
   the connection for that environment's database and the `mims_owner` role
   from Neon with connection pooling disabled. Keep TLS enabled (`sslmode=require`,
   `verify-ca` or `verify-full`). The hostname must not contain the `-pooler` suffix.
   Never put the connection in a tracked file, workflow literal or browser variable.
4. Keep the separate `mims_app` connection in the application's `DATABASE_URL`.
   Do not provide `DATABASE_MIGRATION_URL` to the running application.
5. Publish the workflow through the team's normal review/merge process. The first
   matching push applies it; use **Actions → Deploy Neon database migrations →
   Run workflow** on `dev` or `main` for a retry or initial deployment. GitHub
   requires the dispatch workflow to exist on the default branch.

Neon requires no API key for this workflow: it connects directly with node-postgres.
Current reference: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
[GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).

## Deployment and failures

Validation uses a temporary local database and never receives Neon credentials.
The deployment step rejects missing secrets, malformed/non-Neon URLs, pooled
connections, the wrong role and optional/disabled TLS without printing values.

`scripts/deploy-database.mjs` applies pending numbered migrations through
`scripts/migrate.mjs up`. It then installs routines, triggers, views, indexes and
roles in the canonical order in one transaction, including the final runtime
control binder, and runs `verify-setup.mjs` for ledger/checksum/schema checks.
An empty database is supported once roles/ownership are provisioned. No demo data
is seeded; application/bootstrap reference data must be provisioned separately.

An individual failed migration rolls back its DDL and ledger entry. Earlier
successful migrations remain recorded. A failed runtime installation rolls back
that installation transaction. The workflow stops on any failure; review the safe
diagnostic, correct with a new numbered migration where necessary, and rerun.
Applied migration files must never be edited or deleted. No automatic rollback,
schema reset or data deletion is performed. Take a Neon restore point/backup before
reviewed production schema changes according to the team's release procedure.

Deployments are serialized per environment, and a new push does not cancel an
active deployment. Use distinct databases for the two environments. Avoid concurrent
manual migration commands or other deployment workflows against the same target.
The workflow does not prove live HTTPS, general phase acceptance or app readiness.

## Environment example and exposed credentials

`.env.example` deliberately leaves database URLs, session/CSRF secrets and the
worker token empty. Copy it to ignored `.env` and fill it locally. If a Neon password
was exposed in Git, rotate it in Neon and update local/app/GitHub secrets. Removing
it from the example does not remove it from Git history or revoke its access.

The current tracked checkout was checked without printing credentials; no Neon URL
was found. This check does not cover remote branches or certify historical commits.

## Local verification — 2026-10-10

3,410 tests /116 suites pass, including fresh deployment without seeding, preserved
financial/audit state on two reruns, safe connection rejection and runtime SQL
rollback. Clean 70-migration rebuild/checksums, backup/restore, typecheck, lint and
production build pass. Workflow YAML parses. Local host: Node 24.15.0/PostgreSQL
18.6; the configured GitHub Node 22/PostgreSQL 16 and actual Neon connection must
still be verified by a hosted workflow run after the one-time setup above.
