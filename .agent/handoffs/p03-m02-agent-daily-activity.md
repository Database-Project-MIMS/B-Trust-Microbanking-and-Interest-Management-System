# P03-M02-T02 — agent daily activity

**Owner:** M2 · **Branch:** feat/p03-m02-agent-daily-activity · **Date:** 2026-10-08
**Implementation authorization:** ADR-0017; T01 is merged through PR #49.
**Status:** REVIEW (verified locally; user publication/integration review pending).
**Migration numbers added:** none; existing dependency 0320 reused.

## Delivered interface and ownership

GET /api/agents/{id}/activity?from=YYYY-MM-DD&to=YYYY-MM-DD reads exact type totals.
M2 changes agent service/validation/types, route, agent page, and the agent-name
links in the existing M2 organisation component; no shared shell/navigation change.
Customers supplies a self-activity link for AGENT. Shared documentation updates
are proposals for the user's PR; no ownership transfer.

No changes to M4 transaction producers or M3 opening deposits. NULL attribution
remains unknown, not derived from initiator/current account ownership. Managers
see current branch agents but totals filter the immutable posting branch too.
M1's future transaction RLS must permit this contract while preserving self scope;
service already sets the existing context inside its transaction.

## Runtime contract

- `services/agent-service.ts` exports getAgentActivity(id, range, authenticatedActor).
  It revalidates stored active role/profile and reads in one read-only REPEATABLE READ
  transaction. Scope is in SQL and the existing transaction-local RLS context is set.
- ADMIN/CENTRAL_OPS: any ordinary agent, all attributed history. AGENT: self only,
  regardless of posting branch. BRANCH_MANAGER: current own-branch ordinary agents,
  additionally matching the immutable transaction posting branch. A transferred
  agent's old branch amounts never appear for the new manager. NULL branch rows
  are excluded for managers; NULL agent rows are always excluded.
- Real ISO dates; both absent = Colombo today, one date = single day, both inclusive.
  Half-open timestamp bounds keep the transaction_date index usable. Unknown or
  repeated query keys and reversed dates return 400. No branch override from clients.
- Minimal target metadata, ordered type/count/total rows; amounts are PostgreSQL
  SUM decimal strings and counts safe integers. No net balance or missing attribution
  inferred. Unknown/non-ordinary target 404; role/self/branch denial 403; no session 401.
- Inactive targets retain historical reporting, while inactive callers lose access.
  Bankwide roles may retain an old staff profile without being restricted by it.
- Success is private/no-store; no unsafe driver details returned. Route normalizes
  validated UUID spelling. No new migration, producer change, financial action or DDL.

## /review — three layers

1. Plan alignment: live API and page, date filters/defaults, exact totals and role/self/
   branch behavior match ADR-0017. T01 dependency is merged; no unrelated task started.
2. System integrity: server-only service; parameterized SQL; application-role tests;
   no pg outside lib/db, JS money arithmetic, new dependencies, merged migration edits,
   or another member's code changed. Read-only task reuses 0320, so new DDL/posting
   routines and CSRF/idempotency on a GET are inapplicable. Existing theme/formatter reused.
3. Readiness: safe errors, empty/loading/retry, no stale results under a new filter,
   native date validation, aborted superseded requests and 401 sign-in redirect.
   Review fixed bankwide callers retaining old profiles, normalized UUID paths,
   and Today recalculation across midnight. Regression tests cover the two access fixes.

No unresolved T02 findings. Integration limits remain documented below; user/team
publication and review are still required, so the tracker uses local REVIEW.

## Tests and browser QA

28 new cases: API 19, DB-backed service 7, calendar 2. The API/service tests use
real sessions/data and SET ROLE mims_app in the disposable cluster, including
microseconds around Colombo midnight, final-day exclusion, exact huge sums, alternate
PostgreSQL timezone, transfer/NULL rows, forged/stale identities and unchanged ledger/
balance/audit. The calendar tests are pure; they do not claim automated browser E2E.

Final full verification log: test-results/agent-daily-activity-verification.log
(ignored local evidence). Clean rebuild applies/checksum-verifies the same 24 migrations.
Final PASS: 529 tests / 48 suites, zero failures/skips; TypeScript, lint and production
build pass. Current-state.md records the same completed verification.

Manual browser PASS: manager directory activity link; today deposits 2 / LKR 1,300.00,
withdrawals 1 / LKR 250.00; historical day deposits 1 / LKR 23.45; empty period;
Today reset; cross-branch safe denial and retry with no metadata leak; agent self link
from Customers and self totals. Loading states observed; no browser console errors.
Narrow viewport (~375px content width) stacks date fields; table scrolls inside its
container (740px content / 292px visible) with documentWidth = viewportWidth.
Screenshots: test-results/t02-activity-desktop.png and t02-activity-mobile.png (ignored).
Preview tab/server/temporary cluster stopped and cleaned up. /imprint in ui-registry.md.

## Integration follow-up

- M4/M3 must populate trusted attribution inside future posting transactions; current
  opening-deposit rows stay NULL and are excluded. Apply dependency migration 0320
  through the normal runner if the development database has not received it.
- M1 owns transaction RLS; explicit SQL predicates enforce this endpoint today.
- M5/M1: seeded manager logins lack required branch profiles. See the separate
  p03-m02-activity-seed-manager-profile.md handoff. Only disposable QA fixtures were
  supplemented; normal DB/seeds preserved. This does not downgrade another owner's task.
- No Phase 2 exit/general Phase 3 entry or OQ-12/OQ-14 approval. Existing target/seed
  contradictions and other members' stale status labels still need owner reconciliation.
- User commits/pushes/opens PR/merges. No staging or publication by the assistant.
