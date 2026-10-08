# Memory — RPT-01 view and authorized M4 withdrawal correction

**Updated:** 2026-10-08 · /remember save
**Branch:** feat/p05-m02-rpt01-view · HEAD 41e2e76 · pending integration of dev d466866

## Latest conflict resolution

PR #67 is open. Resolved docs/09_task-tracker.md against dev d466866 without
discarding either side's task statuses. All 97 task IDs remain unique; summaries
now record 34 TODO /2 REVIEW /61 DONE. M1's I-7/CSV/access auditing is published
through PR #65. RPT-01 and corrective M4 withdrawal remain REVIEW until PR #67
integration; T02 awaits T01 integration and start authorization. M4 reversal/API
tasks are already DONE in dev. General phase gates remain pending.

Pending integration remains uncommitted and unstaged for the user. Documentation
checks passed; the 663-test evidence below is historical and was not rerun on this
combined tree. See .agent/handoffs/p05-m02-pr67-conflict-resolution.md.

The implementation and verification notes below describe the pre-integration tree.

## What was built

P05-M02-T01: new 0520 owner-only invoker/barrier vw_rpt01_agent_transactions,
12 SQL regressions and corrected date/branch/zero-row consumer contract. Exact
posting timestamps and captured branches remain available before final aggregation;
current roster metadata is separate. Counts/values stay bigint/NUMERIC strings.
Inactive/manager/role-changed attribution profiles retain history; NULL attribution
is not backfilled. T02 API/CSV/screen integration remains pending I-7.

Shared verification exposed defects in merged M4 withdrawal 0362. The user explicitly
allowed changing/creating M4 work and requested its documentation updates. ADR-0021
reopened P03-M04-T03; new M4 migration 0363 fixes audit schema/calls, real limit keys,
current actor/scope, exact input values, calendar/Colombo-day limits, trusted attribution,
I-4 array signers and serialized payload-bound retries. Legacy single-customer calls
remain supported. Rewritten guarded withdrawal tests have 21 cases. M4 ownership
remains unchanged. No merged migration or table shape was changed.

## Decisions and integration boundaries

ADR-0020 records only M2's database early start; ADR-0021 records the authorized M4
repair. General phase entry remains pending. sp_try_post_withdrawal rolls back inner
financial work on a known rejection, records one outer audit and returns a code;
T05 must commit that audit-only result through withTransaction, then map its safe
error outside the transaction. Unexpected errors abort everything. T05 must obtain
trusted signer evidence; customers cannot claim another holder signed. No API/UI,
shared auth or seed work was added. Runtime RPT-01 SELECT remains revoked until
M1/T02 establish report authorization/RLS/grants, CSV and access auditing.

## Current state

Full final guarded disposable verification PASS: 663 tests /62 suites, zero failures/
skips, no exclusions; clean 34-migration rebuild/checksums, typecheck/lint/production
build. Earlier failed and supplementary excluded-file runs are historical and
superseded. RPT-01 selective plan uses ix_transaction_agent_date with no planner
forcing (20,000 extra synthetic postings; 0.240 ms execution). Final report/CSV
performance remains future T02/M5 acceptance.

P04-M02-T02 is DONE through merged PR #62 (48f4185), its stale REVIEW reconciled.
P05-M02-T01 and corrective P03-M04-T03 are local REVIEW pending user publication/
teammate review; neither is marked DONE with unmerged changes. M2 and M4 task cards,
overviews/member state and shared tracker/schema/rules/contracts/inventory/phase docs
are updated. All five overview tables reviewed. Tracker: 46 TODO /2 REVIEW /49 DONE
(97). /review three layers PASS; no UI change so /imprint not applicable.

Normal development database untouched; verification clusters cleaned up. Changes
unstaged/uncommitted. No assistant commit, push, PR creation or merge. User retains
publication control. Handoffs: .agent/handoffs/p05-m02-rpt01-view.md and
.agent/handoffs/p03-m04-withdrawal-contract-repair.md. Ignored final evidence:
test-results/rpt01-withdrawal-final-verification.log and rpt01-view-explain.json.

## Next session starts with

Inspect user publication/merge state; a combined PR must list P05-M02-T01 and
P03-M04-T03 and migrations 0520/0363. Never publish automatically. Reconcile local
REVIEW only after actual user integration/review evidence. M2 T02 waits for T01
integration and its own start authorization; I-7/CSV/access auditing is now available.
M4 T04 reversal and T05 API tasks are DONE in dev; inspect their use of the corrected
withdrawal contract during the next feature's review. Apply new
migrations through the normal owner workflow before using them in the development DB.
