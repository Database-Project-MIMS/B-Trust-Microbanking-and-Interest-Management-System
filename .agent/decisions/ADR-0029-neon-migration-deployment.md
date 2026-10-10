# ADR-0029 — Automatic Neon migration deployment

2026-10-10. The user requested a new branch, automatic Neon migration deployment
and removal of connection credentials from `.env.example`. This authorizes the
necessary M1/M4 infrastructure contribution; original stewardship remains.
Branch `feat/p06-m02-neon-migrations` starts at the clean Docker baseline `1f183bb`.
The user subsequently authorized a few local commits: infrastructure, tests and
documentation are committed separately. No push, PR, merge, credential rotation
or live deployment is performed.

Blueprint: GitHub Actions validates a clean disposable PostgreSQL 16 database,
all tests, typecheck, lint and build using Node 22. Pull requests validate without
Neon secrets. The actual integration branch is `dev`, despite historical
`develop` examples: pushes to `dev` deploy to `neon-staging`; pushes to `main`
deploy to `neon-production`. Separate GitHub environment secrets each supply
`DATABASE_MIGRATION_URL`. Manual dispatch is restricted to these same branches.
Deployment concurrency is serialized per environment and running migrations are
not cancelled by newer pushes.

Use the direct TLS Neon connection for `mims_owner`, not a pooled or runtime
connection. The job installs dependencies before receiving credentials. Deployment
uses the existing immutable, checksum-verified, atomic migration runner and the
canonical routines → triggers → views → indexes → roles runtime installation.
The runtime installation is one transaction, including the final control binder.
Never call rebuild/reset or seed during deployment. Provision roles/ownership once
and configure separate target databases/secrets outside the repository.

The current tracked checkout contains localhost connections, not a Neon URL;
its connection and security credential fields are cleared regardless. A filename-only
scan found no Neon URLs in current tracked files. This does not certify Git history
or remote branches. Any previously exposed Neon password must be rotated externally.

Documentation and review evidence: `docs/23_neon-migrations.md` and
`.agent/handoffs/p06-neon-migration-deployment.md`. General phase gates, task
acceptance and M1's broader live HTTPS work remain unchanged.
