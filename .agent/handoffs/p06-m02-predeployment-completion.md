# P06-M02-T03 — predeployment cross-owner handoff

2026-10-10 · ADR-0027 · current branch; user permits all-member fixes and local commit.
No push, PR or merge. This contribution preserves the ownership map and all merged SQL.

- M1: login Host/Origin repair, logout error/CSRF cleanup, real guarded users/roles and
  audit screens, admin user/reset APIs/services, unknown SQL message allow-list, role nav.
  Review 0637/0638 last-admin/reset capabilities and session invalidation. Reset delivery
  is a private administrator copyable link, no email provider; fragment prevents query logs.
- M2: document verification capability/endpoint/profile UI, customer owned-account list,
  historical agent extended-type labels; this note transfers no ownership.
- M3: real statement/owned account UI and unpaid-interest closure guard; verify final
  closure settlement product decision before adding a minimum exemption or final accrual.
- M4: exact/payload-bound deposit, real posting/receipt/reversal UI, staff paired transfers,
  shared debit limits, pair reversal/system funding protections and ledger-order reconciliation.
- M5: savings daily balances/unpaid cursor, FD catch-up and automatic principal return,
  funding link, extended RPT-04/report categories, searchable FD account selector and quotes.
- Shared: safe query/error handling, security handler inventory/fingerprints, synthetic
  preview runner, scoped animation targets, compatible dependencies and UI imprint/docs.

New migrations are M2 **0628–0639**, no reserved numbers remain in this block.
Add future corrections in an authorized new member block; never alter these after merge.
Exact object/handler definitions are docs/18/19; policies, evidence and limits docs/21.

Final `npm run verify:phase1 -- --catalog --tap` passed **3,397 tests / 116 suites**:
2,240 security checks plus 1,157 API/DB/e2e tests; zero failures, cancellations or skips.
Typecheck, ESLint and Next 15.5.27 production build passed. Clean **70-migration / 28-table**
rebuild/checksums and exact pg_dump/pg_restore (all tables, money, constraints, RLS,
ownership and sequences) passed within the same full run. Existing development data
was preserved. Temporary test/preview clusters and browser tab were cleaned up.
Host: Node 24.15.0 / PostgreSQL 18.6; `.nvmrc` retains Node 22.

Dependency audits: production zero, full seven high build-tool entries (unpatched
braces/glob chain). Pin/target-runtime verification and live HTTPS remain deferred.
REVIEW denotes local completion awaiting user publication; 86 DONE/10 REVIEW/1 IN_PROGRESS.
Remaining final settlement policy is explicit in open-questions; other private-banking
concept pages outside the question/SRS are not operational navigation workspaces.

## /review result

Plan alignment: PASS for authorized staff transfers/automatic maturity and documented
financial/UI/admin/reset contracts; unpaid-interest closure protected, full settlement
policy remains explicit. System integrity: PASS — SQL money, explicit transactions,
scoped stored actors/RLS, parameterized inputs, immutable migration baseline, atomic
ledger/balance/audit/control paths. Production readiness: LOCAL PASS for tested scope;
3397 checks, browser pass, type/lint/build and complete restore. Live HTTPS, target
runtime, unpatched dev-tool dependencies and external acceptance remain recorded limits.
/imprint saved real financial/admin/audit patterns to ui-registry; /remember state saved.
