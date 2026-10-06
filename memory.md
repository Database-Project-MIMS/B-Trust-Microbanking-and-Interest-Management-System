# Memory — PR #36 conflict resolution

> /remember save: non-sensitive continuation state.

**Updated:** 2026-10-06
**Branch:** feat/p02-m02-customer-registration

User requests conflict resolution and PR #35-then-#36 merge order, retaining publication.
HEAD 5ef06fd; dev 2e338a6; PR #35's latest pushed branch 888b983 contains that dev tip.
PR #35 is not yet merged into dev. A local --no-commit merge of that dependency is
pending on PR #36; nine current documentation conflicts reconciled.
Preserve customer/relation/registration implementations and dev closeout repairs.
Earlier combined verification passed: 328 tests in 31 suites, 0 failures/skips,
clean 14-migration rebuild, TypeScript/lint/production build. Historical focused T04:
181 tests. The holder fixture now removes its own accounts before seed validation.
.agent/handoffs/p02-m02-t04-pr36-conflict-resolution.md.
Fresh refresh verification passed 328 tests (31 suites), 0 failures/skips, clean
14-migration rebuild, TypeScript/lint/production build. See
.agent/handoffs/p02-m02-t04-pr36-after-pr35.md.
This refresh changes documents only. ADR index and harness setup are already resolved.

Customer numbering/scope ADR renumbered 0014 to avoid dev closeout ADR-0013; references
updated, decision unchanged. Fixture guard supports full isolated test DB only with
its marker. Fresh cluster grants mims_app to owner for SET ROLE regressions, never
owner to app. No production grants/RLS changes or dev reset; ownership notes recorded.

Tracker: P0 6 DONE; P1 19 DONE; P2 6 DONE/1 BLOCKED/9 TODO. M2 T01–T04 DONE; T05
blocked on scoped runtime security/API/UI. M3 holder absent; profile accounts null.
Existing T03 role lock issue remains recorded before exposure. Historical Phase 2
entry approval persists; no later approval. No new UI/imprint or assistant publication.
