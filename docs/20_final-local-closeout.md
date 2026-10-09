# 20 — Final Local Closeout

Date: 2026-10-09. Task: P06-M02-T03. Branch: `feat/p06-m02-final-documentation`.
Base: dev `053f6f6`, including merged PR #88/#90/#91/#92. User authorization:
ADR-0026; necessary other-owner implementation/fixes and local commits. No push,
PR creation or merge. Owners retain stewardship; cross-owner handoff records changes.

## Implementation

- Database: 26 public tables, 58 migrations. New M2 0621–0627 add transaction RLS,
  guarded FD/runtime controls and idempotency receipts, restricted lifecycle-only FD updates, controlled FD entry, narrow
  agent-self historical aggregates and locked interest account-status checks.
- Withdrawals: linked customer identity, explicit staff signer arrays, durable known-rejection audits and successful-key replay; physical signature capture UI remains pending.
- Reversals: manager-only stored-actor guard, constrained control-link RLS, real receipt UUID and durable API key replay; ADMIN is denied.
- API/security: strict UUID/pagination/body validation; full independent role/handler
  matrix, injection probes, valid literal binding and direct runtime-login RLS evidence.
- FD opening: SQL quote, explicit confirmation, atomic principal/ledger/FD/audit/receipt,
  concurrent opening guard and same-key replay. Original merged SQL is preserved.
- FD interest: synchronous execution with one transaction per distribution. Earlier
  successes survive later failures; failures have persisted exception evidence. Finalization
  failure retains committed credits and RUNNING status, requiring operator review.
- Reports: real RPT-03/RPT-04 pages, safe scoped APIs, SQL-exact totals, snapshot CSV.
  RPT-04 scopes leaf rows before regenerating ROLLUP totals.
- Operations: dump/restore in generated isolated databases, all table values and financial
  sums, constraints, RLS policies, ownership and sequence positions compared exactly.

Exact physical inventory: [docs/18](18_implemented-database-catalog.md).
Exact handler permissions: [docs/19](19_implemented-api-matrix.md).
Current payload/runtime contracts: [docs/05](05_api-and-pages.md).
Verification evidence: [docs/12](12_testing-and-acceptance.md) and
[migration/restore evidence](migration-rollback-evidence.md).

## Verification and local commits

Full regression: **3,133 tests / 113 suites** pass (2,000 security plus 1,133 API/DB/e2e),
zero failures, cancellations or skips. Final receipt-guard verification: **331 API tests /
30 suites**, typecheck, lint and production build pass. Final migration-format verification:
**11 operations checks**, clean **58-migration** rebuild/checksums and exact dump/restore
pass. The API guard adds only a safe missing-receipt error; final SQL whitespace changes
were verified in the fresh operations rebuild. Temporary clusters were stopped/removed;
the development database was preserved. Host Node 24.15.0/PostgreSQL 18.6; Node 22 pin retained.

Implementation commits: `f4ea972` (security/FD/report/ops) and `d78b045`
(reversal/withdrawal controls). Documentation/state/memory are saved in the following
local commit; see `git log -3`. No push, PR creation or merge was performed.

## Remaining scope and acceptance

This is a scoped local closeout, not certification that every SRS criterion is complete.
ADR-0012 accepts savings interest on average daily balances; payout schema and runtime
remain FD-only. ADR-0010 accepts transfers; transfer group typing/scope questions remain
OQ-12/OQ-14. OQ-13 retains mid-cycle savings detail. These extensions need separate
implementation and tests before full financial acceptance.

Some older transaction pages still render WorkflowScreen prototypes. Financial backend
operations are covered by real API/routine tests, but the prototype pages cannot be used
as evidence of a working financial UI. The demonstration guide states where API execution
is necessary. New FD/interest/report pages have markup/API coverage; a full interactive
browser pass remains pending. The FD opening picker currently loads the first 100 active
accounts; larger deployments need searchable/paginated selection.

P06-M01-T04 live HTTPS checks remain pending by explicit user instruction. General phase
checkpoints, lecturer decisions, peer review and publication remain separate actions.
Review task statuses in docs/09 before choosing another task; REVIEW is local delivery,
DONE identifies merged/accepted work. Never reuse older counts as evidence for this tree.
