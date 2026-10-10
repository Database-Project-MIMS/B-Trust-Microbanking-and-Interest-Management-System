# Docker app connected to Neon — infrastructure contribution

2026-10-10 · branch `feat/p06-m02-neon-migrations` · base `5e5dbb3`.

The user asked whether the previous Docker setup needs changes for Neon and
authorized necessary changes. Blueprint: preserve the local PostgreSQL Compose
stack and add a separate app-only Neon Compose stack with a distinct project,
ignored runtime environment and localhost port. The app receives only mims_app
credentials and application secrets; GitHub Actions remains the migration owner.
Reject owner/admin connections and insecure Neon connections before app startup.
Use the existing standalone runtime image; no schema, endpoint, financial rule,
seed or UI change. Do not connect to Neon during local verification.

Affected shared infrastructure: Dockerfile, .gitignore, secret generator, new
Compose/configuration validation, tests and docs/state. M1 retains deployment
security, M4 retains database tooling and M5 retains seed stewardship. This is
a contribution rather than an ownership transfer. Existing migration files
remain unchanged. The user subsequently authorized local commits for the Docker
supplement and CI correction. No push, PR creation or merge. Task/phase acceptance
stays unchanged.

## Verification

- 8/8 operations checks pass, zero failures/skips: existing local Compose,
  app-only Neon separation, missing URL, role/TLS/origin validation, safe diagnostics
  and generator preservation/independent secrets.
- Full ESLint and TypeScript checks pass.
- User's ignored `.env.neon` connection passes local role/TLS validation. Missing
  app secrets/default settings were generated locally without printing values;
  the connection was preserved. Compose `config --quiet` passes with that file.
- Git ignore and changed-file credential scan pass; no private values recorded.
- Docker Compose CLI v5.1.4 is available, but its Linux engine named pipe is absent.
  Actual image build/start and live Neon connectivity are not verified.
- Production standalone build passes and `.next/standalone/server.js` exists.
  Two sandboxed attempts failed with Windows EPERM in generated directories;
  the approved credential-free build outside the sandbox passes. This confirms
  the sandbox restriction, rather than an app build failure. Host Node 24.15.0;
  the Node 22 Linux image still needs a working Docker engine.

## Review

Plan alignment: PASS. Separate runtime stack, original local behavior, generated
app secrets and GitHub migration ownership match the authorized blueprint.

System integrity: PASS. No application/database boundaries or ownership shifts;
no migrations, financial rules, endpoints or UI changed. Owner secrets are excluded
even when present in the host environment. Runtime configuration stays outside Git
and image build context; diagnostics contain only static problem descriptions.

Production readiness: local configuration/negative checks PASS. Container execution
is an external verification limit. A clean migrated database needs separately
provisioned users/reference data before sign-in. Public HTTPS and phase acceptance
remain pending. No unresolved implementation finding identified in this supplement.

All five member overview tables reviewed; no newly accepted task to strike through.
Documentation index, README, docs/22/23, M2 overview, tracker, state and additive
memory supplement updated; earlier context retained. User authorized separate
local implementation/test, CI-fix and documentation commits; no push/publication.
Docker runtime/tests commit: `f94fe86`. CI regression commit: `f47ccc8`.
Documentation/state are recorded in a third local commit.
