# P06-M02-T01 — authorized integration failure repairs

**Date:** 2026-10-09 · **Contributor:** M2 · **Status:** verified locally; user publication pending

After the 29 full-suite failures were reported, Vibodha explicitly instructed:
“you should fix those failueres. you can change others code as well.” This
authorizes the necessary cross-owner repairs; original stewardship remains.
Vibodha subsequently instructed “commit them using few commits,” authorizing
grouped local commits. Push, merge and PR creation remain with the user.

## Diagnosis and plan

This is a collection of specific failures (/recover targeted repair), not a
reason to reset the working tree or weaken security/financial rules. The plan
uses production session creation, explicit fixture RLS identity, real stored
roles, database-derived dates, the existing audit service contract and typed
withdrawal signatures. Both current branch and latest-dev export must pass the
full unfiltered API/DB/e2e suite. No developer database is rebuilt.

## Stewardship and repairs

- M1: audit and interest request routes and new service modules, audit/worker/
  parameter/business-rule tests. Session fixtures previously put 64 hex chars
  in a UUID and used the wrong token hash. Real `createSession` now supplies
  the DB UUID/hash contract. Audit denial now returns its safe 403 envelope;
  query validation/pagination and SQL live in the service. Interest session
  requests enforce CSRF and preserve 403 instead of falling back to worker
  authentication. Request validation precedes its transaction-owned audit.
  The pre-existing request endpoint still records requests; this repair does
  not implement the separate M5 cycle execution/orchestration requirement.
- M2/shared tests: committed fixtures have explicit transaction-local ADMIN
  setup context in the approved disposable database, discarded on commit.
  Runtime routes continue enforcing the stored user's actual role and scope.
- M3: plan eligibility tests calculate both birthday boundaries from SQL
  CURRENT_DATE instead of mixing local JS dates with UTC serialization.
- M4: reversal/running-balance tests call an explicit uuid signer overload and
  use a real active ADMIN when setting ADMIN RLS context. No authorization
  routine, constraint, grant or merged migration is weakened.
- M1/M4 audit tests use `rejection_reason`, `reversalTransactionId`, transaction
  entity type and `logged_at`; the DB test owns its account/transaction and
  rolls back fixtures instead of deleting unrelated audit rows.
- M1 business-hours tests use the database's Colombo date and full-day calendar
  hours; prior calendar/parameter values are restored. Ledger immutability is
  never disabled for cleanup.
- M4 RPT-05 CSV assertion parses the quoted financial strings emitted by the
  existing CSV helper; it still compares exact values with JSON totals.

There is no ownership transfer or task reassignment. See the seed delivery
handoff for migration 0620 and the underlying AC-12 seed completion. Verification: current **865 tests /87 suites**, latest-dev overlay **940 tests
/95 suites**, all pass with zero failures/cancellations/skips. Final focused
seed/date coverage **186 tests /15 suites**; current46/latest51 migration rebuilds,
checksums, measured reseeding, global seed checker, typecheck and lint pass.
The final integration logs and focused logs are listed in the seed handoff.

Verification ran with this host's Node 24.15.0 and PostgreSQL 18; the repository's
Node 22 pin (`.nvmrc`) is preserved. These logs do not claim a separate Node 22 run.

/review: diagnosis/plan alignment PASS; system integrity PASS (stored identity,
CSRF, parameterized service SQL, no merged migration edits/trigger disabling);
regression readiness PASS (full API/DB/e2e with no exclusions plus negative
role/CSRF/body/date/pagination checks). No UI change; /imprint N/A.

The full-suite results supersede the earlier failing diagnostic. They certify
the existing regression suite, not general Phase 6 gates or the separate
independent-per-FD commit/orchestration requirement. The normal database was
preserved; temporary clusters are stopped and cleaned up. Local commits are now
authorized; no remote publication or merge is authorized.
