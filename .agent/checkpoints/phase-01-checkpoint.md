# Phase 01 Checkpoint

**Date:** 2026-10-05 (Asia/Colombo)
**Exit criteria:** met in the verified local working tree.
**Decision:** GO — Phase 2 entry approved.
**Approval authority:** Vibodha's explicit instruction in this chat: “resolve those
remaining checks, reconcile task statuses, and record phase approval.” Recorded after
the checks below passed; this does not claim approval by the lecturer or other members.

## Evidence

This is the original 2026-10-05 closeout record. Its test counts and "Next work"
describe the pre-customer-schema tree. For current task status, use docs/09_task-tracker.md.

- `npm run verify:phase1` / its script: disposable PostgreSQL 18.6 cluster; all 11
  numbered migrations apply from empty, ordered seeds load, and verification succeeds.
- **184 tests pass, 0 fail, 0 skipped**, covering the current DB/API/workflow suites.
  Includes authentication, generic failures/throttling, role and real SQL branch scope,
  CSRF, parameter validation/auditing, organization workflows and product constraints.
- Migration tests reject changed applied files, pending files and missing disk files;
  repeated application is idempotent, and failed DDL rolls back with its ledger entry.
- Seed proof: 3 branches, 6 ordinary agents, 5 savings plans and 3 FD products; repeated
  seeding preserves counts/totals. Customer/account/FD transactional seed sets remain
  future-phase work; the seed-framework test is not evidence that those targets are met.
- TypeScript checks, ESLint and the production Next.js build pass.
- Final tooling follow-up: all **107 DB tests pass** after grants/seed-check scripts
  were routed through the shared lib/db tooling client. The development ledger and
  grants verify again. `git diff --check` passes; no numbered migration diff exists.
- Health validates a real session, returns basic status to authenticated roles only,
  and restricts infrastructure details/page to ADMIN/CENTRAL_OPS. Error responses are safe.
- Parameter page/APIs are ADMIN-only; edits send strict CSRF tokens and update with
  trigger auditing inside a locked transaction.
- Login session creation shares the caller transaction. Inactivity/absolute expiry
  use configured SQL values; active requests refresh inactivity within the absolute cap.
  The browser cookie permits that lifetime; logout revokes the record server-side.
- `/architect`, `/review`, `/imprint` and `/remember` closeout state are recorded.
- Existing local `mims_dev` received pending migrations `0160`, `0240`, `0260` and
  updated grants, without a reset. Its 11-file migration ledger now verifies.

Full local verification output: `test-results/phase1.log` (ignored, reproducible).

## What shipped and what changed

All 19 Phase 1 task implementations are verified. The tracker and per-member summaries
were stale after earlier merges. Closeout repairs cover health authorization/service
boundaries, safe migration/rebuild tooling, Windows CRLF seed loading, real security
tests, mapped SQLSTATE assertions, parameter edits and session transaction/lifetime behavior.
No existing numbered migration was edited; no new schema migration was needed.

Cross-member scope is documented in
`../handoffs/phase-01-closeout-2026-10-05.md`; original M1/M4 ownership is retained.

## Next work

**P02-M02-T01 — customer schema is READY**, using the accepted ADR-0007 independent
customer identity with optional login, migration `0220` in M2's block and existing branch
`feat/p02-m02-customer-schema`. No customer implementation was added during closeout.
The earlier account/transaction schema deliveries are verified; holder/mandate work
still waits for the customer table. Phase 3/4 decisions retain their separate gates.

## Integration condition

This approval applies to the verified working tree. Closeout changes remain uncommitted
at the user's request. The user controls review, commit, push, merge and PR creation;
none was performed by the assistant. Other checkouts need these repairs before relying
on this checkpoint. A later failing check must reopen the affected task/phase gate.

## Integration update — 2026-10-06, PR #34

The previously uncommitted closeout was committed as fad4f13 and integrated into
origin/dev by PR #33 (76701e7). The user requested resolving PR #34's conflicts while
retaining commit/merge control. Its local pending merge restores these repairs and
retains customer migration 0220/tests. The old missing-repairs condition is historical,
not the condition of this combined working tree. Combined verification is recorded in
../handoffs/p02-m02-t01-pr34-conflict-resolution.md; it does not reuse 184 as a new count.
Phase 2 approval persists; no Phase 2 exit or Phase 3 entry approval is implied.

## Integration update — 2026-10-06, PR #35

Closeout repairs were committed in fad4f13 and integrated into origin/dev by PR #33
(76701e7). PR #35's local pending merge restores these repairs while retaining customer
0220 and assignment/document 0221/0222. The initial missing-repairs condition is historical.
Combined verification is recorded in ../handoffs/p02-m02-t02-t03-pr35-conflict-resolution.md;
the old 184-test result is not reused as a fresh count. Phase 2 entry approval persists;
no Phase 2 exit/Phase 3 entry approval is implied. User controls commit/push/merge.

## PR #35 refresh after PR #34 merged — 2026-10-06

The two integration notes above record their original resolutions. The user committed
PR #35's earlier resolution as 07e878d. PR #34 is now merged into dev at 2e338a6.
The new pending PR #35 merge resolves their nine overlapping documentation changes,
preserving the original approval and both task deliveries. Fresh validation is in
[the refresh handoff](../handoffs/p02-m02-t02-t03-pr35-dev-refresh.md).
No later phase approval is inferred; commit/push/PR merge remain user-controlled.

## Integration update — 2026-10-06, PR #36

Closeout repairs were committed in fad4f13 and integrated into origin/dev by PR #33
(76701e7). PR #36's local pending merge restores those repairs alongside customer,
assignment/document and registration/read service work. Old missing-repairs warnings
are historical. Fresh verification is in ../handoffs/p02-m02-t04-pr36-conflict-resolution.md;
the old 184-test count is not reused. Phase 2 entry approval persists; no later phase
approval is inferred. The user controls commit/push/merge.

## PR #36 refresh for PR #35-then-#36 order — 2026-10-06

The integration notes above are historical resolution snapshots. The user committed
PR #36's earlier resolution as 5ef06fd and PR #35's refresh as 888b983. Dev is 2e338a6
(PR #34 merged); PR #35 has not yet merged into dev. PR #36's current pending local
merge includes PR #35's updated branch, preserving both implementations and approval
histories for the requested merge order. Fresh validation and scope are recorded in
[the dependency handoff](../handoffs/p02-m02-t04-pr36-after-pr35.md).
The user merges #35 before #36. No later phase approval or assistant publication.
