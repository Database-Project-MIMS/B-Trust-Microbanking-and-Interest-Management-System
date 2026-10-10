# P06-M02-T02 — Master-data integrity tests

**Date:** 2026-10-09 · **Owner:** M2 · **Branch:** `feat/p06-m02-master-data-integrity`
**Base:** `fe7034f` · **Authorization:** ADR-0025, explicit blueprint confirmation.
**Local test/tooling commit:** `a58112e`; documentation/state committed separately.

## Delivery

`tests/db/master-data-integrity.test.mjs` adds 100 direct-SQL cases against M2's
branch, agent, customer, customer_agent and customer_document tables. Each test
owns a synthetic graph inside a rolled-back transaction. Expected failures use
savepoints and assert the exact SQLSTATE and named constraint/column; successful
rollback preserves the original row. No configured database is rebuilt.

Coverage includes all five primary keys, eight UNIQUE constraints, eight foreign
keys, four table CHECK constraints, 47 NOT NULL fields, the two record_status
domain uses, active-branch triggers and the one-active-assignment partial index.
An explicit catalog manifest fails if a new key/check/FK/required field lacks
coverage. Duplicate INSERT/UPDATE, invalid birth dates, assignment reactivation,
history intervals and both directions of half-verification are exercised.
Each inbound master-data deletion FK is isolated from competing child links,
including inactive history. Customer deactivation retains optional login,
assignment and document identity.

`tests/api/master-data-integrity.test.mjs` adds 16 real-controller cases. A guarded
disposable database holds committed fixtures; a runtime assertion confirms
`mims_app`. Production session/CSRF checks execute. Rejected requests must preserve
complete master-row snapshots and audit counts. This includes duplicate agent
creation and a duplicate profile update after tentative login deactivation,
normalized duplicate customer registration and denied/CSRF-rejected mutations.
ADMIN and manager deactivation retain referenced profiles/logins/customer history,
produce sanitized atomic audit events and invalidate the old agent session.
Branch deactivation retains a customer FK, lists as inactive and rejects new staff.

Customer deactivation has no existing PATCH route: owner SQL plus authorized
profile/search reads proves retention. The suite asserts that no master DELETE
or customer PATCH handler has been introduced. This task does not add an endpoint.

`npm run verify:master-data-integrity` reuses the customer verifier with the
existing relation/registration tests and the new integrity suites. It initializes
a fresh temporary PostgreSQL cluster, rebuilds, checks migration checksums,
executes focused regressions, typechecks and lints, then stops/removes the cluster.
The helper's obsolete assumption that db:rebuild creates a database was repaired:
it now creates its fixed disposable database first and uses explicit environment
connections without loading developer .env values into the rebuild command.

## Verification

Focused proof: **309 tests /14 suites**, zero failures/cancellations/skips;
clean **51-migration** rebuild/checksum verification, typecheck and lint PASS.
Full proof: **1062 tests /98 suites**, including the 6 security cases, zero
failures/cancellations/skips. Final-source typecheck/lint PASS. Both verification
harnesses stopped and removed their disposable clusters; development DB preserved.
Logs: `test-results/p06-m02-master-data-focused.log` and
`test-results/p06-m02-master-data-full.log` (ignored).

Host tools are Node 24.15.0/PostgreSQL 18.6; `.nvmrc` remains Node 22.
No claim of execution on Node 22/PostgreSQL 16 is made.

## /review

Plan alignment: PASS — all ten T02 checklist items have named database/API
evidence. Customer retention is tested through its actual read-only route contract.
System integrity: PASS — fixed SQL identifier allow-lists, parameterized values,
existing lib/db access, real runtime role, no altered migration or financial rule.
Readiness: PASS — full suite and final-source typecheck/lint pass. The initial API assertion expected
FORBIDDEN for a cross-branch domain denial; corrected to the implemented
NOT_AUTHORIZED code. No production policy was weakened. No UI changed; /imprint N/A.

## Integration and next steps

Task status is REVIEW pending user publication/review. Vibodha authorized local commits and fixes in
other owners' code if failures need them. This delivery so far changes only M2
tests/tooling/documentation; no cross-owner production repair is needed.
General Phase 6 entry, T03, other owners' tasks, push, PR creation and merge are
separate. All five overview summaries were reviewed; only M2 state needs updating.
