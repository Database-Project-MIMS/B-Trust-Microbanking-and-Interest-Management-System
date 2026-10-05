# Memory — MIMS customer registration service

> /remember save: minimal non-sensitive continuation state.

**Updated:** 2026-10-05
**Task/branch:** P02-M02-T04 on feat/p02-m02-customer-registration.

T04 registration/search/profile services and strict customer schemas are technically
complete locally. Customer, documents, one active assignment and minimal audit commit
atomically; scoped reads mask branch-staff identity. Numbering/scope decision is ADR-0013.
Full signatures, review and integration limitations:
.agent/handoffs/p02-m02-t04-customer-registration.md.

npm run verify:customer-registration passed 181 tests, zero failures/skips, clean
14-migration rebuild/reapply/verify, typecheck/lint. Temporary test cluster removed.
Normal dev migration verification was read-only. Test-only grants/holder fixture do not
certify production RLS or actual M3 integration. Avoid the destructive legacy migration
runner suite against development data.

T05 runtime API/screen integration is BLOCKED pending M1 scoped customer/child grants,
RLS and audit coordination. Screens are prototypes, not completed dashboard bindings.
M3 account_holder is absent; profile accounts is null. T03 verifyDocument's existing
FOR SHARE role lock needs narrowing before endpoint exposure (no broad role UPDATE grant).
T04 passes an actual app-role test without that lock. Other owners' files were untouched.

User committed T01–T03 before starting T04. Current T04 changes are uncommitted;
assistant commits, merges and PR creation are prohibited. No push performed. Retain
historical Phase 2 entry approval; absent Phase 1 closeout repairs are not recertified.
No UI was added; /imprint not applicable. Tracker/state/task card/overview/handoff updated.
