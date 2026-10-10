# M2 Docker setup contribution

2026-10-10 · branch `feat/p06-m02-dockerize` · base `8a2b9c2`.
User requested Dockerization on another branch, a commit message, no push/PR.
The user's follow-up authorizes a few local commits. Infrastructure, tests and
documentation are committed separately; no push, PR or merge is performed.

Original stewardship is retained. Shared `next.config.ts` gains opt-in standalone
output, `.gitignore` excludes the dedicated local Docker environment, and README,
local-setup/index documentation and project state point to the new Docker guide.
M1 owns live HTTPS completion; M4 owns canonical database tooling; M5 retains
seed stewardship. None of their SQL migrations, security functions, seeds or
domain implementations is edited by this contribution.

New files: Dockerfile, Compose configuration, build-context ignore, example
environment, safe secret generator, PostgreSQL first-volume role bootstrap,
non-destructive setup script, Compose contract and disposable DB setup tests.
Setup reuses the canonical stages and only seeds an empty app_user table.
The app receives no owner/admin database credentials. Data survives restart/down.
The HTTP liveness probe does not replace the authenticated health API.

All five overview summary tables were reviewed. No existing task has newly met
its full Definition of Done; statuses/strikethroughs remain unchanged. This is
an infrastructure supplement to P06-M02-T03, not general Phase 6 acceptance.

## Review and verification

`/review` applied in all three layers: implementation matches ADR-0028; application,
owner/admin credentials and SQL responsibilities remain separate; startup fails
closed on setup errors, persistent data is preserved and sensitive configuration
is excluded from build context. No unresolved implementation finding was identified.
Actual image/runtime verification is an environmental limitation, recorded below.

- Compose contract: 2/2 pass, including missing-secret rejection and runtime
  credential/private-port/readiness checks; Compose configuration parses cleanly.
- Standalone production build, typecheck and ESLint pass. Host verification uses
  Node 24.15.0 / PostgreSQL 18.6; images target required Node 22 / PostgreSQL 16.
- New database setup parent/three subtests pass: all 70 migrations/12 FDs from
  empty, changed user and exact financial/audit state preserved on rerun, missing
  owner URL rejected before setup.
- Initial DB-only run: 746 passes, one unchanged interest-credit test process
  crashed with Windows exit 3221226505 and no assertion output. The full rerun
  passed **3,401 tests /116 suites**, zero failures/cancellations/skips (2,240
  security plus 1,161 API/DB/e2e checks); clean 70-migration rebuild/checksums,
  backup/restore evidence, typecheck, ESLint and ordinary production build all pass.
  Log: ignored `test-results/docker-full-verification.log`. The earlier crash did
  not recur. Disposable clusters cleaned up; normal development data preserved.
- Docker Desktop was started, but its Linux engine endpoint remained unavailable.
  Actual `docker compose ... build app setup` failed connecting to
  `dockerDesktopLinuxEngine`; no image build/start or PostgreSQL-16/Node-22
  container smoke result is claimed. No container/volume was created.

Next: start a working Linux Docker engine, run the guide's build/up, confirm setup
exit 0/app healthy and synthetic login, then restart and verify persisted data.
Live public HTTPS remains separate and explicitly deferred.

Authorized local commit grouping:

Infrastructure: `8b4fef4`; tests: `5ee29bb`.
The final documentation commit records the guide, evidence and updated authorization.

```text
P06-M02-T03: add Docker app and PostgreSQL setup
P06-M02-T03: test Docker readiness and data preservation
P06-M02-T03: document Docker operations and verification
```
