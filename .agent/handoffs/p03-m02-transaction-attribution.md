# P03-M02-T01: transaction attribution

**From:** Member 2 · **To:** M4 (posting), M3 (opening deposits), M1 (security), M5 (seeds)
**Date:** 2026-10-08 · **Branch:** feat/p03-m02-agent-attribution-activity
**Status:** implementation verified locally, REVIEW; user commits/pushes/opens PR/merges

Written before migration 0320, as required by the task card. M4's existing
`transaction-schema-handoff.md` explicitly reserves `agent_id`/`branch_id` for M2.
No table ownership shifts and no other member's source file is edited.

## Interface

0320 adds nullable UUID FKs `agent_id → agent(agent_id)` and
`branch_id → branch(branch_id)`, both `ON DELETE RESTRICT`, and B-tree indexes
`ix_transaction_agent_date` / `ix_transaction_branch_date` using `transaction_date`.
Existing column lists remain valid; omitted attribution remains NULL. Existing
ledger rows are unchanged. NULL attribution means unknown/unattributed, not zero
activity and not a reason to infer historical membership from `agent.branch_id`.

## Producer obligations before financial integration

- M4's future posting routines must write attribution inside the posting transaction
  from authenticated/authorized server context, never blindly from a request body.
- For an agent's own posting, capture the acting agent and operating branch. A manager
  or admin is not automatically a reporting agent; on-behalf-of attribution needs
  explicit authorization. Keep `initiated_by_user_id` as the responsible login.
- Capture the operating branch at posting time; do not reconstruct it from an agent's
  current branch or substitute the account's owning branch without defining that rule.
- System postings may have NULL agent attribution. Supply a known branch when the
  posting contract defines one; nullable branch also supports legacy/system records.
- M3's current account-opening routine omits both fields, so opening deposits remain
  unattributed until M3 adopts the interface in a new migration. M2 does not claim to
  have completed producer integration or amend immutable ledger history.
- M1 retains responsibility for transaction RLS/scope. An attribution index is not
  an authorization policy. M5 should populate attribution explicitly in future seeds.
- M4 reviews this schema contract before the user merges it. General phase approvals
  remain pending; only T01's early start is authorized (ADR-0016).

## Validation and review

`npm run verify:phase1` passed on a disposable PostgreSQL 18.6 cluster: clean
24-migration rebuild and checksum verification, 501 tests in 45 suites, zero
failures/skips, TypeScript, lint, and production build. This includes all 15 new
attribution tests and existing customer/account API regressions. The runner's
migration tests also prove reapplication/ledger integrity and failed-DDL rollback.
The normal development database was not reset or migrated.

The first run exposed new test-helper sequencing errors (queries were started before
their savepoint). Deferred callbacks fixed the helper; the fresh full run passed.

### /review

- Plan alignment: PASS — nullable snapshots, named restrictive FKs, two date indexes,
  compatible legacy inserts, and upgrade/immutability/history regressions implemented.
- System integrity: PASS — new M2 migration only; no merged migration, existing
  security policy, posting routine, service, or shared database helper was edited.
- Readiness: PASS for the T01 schema contract. FK/privilege/immutability failures are
  covered, ledger upgrade preserves legacy rows, and full regressions pass. Producer
  integration, transaction RLS, M4 review, and general phase approval are separate work.
- No unresolved findings within T01. No new UI, so `/imprint` is not applicable.

All five overview summary tables were reviewed. Only M2's new T01 completion is
recorded; other members' statuses are retained. T02 is not implemented here.
ADR-0016 records the blueprint and scoped authorization. Git publication remains
entirely with the user; REVIEW does not claim a PR has already been opened.
