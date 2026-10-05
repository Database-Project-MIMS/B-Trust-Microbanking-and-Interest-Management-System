# Member 2 — context

**Updated:** 2026-10-05 · [slice](../../docs/member-prompts/member-2.md)

P02-M02-T04 technical service implementation is complete locally on
feat/p02-m02-customer-registration. Atomic registration, active/scope checks, strict
validation, numbering, same-transaction minimal audit, scoped search/profile and staff
identity masking are delivered. No new migration/HTTP endpoint/UI change.
[Contract and /review](../handoffs/p02-m02-t04-customer-registration.md).

181 selected tests pass: 43 new service + 4 new DB + 134 regressions. All 14 migrations
rebuild/reapply/verify; typecheck/lint pass in a removed disposable PostgreSQL cluster.
Normal DB verifies read-only. Temporary app-role grants and a synthetic holder fixture
are test-only, not production RLS or M3 certification.

T05 runtime integration is BLOCKED pending M1 scoped grants/RLS/audit coordination.
Screens are prototypes in components/mims/workflow-screen.tsx. Profile accounts is null
until M3 account_holder lands. T03 verifier still locks read-only role FOR SHARE; narrow
that lock before exposing it, without granting role UPDATE. T04 already avoids it.

User committed T01–T03 before this branch. Current T04 changes are uncommitted;
assistant commits/merges/PRs remain prohibited. Historical Phase 2 entry approval persists;
missing Phase 1 closeout changes and full phase exit are not recertified. All five overview
tables reviewed; M2 row 06 strikes only T04. /imprint not applicable; no UI change.
