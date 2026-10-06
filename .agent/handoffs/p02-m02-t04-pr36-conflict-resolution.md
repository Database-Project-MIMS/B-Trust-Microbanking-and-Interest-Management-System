# PR #36 — customer-registration conflict resolution

2026-10-06 · M2 · feat/p02-m02-customer-registration → dev

## Scope and diagnosis

User requested local conflict resolution, retaining commit/push/merge control.
Feature HEAD c0f7659 matches its remote; fetched dev is 76701e7 (closeout fad4f13/PR #33).
As with PR #34/#35, this feature branch predates the dev closeout, causing conflicting
documentation snapshots. Targeted resolution preserves feature customer/relation/service
work and dev security/session/health/parameter/tooling repairs. Local merge uses
--no-commit --no-ff; no feature/target branch is advanced by the assistant.

Resolve all nine screenshot documents, retaining the historical checkpoint while updating
current statuses: P0 6 DONE, P1 19 DONE, P2 6 DONE/1 BLOCKED/9 TODO. All 97 tasks:
31 DONE/1 BLOCKED/65 TODO. T01–T04 implemented; M3 account/M4 transaction implemented;
T05 remains blocked on M1 scoped grants/RLS/audit. No later phase approval or new UI.

## Integration and ownership notes — recorded before edits

Two distinct ADRs used 0013. Keep dev's phase-one ADR-0013 and renumber the M2 customer
numbering/scope record to ADR-0014, preserving its decision and updating only its own
references and the index. This is identifier reconciliation, not a new schema decision.

M2 relation fixture guard must accept the restored full harness's mims_test_closeout
only when MIMS_ISOLATED_TEST=1, alongside the focused disposable database. Add regression
coverage rejecting development/unapproved names, retaining the existing guard boundary.

M4 ownership note: scripts/verify-phase-01.mjs provisions a fresh temporary cluster.
Registration's actual SET ROLE mims_app regression requires granting that disposable
role to the disposable owner (GRANT mims_app TO mims_owner). Add it solely within the
fresh cluster bootstrap. Never grant the owner role to mims_app. No production roles,
runtime grants or RLS are modified; M4 keeps ownership of this harness.

M1 ownership note: remove only the extra EOF blank line in the incoming parameter-admin
component for the staged whitespace check. Its behavior and M1 ownership are unchanged.
The resolver does not change application service logic or numbered migrations.

## Verification and review

Combined verification PASSED on 2026-10-06 using npm run verify:phase1:
328 tests in 31 suites, 0 failures/cancellations/skips; clean 14-migration rebuild,
checksum verification, TypeScript, lint and optimized Next.js production build.
The command exited 0 with PHASE 1 CLOSEOUT: all checks passed.
The first combined run exposed two committed synthetic accounts left by the M2 holder
contract fixture, causing the later seed minimum check to fail. The fixture now tracks
its account IDs outside the try block and removes only those rows after dropping its
temporary holder table. Seed rules and application services are unchanged; the complete
rerun verifies both the holder contract and subsequent seed validation.
Historical T04 focused evidence: 181 selected tests with clean 14-migration rebuild/checks.
Fresh log: test-results/pr36-conflicts.log (ignored). Normal development data is retained.

Plan alignment: retain registration/search/profile/validation and existing relation work,
plus dev closeout. System integrity: immutable migrations retained, no ownership transfer,
least-privilege runtime access unchanged. Owner service tests do not certify RLS; actual
app-role test uses temporary customer grants. Account links use a synthetic test fixture,
not a delivered M3 holder migration. T05 API/session/CSRF/UI integration remains separate.
Existing T03 verifier role lock is documented for correction before exposure; no broad
role UPDATE privilege is added. No new UI: /imprint not applicable. /remember save updates
current state. Final review includes tests/rebuild/typecheck/lint/build and index/marker checks.

## Publication

User commits the pending local merge, pushes the feature and merges PR #36 into dev.
The assistant creates no commit, push or completed merge. Suggested message:
P02-M02-T04: resolve dev conflicts and reconcile registration integration.
