# Current State

**Updated:** 2026-10-08 · **Owner:** M2
**Checkout:** feat/p03-m02-agent-daily-activity · base HEAD db6ff4e
**Work:** P03-M02-T02 implemented, verified locally; REVIEW for the user's PR

## Delivered work

GET /api/agents/{id}/activity and live /agents/{id}/activity supply exact type counts
and amount strings for inclusive Asia/Colombo calendar dates. Agent-directory names
link to activity; AGENT has My daily activity in Customers. Date filters, Today,
loading/empty/safe error/retry and responsive internal table scrolling are complete.
No new migration: dependency 0320 is reused. T01 is DONE through merged PR #49
(dev c2bce7c), correcting M2's stale REVIEW label.

The service revalidates stored active caller identity in one read-only REPEATABLE READ
transaction, sets existing RLS context, and scopes in SQL. AGENT reads only itself;
BRANCH_MANAGER targets current own-branch ordinary agents and additionally filters
immutable transaction.branch_id. ADMIN/CENTRAL_OPS read bankwide. NULL agent rows
are excluded; managers also exclude NULL branch rows. No net balance, attribution
backfill, ledger/account mutation or producer change is inferred.

## Verification and review

Final verify:phase1 PASS: 529 tests / 48 suites, zero failures/skips; clean isolated
24-migration rebuild and checksum verification; TypeScript, lint and production build.
28 T02 cases (API 19, DB-backed service 7, pure calendar 2) cover real mims_app/session
reads, exact huge sums, local midnight microseconds, final-day bounds, alternate DB
timezone, transfers/NULL rows, stale/forged identity, invalid input and unchanged
ledger/balance/audit. Log: test-results/agent-daily-activity-verification.log (ignored).

Manual browser PASS: manager directory and agent self links, populated/historical/
empty/Today views, cross-branch safe denial and retry; narrow viewport has no document
overflow. No browser console errors. Screenshots are in ignored test-results/t02-activity-*.png.
The temporary browser tab, preview server and PostgreSQL cluster were closed/cleaned up.
The normal development database was not reset or migrated.

/review completed in three layers; findings fixed (bankwide users with retained
staff profiles, UUID spelling, Today across midnight). /imprint saved in ui-registry.md;
/remember saved in memory.md. All five overview tables reviewed; only M2's new
implementation/status changed. Other members retain ownership of their stale labels.
[Handoff and review](handoffs/p03-m02-agent-daily-activity.md).

## Authorization and integration limits

Vibodha explicitly authorized T02 after the general phase restriction was explained;
ADR-0017 extends the scoped early-start exception. No Phase 2 exit/general Phase 3
entry, OQ-12/OQ-14 or unrelated task approval is recorded. Historical Phase 2 entry
approval remains valid. Overall tracker: 55 TODO / 4 REVIEW / 38 DONE (97 tasks).

M4/M3 still need to populate trusted attribution inside posting transactions;
existing opening deposits remain unattributed. M1 owns future transaction RLS;
explicit service predicates enforce scope now. Apply 0320 through the ordinary
runner if the development database has not received the merged dependency.

Browser QA found seeded manager logins without required branch-staff profiles.
Authentication correctly fails closed. Only disposable QA fixtures were supplemented;
M5/M1 handoff: handoffs/p03-m02-activity-seed-manager-profile.md. No steward-owned
seed, authentication code or another member's status was altered. Existing Phase 2
seed-versus-exit targets also remain an owner reconciliation item in open-questions.md.

User controls commit, push, PR creation and merge. All task changes are unstaged and
uncommitted; the assistant performed no publication or completed merge.
