# Member 2 — context

**Updated:** 2026-10-06 · [slice](../../docs/member-prompts/member-2.md)

PR #36 conflicts reconciled on feat/p02-m02-customer-registration, preserving
0220/0221/0222 and registration/search/profile/validation plus dev closeout fixes.
Historical focused T04: 181 tests and clean rebuild/checks. Fresh combined verification:
328 tests, 0 failures/skips, clean 14-migration rebuild, TypeScript/lint/production build.
[Resolution handoff](../handoffs/p02-m02-t04-pr36-conflict-resolution.md).
Customer ADR is now 0014, preserving dev's separate 0013 and the original decisions.

This PR: Phase 1 19 DONE; Phase 2 6 DONE/1 BLOCKED/9 TODO. M2 T01–T04 DONE; T05
requires M1 grants/RLS/audit and actual API/screen integration. Holder relation absent;
accounts null. Owner tests do not certify production RLS. Existing T03 verifier role
lock still needs narrowing before exposure; no application grant was widened.

Disposable full harness integration retains fixture safety and supports SET ROLE
without granting owner privileges to mims_app. Ownership notes precede M4 harness and
M1 EOF-only cleanup. No migration/service logic change. Phase 2 entry approval persists;
no later approval. User controls commit/push/merge; local merge pending, no new UI.
