# P03-M04-T03 — withdrawal correction handoff

**2026-10-08 · M4 ownership retained · user-authorized cross-member implementation**
**Checkout:** feat/p05-m02-rpt01-view · base/HEAD 48f4185
**Status:** Verified locally, REVIEW, pending user publication/teammate review.

## Repair

New 0363 preserves merged 0362 and all table shapes. Audit writes use existing
actor_type/new_values; real limits are WITHDRAWAL_SINGLE_LIMIT/WITHDRAWAL_DAILY_LIMIT.
The invoker core validates exact positive cents, active channel/current actor/context,
staff branch/agent assignment or linked customer scope, serializes keys, locks account,
revalidates calendar/mandate/Colombo-day limits/minimum, and atomically writes attributed
ledger, balance and success audit. Replay binds the exact original actor/payload and
canonical signer set; cross-payload reuse fails safely. Customer self-service cannot
claim another holder signed. Only an AGENT is automatically the reporting agent.

The array-signers sp_post_withdrawal overload supports I-4 ALL_HOLDERS. Its original
single-customer overload remains callable. `sp_try_post_withdrawal` adds an OUT
p_rejection_code and is the audited entry. A known financial rejection rolls back
the inner financial subtransaction, CALLs the repaired helper to write one outer
audit, and returns NULL financial outputs plus a known code. All procedures are
SECURITY INVOKER, explicitly executable by mims_app, revoked from PUBLIC, and never
commit. Validation/auth/configuration/unexpected errors propagate and roll back.

**Critical T05 contract:** return the result from withTransaction; commit an
audit-only rejection result before mapping its allow-listed code to a safe domain
error outside the transaction. Throwing within that transaction loses the audit.
Legacy throwing calls cannot preserve an audit after caller rollback. Use trusted
signer evidence and current authentication/CSRF/role/branch scope in the service;
do not pass arbitrary signer IDs from JSON. No route, UI or shared auth file is added.
M1 retains audit/runtime security integration review. General phase gates unchanged.

## Evidence

21 guarded SQL regressions cover exact posting/success audit, all six persistent
financial rejection audits with no debit/ledger, ALL_HOLDERS, replay/mismatch, input
precision/non-finite values, channel/actor/branch/context, AGENT attribution, calendar,
Colombo-day totals under another timezone, same-key races, competing debits,
unexpected audit-failure rollback, legacy signature and mims_app execution.
Joint holders are inserted together; no JS number money arithmetic remains in the
rewritten withdrawal tests. All fixtures are synthetic/disposable and restore limits
and calendar state; normal development DB is untouched.

Full final combined run with **no exclusions: 663 tests /62 suites PASS**, 0 failures/
skips, clean **34 migrations** and checksums, typecheck/lint/production build PASS.
Ignored evidence: test-results/rpt01-withdrawal-final-verification.log.
Earlier failed runs and the explicitly supplementary unaffected run are superseded.

/review: plan PASS (corrective T03 scope, no future API/UI work); system PASS (new
M4-block migration, caller transactions, exact arithmetic, scope and immutable history);
readiness PASS (negative/concurrent/runtime/rollback tests and full shared checks).
No unresolved implementation defect. Future T04 reversal and T05 service/API work
retain their own dependencies. /imprint not applicable. /remember saved; M4 task
card/overview/member state, phase/shared contracts and tracker updated.

Both T03 and M2 T01 are local REVIEW. User owns commit/push/PR/merge. The user-created
PR must mention both task IDs and new migrations 0363/0520, explaining the audited
rejection boundary and explicit cross-member authorization (ADR-0021).
