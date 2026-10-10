# Neon migration deployment — infrastructure handoff

2026-10-10 · user-requested contribution · original owners retain stewardship.

Scope: new `.github/workflows/neon-migrations.yml`, safe connection validation,
non-destructive deployment entry point, regression tests, `.env.example` cleanup
and setup/state documentation. M1 retains deployment/secrets responsibility;
M4 retains database tooling stewardship. No existing migration, domain/API/UI
code, schema ownership or member task acceptance changes.

GitHub environment secrets, Neon role/ownership setup and a live Actions run
remain external setup.
Keep the migration owner URL out of the application runtime. Rotate any exposed
Neon credentials; clearing an example cannot revoke a password or erase history.

The user subsequently authorized a few local commits. Infrastructure is committed
as `9a1dd44`; tests are `61b641e`; documentation is a separate commit. No push, PR, merge
or live Neon migration is performed in this request.

## Verification and review

Local `npm run verify:phase1 -- --tap`: 3,410 tests /116 suites pass with zero
failures, cancellations or skips (2,240 security + 1,170 API/DB/e2e tests).
Clean 70-migration rebuild/checksums and backup/restore evidence pass. Typecheck,
lint and Next 15.5.27 production build pass. Final marker:
`LOCAL VERIFICATION: all checks passed.`
Host uses Node 24.15.0/PostgreSQL 18.6; Actions pins Node 22/PostgreSQL 16.
The actual hosted Actions/Neon run remains unverified until environment setup.

Deployment-specific checks prove initialization without seeding, two reruns
preserving users/accounts/ledger/payouts/audit/migration records, rejection of
missing owner URL even with a runtime URL, and transaction rollback of a runtime
function when a later SQL stage fails. Four configuration tests cover direct TLS
URLs, malformed/pooled/wrong-role/insecure URLs, safe credential-free diagnostics
and empty secret fields in the example. Workflow YAML parses; its event/dependency
gate and concurrency configuration were checked. `git diff --check` passes.

The first sandboxed initdb attempt failed on Windows temporary WAL file rename
permissions. The approved run outside the sandbox uses only an isolated local
cluster. No production or development database is used by the verification.

`/architect`: implementation blueprint is ADR-0029, resolved from the user's
explicit infrastructure request and existing deployment/branch rules.
`/review`: plan alignment and architecture pass; no unresolved code findings.
External setup/hosted execution is a recorded verification limit. No schema,
financial rule, API, UI or migration edit; `/imprint` does not apply.
`/remember save`: additive session notes retain the existing memory/context.
All five overview tables reviewed; only M2's supplement changes, with no newly
accepted task or additional strikethrough. Existing phase gates remain pending.
