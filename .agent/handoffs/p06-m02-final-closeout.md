# P06-M02-T03 — authorized cross-owner closeout

2026-10-09. Vibodha explicitly instructed M2 to complete necessary other members'
code/tasks and commit locally. No push, PR creation or merge is authorized.
Live HTTPS verification remains pending at the user's explicit instruction.

Before editing owner files, this handoff records the affected boundaries:

- M1: endpoint injection/role matrix and direct application-role RLS evidence
  (P06-M01-T01–T03). Transaction RLS was documented but never enabled; add 0621
  in M2's reserved block, preserving all merged migrations and M1/M4 ownership.
- M4: transaction detail/statement ID and pagination validation; scoped ledger reads
  must fail safely for malformed identifiers. Keep posting transaction boundaries.
- M5: report authorization/error mapping, validation, precise SQL totals and scoped
  runtime context; backup/restore evidence must use isolated databases rather than
  hardcoded developer credentials. Inspect unfinished FD UI/API dependency honestly.
- Shared documentation/state: reconcile physical schema, endpoint contracts,
  inventories, merged PR evidence and all five work summaries. No lecturer approval
  or live-deployment evidence is inferred from this scoped authorization.

Ownership remains unchanged. Final verification and review findings will be appended.

## Final implementation and review

M2 new migrations: 0621–0627 only. All merged migrations remain unchanged.
M1/M4/M5 ownership is retained. FD base UPDATE grants are restricted to next_interest_date,
status and updated_at; direct control-role changes to principal or opening-rate fail.
FD/cycle legacy functions are owner/seed-only. 0624 preserves agent-self historical
aggregate behavior without weakening ordinary transaction RLS.

/recover addressed obsolete scope/grant assumptions, shared destructive FD fixtures,
RESTRICT SQLSTATE differences on PostgreSQL 18, leaked parameter numbering in cleanup,
and test-time removal of extra trailing blank lines invalidating checksums. Destructive interest suites now own
fresh child databases. Source files remain stable for final verification.

/review Layer 1 — Plan alignment: scoped T03/security/ops/FD/report blueprint delivered.
Accepted savings/transfer extensions are documented as absent, not silently marked done.
Layer 2 — System integrity: services own transactions, routes contain no SQL, all new pg
access is through lib/db, money remains SQL/decimal strings, invoker grants and narrow
aggregate definers preserve scope, merged migrations unchanged. No ownership transfer.
Layer 3 — Local readiness: failure/replay/concurrency/scope/backup evidence is executable.
Known important limits: savings/transfers, prototype transaction UI, first-100 FD picker,
full interactive browser verification, live HTTPS, general/lecturer acceptance and peer review.
These remain explicitly pending in docs/20. Local commits only; user controls publication.
/imprint records actual card/action/table/confirmation patterns in ui-registry.md.
Final test totals and commit identifiers are appended after the stable-source run.

## G-27 reversal authorization correction before owner edits

Final document comparison found manager-only reversal in docs/05 and M4 task instructions,
while the route/service permit ADMIN and the stored procedure lacks an actor guard.
User authorization covers this correction. New 0626 will preserve merged 0363, enforce
stored active manager/branch identity, provide API key replay, and constrain reversal-link
INSERT. Update legacy fixtures to use actual manager context; add real API/direct tests.

G-27 implementation: manager-only route/service, persisted ledger key replay, actual control
UUID, invoker stored-actor and explicit account-branch checks, scoped reversal-link RLS,
and guarded legacy wrapper. The seed now uses same-branch managers for reversals. Tests
exercise real runtime sessions, concurrent replay, altered payload, overdraft, ADMIN/agent/
customer denial and forged/direct SQL bypasses. Legacy owner fixtures now use manager
identity and application role where they exercise APIs. M4 frontend statuses are corrected
to IN_PROGRESS; prototype screens are not treated as completed financial UI.
Implementation commit `f4ea972` contains security/FD/report/ops delivery. The reversal
correction and documentation closeout follow as separate local commits.

## G-28 withdrawal adapter correction

Final comparison found the service using login UUIDs as customer IDs and the throwing
legacy routine, losing known-rejection audits. Before M4-owned adapter edits: resolve
the active linked customer under RLS, accept explicit staff signer evidence, and use
existing sp_try_post_withdrawal, committing its rejection audit before mapping the
HTTP error. User authorization covers these changes; no ownership transfer or merged
migration edit. Real runtime API tests must cover self-signing, ALL_HOLDERS, key replay,
scope and durable rejection evidence. Physical signature capture UI remains pending.

G-28 root cause found by real CUSTOMER API tests: account UPDATE RLS prevents
SELECT FOR UPDATE, so the invoker path cannot implement the specifically documented
customer withdrawal contract. Proposal 0627: a pinned-path SECURITY DEFINER wrapper
checks stored active CUSTOMER/profile/context, own account and exactly self signer;
then reuses the existing audited locked core. No customer UPDATE policy/grant change.
Direct app UPDATE and forged wrapper calls must remain denied.

G-28 recovery: the customer lock failed with ACCOUNT_NOT_FOUND because FOR UPDATE
requires account UPDATE visibility. 0627 now supplies the guarded narrow operation;
real customer success/replay/rejection and raw denied UPDATE/forged calls pass. Fault
injection uses XX000 to model an unexpected engine error, distinct from P0001 business
rejections. Unassigned-agent denial maps to safe 403. The branch/agent workflow suite
uses the existing lib/db tooling factory, preserving the pg import boundary.

## Final verified evidence and local closeout

Full regression: **3,133 tests / 113 suites** pass (2,000 security plus 1,133 API/DB/e2e),
zero failures, cancellations or skips. Final receipt-guard verification: **331 API tests /
30 suites**, typecheck, lint and production build pass. Final migration-format verification:
**11 operations checks**, clean **58-migration** rebuild/checksums and exact dump/restore
pass. The API guard adds only a safe missing-receipt error; final SQL whitespace changes
were verified in the fresh operations rebuild. Temporary clusters were stopped/removed;
the development database was preserved. Host Node 24.15.0/PostgreSQL 18.6; Node 22 pin retained.

Local implementation commits: `f4ea972` and `d78b045`. Documentation/state/memory
follow as a separate commit. Three-layer /review passes for the scoped blueprint;
G-27/G-28 findings are fixed and tested. Remaining readiness limits are explicit in
docs/20: prototype financial pages, browser validation, savings/transfers and live
HTTPS/general acceptance. /imprint is in ui-registry; approved /remember save replaces
stale T02 memory. All five work summaries reviewed; only completed groups are struck.
No ownership shift. No push, PR creation or merge. Tracker97:86DONE/8REVIEW/3IN_PROGRESS.
