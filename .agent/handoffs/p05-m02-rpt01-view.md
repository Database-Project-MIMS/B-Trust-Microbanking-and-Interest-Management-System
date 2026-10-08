# P05-M02-T01 — RPT-01 SQL view handoff

**2026-10-08 · M2 → M1/M4/M5 · feat/p05-m02-rpt01-view · base/HEAD 48f4185**
**Status:** Verified locally, REVIEW; user publication/teammate review pending.

## Delivery

0520 creates owner-only invoker/barrier `vw_rpt01_agent_transactions`. It preserves
exact posting timestamps, captured branches and unsigned type totals, with bigint
counts and unbounded NUMERIC sums. Current branch metadata is explicitly separate.
All attribution profiles in agent remain, including inactive/manager/role-changed
staff. NULL agent history is excluded; NULL posting branches remain bankwide facts
and cannot enter a scoped branch report. No backfill or signed reversal/net guess.

The corrected [task-card SQL](../../2_Vibodha/09_P5_rpt01-report.md) LEFT JOINs the
eligible roster to already-filtered view facts, so agents with activity only outside
the range still appear as zero. Current members plus identities with matching
posting-branch history make the branch roster transfer-safe. Do not scope facts with
agent_branch_id or filter an all-time outer join afterwards. An empty-history view
row has NULL date/type/posting branch and zero count/value.

## Consumer obligations

M1/I-7 must provide current-caller role/branch validation, SQL scope, underlying
transaction RLS, runtime grants, metadata, shared CSV and access auditing before
T02 enables a live report. No PUBLIC/mims_app SELECT grant is supplied by 0520.
Bankwide filters are permitted only for authorized roles; branch reports must not
display another branch's current roster metadata. Preserve money/count strings.
T02 API/screen/CSV remains TODO; general Phase 5 entry remains unapproved (ADR-0020).

M4's repaired withdrawal now captures trusted AGENT/branch attribution (0363), but
other producers/seeds still retain their owners' integration responsibilities.
Report attributed totals reconcile to attributed ledger rows, not every unattributed
legacy/system row. Disclose this coverage; do not invent an agent. Reversal-aware net
still needs M4's linked reversal contract. M5/T02 measures the final report queries.

## Verification and review

Final full isolated run: **663 tests /62 suites, 0 failures/skips**, no exclusions;
clean **34-migration** rebuild and checksum verification; typecheck, lint and
production build PASS. RPT-01 has 12 new SQL regressions. The 0320 pre-upgrade test
temporarily drops the new dependent view inside its rollback transaction.

Selective agent/time EXPLAIN ANALYZE on 20,000 additional synthetic history rows
uses **Index Scan ix_transaction_agent_date**, with both agent and timestamp bounds
in Index Cond; 7 input postings yield 4 type totals. Execution **0.240 ms**, planning
**0.926 ms** in the final run. No enable_seqscan override or new index. This is a
selective-view probe, not final paginated/CSV performance acceptance. Ignored plan:
test-results/rpt01-view-explain.json. Full log:
test-results/rpt01-withdrawal-final-verification.log.

/review: plan PASS (view-only T01; scoped M4 correction separately authorized),
system PASS (immutable new migrations, exact SQL, invoker security, no live API/UI),
readiness PASS (range/zero/transfer/NULL/precision/privilege/state tests and full checks).
Initial shared failures are diagnosed in the fixture handoff and resolved by the
[M4 repair](p03-m04-withdrawal-contract-repair.md), authorized under ADR-0021.
No remaining feature defect. No UI change, so /imprint is not applicable.

Normal development database preserved; verification clusters cleaned up. Both
tasks remain local REVIEW; user owns staging, commit, push, PR and merge. Include
P05-M02-T01 and P03-M04-T03, migrations 0520/0363, and the M4 correction in the PR.
