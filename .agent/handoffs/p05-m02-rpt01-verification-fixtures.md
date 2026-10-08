# RPT-01 verification fixture compatibility — M2 → M4

**Date:** 2026-10-08 · **Task:** P05-M02-T01 · **Branch:** feat/p05-m02-rpt01-view

The first clean full run passed all 12 new view checks, but failed 2 of 643 total
tests before reaching build checks. The disposable cluster was cleaned up.

1. M2's 0320 upgrade regression drops attribution columns to reconstruct the older
   schema. New 0520 depends on those columns. Explicitly DROP VIEW IF EXISTS
   vw_rpt01_agent_transactions inside that test's existing rollback transaction;
   do not DROP CASCADE or change a merged migration. Rollback restores the view.
2. M4's newly merged withdrawal fixture inserts the two joint holders in separate
   statements. Existing 0242 validates the holder set after each statement, so its
   setup fails at the first holder (minimum two). Insert PRIMARY and JOINT in one
   parameterized statement, matching the established account-opening convention.

The M4 test fixture change is necessary to complete the shared verification required
for this task. M4 retains ownership; no source routine, constraint, service, grant,
seed or migration from another owner is changed. Mention the test-only cross-owner
fixture correction in the user-created PR. No ownership shift. M4 reviews this one
fixture edit through the normal teammate review, not a financial behavior change.

## Repeat full-run result: M4 withdrawal implementation defects

The fixture correction allows all ten withdrawal subtests to execute; all fail,
plus their parent. All other 642 tests pass (653 total, 61 suites). The report view
and the 0320 upgrade regression pass. These failures are not caused by 0520:

- Merged `0362_p03_m04_sp_post_withdrawal.sql` writes `after_value`, which the
  audit schema does not contain (SQLSTATE 42703); actor_type is valid.
- It uses `PERFORM sp_write_rejection_audit(...)`, but that object is a procedure
  and requires CALL (SQLSTATE 42809).
- The test expects rejection audits to survive a withTransaction rollback. A
  write followed by an exception in the same transaction cannot persist that audit;
  M4/M1 must agree the rejection-auditing transaction contract.

M4 must fix the financial implementation through a new migration in M4's block;
0362 is already merged and immutable. M2 has not changed a producer, financial rule
or audit interface to make report verification pass. Do not suppress these failures
in the shared runner, mark M4's row differently, or declare full acceptance passed.
The isolated unaffected-suite/build check explicitly excludes this one known failing
file; its output is supplementary evidence, not a passing full-suite result.

**Subsequent authorization:** Vibodha authorized M4 corrective implementation and
its documentation. ADR-0021 reopens T03 on this checkout; new 0363 repairs the
procedure/audit/retry contract. The failures above describe the pre-repair state;
final full verification will supersede the blocker without editing merged 0362.

**Resolved:** 0363 and rewritten guarded withdrawal tests pass the full combined
663-test /62-suite run, 34-migration rebuild/checksums and typecheck/lint/build.
No exclusions in the final run. The final evidence is in the RPT-01 and M4 repair
handoffs; earlier failures/supplementary checks are historical diagnostics only.
