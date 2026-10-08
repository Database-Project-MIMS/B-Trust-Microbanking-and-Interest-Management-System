# ADR-0020: RPT-01 aggregation grain and scoped T01 start

**Date:** 2026-10-08 · **Status:** User-authorized M2 implementation; M1/M4 report integration review retained
**Task:** P05-M02-T01 · **Branch:** feat/p05-m02-rpt01-view

Vibodha's “do it” authorizes this database-only early start after the phase gate and
I-7 dependency were explained. P03-M02-T01 is DONE (PR #49). P04-M02-T02 is now DONE
(PR #62, dev 48f4185); its local REVIEW label was stale. General Phase 5 entry is
not approved. T02 API/CSV/screen integration still depends on M1's I-7, CSV utility
and report-access auditing. The assistant does not stage, commit, push, create a PR
or complete a merge.

## Blueprint

- **Agent:** an attribution identity in `agent`, including the manager staff subtype
  established by ADR-0006. Current role or inactivity must not erase ledger history.
  This roster is distinct from the set of users authorized to request a report.
- **Branch:** `transaction.branch_id` is the captured posting branch. The separate
  `agent_branch_id` is current roster metadata; it never substitutes for a NULL or
  historical posting branch.
- **Value:** exact positive posted amount by type, not signed balance movement.
  REVERSAL remains a separate type. Net/reversal presentation belongs to T02 with
  M4's reversal contract; no guessed direction or changes to financial producers.
- **Date range:** inclusive Colombo calendar dates become a half-open timestamp
  interval. Use the actual `transaction_date` and `ix_transaction_agent_date`.

New immutable migration 0520 creates `vw_rpt01_agent_transactions` at grain
`(agent_id, branch_id, transaction_type, transaction_date)`. Retaining the exact
timestamp lets arbitrary ranges filter before final aggregation and lets existing
agent/date indexes participate. Each row carries bigint `transaction_count` and
unbounded NUMERIC `total_value`; neither SUM nor its consumer is narrowed to
NUMERIC(15,2). COUNT(transaction_id), not COUNT(*), gives empty roster rows zero.

The view includes an undated zero row for profiles with no attributed history.
For *any selected range*, consumers must LEFT JOIN the full eligible roster to
date/branch-filtered view facts, then SUM counts/values by agent/type. Filtering
an all-time LEFT JOIN afterwards would wrongly drop an agent whose history falls
entirely outside the range. For a branch, the eligible roster is current members
plus identities with matching posting-branch facts in the range, so a transfer
does not erase the old branch's history. NULL agent attribution is excluded; NULL
posting branches remain bankwide facts but cannot enter a scoped branch report.

The view is SECURITY INVOKER and SECURITY BARRIER, with no PUBLIC or mims_app
SELECT grant. This DB-only delivery cannot expose a live report: M1 owns report
authorization/RLS/grants and transaction RLS is not assumed to be complete.
T02 must establish those protections before runtime access is enabled. No owner
source, merged migration, financial table shape, UI, route or seed is changed.

## Implementation and verification

1. Record scope/status and correct the task card's COUNT/date/index examples.
2. Add 0520 and SQL regressions for exact type totals, zeros inside/outside ranges,
   Colombo boundaries independent of connection timezone, transfers, NULL attribution,
   inactive/manager profiles, caller privileges and unchanged financial state.
3. Measure EXPLAIN ANALYZE with a selective agent/time filter on synthetic history;
   retain the measured plan without disabling sequential scans or adding an index.
4. Rebuild and run the complete isolated suite, typecheck, lint and production build.
5. Run /review, update M2 docs/overview and /remember, and write the M1/M4 handoff.
   Record verified local T01 as REVIEW pending user publication; T02 stays TODO.
