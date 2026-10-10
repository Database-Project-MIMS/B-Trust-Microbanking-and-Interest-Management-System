# P05-M02-T01 full verification — M4 withdrawal blocker

**RESOLVED 2026-10-08:** user-authorized M4 correction in new 0363 (ADR-0021).
Final full run passes 663 tests /62 suites, 34-migration rebuild/checksums,
typecheck/lint/build, with no exclusions. See
[repair handoff](../handoffs/p03-m04-withdrawal-contract-repair.md).
The following records the earlier failure, not a current blocker.

**2026-10-08 · Owner to resolve: M4, with M1 audit coordination**

RPT-01's 12 SQL checks and all other non-withdrawal tests pass. The full isolated
run has 642 passes /11 failures out of 653 tests (61 suites): every failure belongs
to the newly merged withdrawal test and its parent. No report code writes money.
The [fixture/diagnostic handoff](../handoffs/p05-m02-rpt01-verification-fixtures.md)
records the incompatible audit columns, procedure invocation and rollback/audit
contract. M4 needs a corrective migration; merged 0362 must remain unchanged.

M2's T01 can be reviewed locally but cannot be marked DONE or described as full
verification PASS while this shared failure persists. General phase entry remains
pending. T02 independently waits for M1's I-7/CSV/access audit publication.
