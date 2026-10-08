# Customer FD listing — M2 to M1/M3/M5

**Date:** 2026-10-08 · **Task:** P04-M02-T01 · **State:** verified locally, REVIEW
**Branch:** feat/p04-m02-customer-fd-linkage · **Base:** dev c5fed03

ADR-0018 records the user-authorized early read-side start. M5 P04-M05-T02 remains
partial; this task neither completes nor changes the opening/interest pipeline.

Cross-owner integration needed for safe reads: M2 migration 0420 enables FD RLS and
adds a SELECT-only policy through existing scoped accounts/customer holders, along
with column SELECT and view SELECT for mims_app. No write grants/policies are added.
M1 owns security stewardship and M5 owns fixed_deposit; review these additive controls
in this task's PR. Their existing source files/migrations are unchanged. Future FD
writers need their own explicit runtime write policies/grants and financial review.

The 0420 installer is owner-only and binds in the existing post-migration views stage
after 0480 on clean rebuilds; on an existing schema it also binds during migration.
Apply migrations, then database/views/customer-fd-summary.sql for a clean migration-only
setup. npm run db:rebuild already performs both stages.

Runtime contract: GET /api/customers/{id}/fixed-deposits returns
{ data: { customerId, fixedDeposits: [...] } }; no query parameters. Same roles/scope
as the customer profile; unknown/out-of-scope customer is uniform 404. Exact decimal
strings and YYYY-MM-DD dates; deterministic newest-start-date ordering. Customer
profile embeds a loading/empty/error/retry panel. No missing-schema placeholder.

## Verification

Full `npm run verify:phase1` PASS: **612 tests /57 suites**, zero failures/skips;
clean disposable **29-migration** rebuild/checksum verification, TypeScript,
lint and production build. Log: test-results/customer-fd-listing-verification.log
(ignored). 20 new cases: API13 / DB7, with real runtime role/session/RLS reads.
Joint linkage, all statuses, exact maximum/cent principal and opening-rate strings,
immutable snapshots after plan changes, unassigned/cross-branch/self/ADMIN denial,
session expiry/revocation, stale identity/transfer/inactive branch, query injection,
uniform404, no-context RLS and forbidden runtime grants are covered. View bootstrap
rebinds idempotently; listing leaves FD rows, balances, ledger and audit unchanged.

Manual browser PASS using a separate disposable cluster and synthetic agent login:
populated three-status table with 100,000.10 /1,234.56 /0.01 and 13.75%, actual dates,
explicit empty result, safe FD-only failure while profile remains visible, and retry
restores rows. Mobile 375px: document fits viewport, table scrolls internally.
No console errors. Existing shell GSAP missing-target and slow-query warnings are
minor unrelated observations; shell/animation files unchanged. Ignored evidence:
test-results/customer-fd-desktop.png and customer-fd-panel.png. Preview and temporary
cluster cleaned up; normal development database neither reset nor migrated.

## /review — three layers

1. **Plan alignment PASS:** ADR-0018 read-side view/API/profile panel complete;
   actual start_date and all statuses, no opening or interest pipeline expansion.
2. **System integrity PASS:** numbered M2 migration, caller-security view, SELECT-only
   runtime RLS/grants, read-only repeatable-read service, thin authenticated route,
   parameterized SQL, exact decimal strings and existing UI tokens. Cross-owner
   security review is explicitly handed to M1/M5; owner source files unchanged.
3. **Readiness PASS for this local slice:** authorization/negative tests, ordered
   rebuild, loading/empty/error/retry/mobile states verified. No unresolved feature
   defects. Existing shell warnings recorded above; M5 financial completion and
   wider phase gates remain outstanding integration work.

/imprint saved in ui-registry.md; /remember saved in memory.md. Other members'
overview/status rows retained. Changes remain unstaged/uncommitted; the user owns
commit/push/PR and merge. Teammate review must include the additive FD read policy.
