# P04-M02-T02 — M2 FD scope handoff to M1/M3/M5

**Date:** 2026-10-08 · **Branch:** feat/p04-m02-fd-branch-scope
**Base:** dev e9291dc (T01 merged PR #60) · **State:** verified locally, REVIEW

Vibodha authorized T02's scoped read-side start; ADR-0019 records the blueprint.
T01's service/view already apply both branch predicates, agent assignment and self
link scope. T02 adds a restrictive SELECT-only stored-actor guard in M2 migration
0421 to reject missing/forged/stale context when service checks are bypassed.
M1 owns security stewardship, M5 owns fixed_deposit; review this additive policy.
No shared role/auth source, owner migration or financial writer is edited. Ownership
does not shift. Future runtime FD writers still require owner-reviewed write grants
and policies; the guard neither grants access nor authenticates sessions.

Only the M2 customer FD route/service/view currently reads customer FDs in this slice.
M5 report/global FD endpoints and M3 account panels remain owner integration work.
M5's existing RPT-03/RPT-04 views use PostgreSQL's default view-owner security; their
role/scope contract needs owner review before runtime exposure. General phase gates
and lecturer questions stay pending; M2 completion applies to its current read path.

0421's owner-only installer is invoked after 0420 by the existing customer-fd-summary.sql
binder after all migrations. On an existing FD schema, 0421 binds directly. Use the
ordinary migration runner and binder/rebuild workflow; no merged migration changes.

## Verification

Full `npm run verify:phase1` PASS: **630 tests /60 suites**, zero failures/skips;
clean isolated **31-migration** rebuild/checksum verification, typecheck, lint and
production build. Log: test-results/fd-branch-scope-verification-final.log (ignored).
**14 new cases: DB10/API4** use real mims_app/context/session reads. Direct reads
reject role-only, missing/nonexistent identity, role escalation, missing/forged/stale
branch, inactive user/role/profile/branch and missing profile. Tests retain correct
joint/self/assignment scope, bankwide access despite a historical staff profile,
branch transfers, self-link changes, COMMIT/ROLLBACK cleanup and installer denial.
Idempotent binders preserve the restrictive guard and financial state. Existing
T01 positive/negative/API/formatting tests continue to pass unchanged.

The initial combined run had one branch-constraints file-level failure without a
diagnostic (all new cases passed). The unchanged file passed 4/4 alone with TAP
diagnostics and the repeat full run passed 630/630. Cause was not reproduced; no
branch-test or production workaround was introduced. Ignored diagnostic evidence:
test-results/fd-scope-branch-debug.log and fd-branch-scope-verification.log.
Both verification clusters cleaned up. Normal development DB not migrated/reset.

## /review — three layers

1. **Plan alignment PASS:** existing M2 scope reviewed; direct SQL stored-context
   gap closed with an additive read guard; no duplicate API or other-owner work.
2. **System integrity PASS:** 0421 in M2's block, stable invoker function, restrictive
   SELECT-only policy, owner-only idempotent installer; existing parameterized SQL,
   service transaction/session checks and invoker view retained. No merged migration,
   shared auth/role source, financial writer, table columns or DTO/UI changes.
3. **Readiness PASS for the M2 slice:** full rebuild/tests/type/lint/build pass,
   negative/transition/borrowed-client tests cover fail-closed scope. Initial test
   process failure recorded above. No unresolved feature defects; M1/M5 policy review
   and future owner read-path integration remain external review work.

No UI change, so T01's /imprint/browser evidence is retained without a new layout
pass. /remember saved; all five overview tables reviewed, only M2 updated. Tracker:
48 TODO /1 REVIEW /48 DONE (97). Changes unstaged/uncommitted on e9291dc; user owns
commit/push/PR and merge. PR description must include this additive M1/M5 policy review.
