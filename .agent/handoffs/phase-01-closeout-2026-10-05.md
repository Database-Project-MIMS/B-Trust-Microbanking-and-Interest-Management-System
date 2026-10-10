# Phase 1 closeout — 2026-10-05

## Authorization and ownership

Vibodha explicitly requested: “resolve those remaining checks, reconcile task statuses,
and record phase approval.” The earlier prohibition on commits, merges and PR creation
continues to apply. This authorizes the identified cross-member fixes in the current
checkout. M1 and M4 retain ownership; no ownership transfer is intended.

Affected contracts: M4 migration/rebuild/verification scripts and channel tests; M1
authentication, parameter administration and admin health access; M4 health service,
route/page and meaningful tests; shared phase/task/state documentation.
The Windows seed loader also needs CRLF trimming so its existing ordered files load.
Grant and seed-check scripts use the shared lib/db tooling client, keeping pg imports
inside lib/db. The final 107-test DB run and additive grants/ledger verification pass.
M3's account deletion test is reconciled with PostgreSQL 18's RESTRICT SQLSTATE;
M4's transaction tests use the published mapped error's lowercase `sqlstate` field.

## Architect blueprint

- Phase approval means a recorded human go-ahead backed by passing exit checks. It
  does not imply a merge, PR, lecturer scope approval, or completion of Phase 2.
- Health uses a validated `mims_session`. All authenticated roles may read basic
  status; only ADMIN/CENTRAL_OPS receive pool/migration details or the health page.
- Route handlers call a service. Pages authorize before fetching restricted data.
- Verification checks every filename and checksum against the migration ledger.
  Applied migration files remain immutable; tests use disposable fixture copies.
- Rebuild proof runs in a disposable PostgreSQL cluster with synthetic data. Existing
  `mims_dev` is preserved. Passwords remain ephemeral and are never persisted in docs.
- Confirm Phase 1 behavior through DB/API/workflow tests, typecheck, lint and build;
  update statuses from that evidence, then record the user's approved Phase 2 entry.

This blueprint follows the user's requested fixes and the existing project contracts.
Validation results and any outstanding conditions will be recorded in the checkpoint.

## Review — verified Phase 1 closeout

**Layer 1 — Plan alignment: PASS.** Required health, migration integrity, rebuild,
seed, authentication/session and parameter repairs are implemented. Stale task rows
were reconciled from code and tests; the existing customer branch remains unimplemented.

**Layer 2 — System integrity: PASS for closeout scope.** Routes call services; pages
authorize before restricted queries. SQL is parameterized, money remains strings/SQL,
pg imports are confined to lib/db, sessions/audit writes share the caller transaction.
UI follows registered tokens and its patterns are recorded by /imprint. No immutable
migration was edited and cross-member ownership is unchanged.

**Layer 3 — Phase readiness: PASS.** A disposable PostgreSQL 18.6 clean rebuild and all
184 tests pass with zero failures/skips; typecheck, lint and production build pass.
Tests cover real sessions, forged/expired/revoked tokens, role and SQL branch denials,
strict CSRF, origin checks, audit rollback, migration tampering and failed-DDL rollback.
The local 11-migration ledger verifies after additive migrations/grants, with data retained.

**Limits:** This is a Phase 1 gate, not full product/deployment certification. UI visual
screenshots were not captured; verification uses builds and request/service workflows.
RLS, customer/holder/mandate, financial posting and full transactional seeds remain later
tasks. User-controlled review/publication is pending because commits/merges/PRs were
explicitly prohibited. Phase approval applies only to this verified working tree.

**Persistent state:** /remember save refreshed memory.md and member context under the
user's explicit documentation reconciliation request. All five overview summary tables
were reviewed; newly verified complete rows are struck through, and partial work is labelled.
See [checkpoint](../checkpoints/phase-01-checkpoint.md) for the approval record.
