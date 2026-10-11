# Memory — predeployment local completion

## Agent menu follow-up — 2026-10-11

On the existing live-audit-fixes branch, Dashboard now leads shared desktop/mobile
navigation before Transfers. Six-role rendered ordering, lint and typecheck pass.
UI registry/docs/05/live-audit handoff updated; publication remains a user action.

## PR #97 Vercel build supplement — 2026-10-11

Branch `feat/p06-m02-live-audit-fixes`; prior head `5253f6d`. The user reported
missing TypeScript while loading next.config.ts. TS was already declared/locked;
dev omission is the supported diagnosis, dashboard settings were not inspected.
Use next.config.mjs and vercel.json with npm ci --include=dev / npm run build.
ADR-0032, docs/24 and PR97 build handoff record decisions, cross-owner contribution
and review. Existing ownership, dependency versions, CSP and finances are preserved.
11 deployment/CSP tests, typecheck/lint, fresh production/omit-dev install and build,
Argon2 and production sign-in/header/nonces smoke pass. Local host Windows/Node24,
not the Node22/Vercel hosted environment. Server stopped; no live DB touched.
Earlier local commit authority persists; no push, new PR or hosted deployment.
Next: user publishes the correction to existing PR97, then redeploys that commit
and verifies its Vercel log/live acceptance. Previous memory below is preserved.

## Neon CI correction — 2026-10-10

User supplied PR #94/run 38033232178 log: 1,169 API/DB/e2e passes, one RPT-01
explain-output ENOENT failure. Missing ignored test-results folder caused it;
Neon deployment was skipped. Added recursive mkdir in the evidence-producing
test without weakening assertions/workflow. Verify with output directory absent,
preserving prior ignored artifacts in scratch. Receipt/review: CI-directory
handoff. No credentials needed; user subsequently authorized local commits for
these changes. Existing Docker changes retained; push/publication remains a
user action. Update PR branch through the user's publication process after checks.
Full fresh-output verification passes: 3,410 tests /116 suites, zero failures/skips,
clean rebuild/restore, typecheck/lint/build. Original outputs restored without
overwriting new plans; backup retained in scratch. Hosted rerun still pending.
Authorized local commits: `f94fe86` Docker runtime/tests, `f47ccc8` CI fix and
separate documentation/state commit. No push performed.

## Docker with Neon supplement — 2026-10-10

User requested necessary Docker changes on `feat/p06-m02-neon-migrations` at
`5e5dbb3`. Added app-only `compose.neon.yaml`, separate ignored `.env.neon`,
generator --neon mode and safe runtime guard; local Compose behavior preserved.
Use port 3001 and restricted mims_app TLS connection (pooled or direct). GitHub
deploys migrations; Docker Neon mode never seeds or runs setup. Bootstrap users
are a separate prerequisite. User reports connection configured locally; never
copy its value here. No additional password or Neon API key needed by the agent.
Missing app secrets/settings generated locally; complete private configuration
and Compose checks pass. 8/8 operations checks, full lint/typecheck and standalone
production build pass. Build required an approved run outside the sandbox after
Windows EPERM failures; no code workaround introduced.
See ADR-0030, docs/22 and Docker-Neon handoff for evidence/next steps. Docker Linux
engine unavailable; actual container execution and live Neon remain unverified.
User subsequently authorized separate local commits; no push/PR creation/merge.
Prior task/phase acceptance remains unchanged.

## Neon migration supplement — 2026-10-10

Branch `feat/p06-m02-neon-migrations` starts at clean Docker `1f183bb`.
User requested automatic Neon migration deployment and `.env.example` cleanup.
Workflow validates a disposable database before deploying dev/staging or main/production;
separate GitHub environment owner secrets are required. Deployment never resets/seeds.
Example credential fields are empty. ADR-0029, docs/23 and the Neon handoff record
decisions, verification and external setup. The user subsequently authorized
separate local infrastructure, test and documentation commits. No push/PR/merge
or live deployment performed.
Final local verification: 3,410 tests /116 suites, clean rebuild/restore and
typecheck/lint/build pass. Hosted Actions/Neon remains unverified.
Task acceptance and previous context below remain unchanged. Next session starts
with the Neon handoff; do not put connection values or credentials in this memory.

## Current Docker supplement — 2026-10-10

Branch `feat/p06-m02-dockerize` starts at verified `8a2b9c2`. User requested Docker
setup, then authorized a few local commits. Do not push, open a PR or merge. Container
files, separate setup/runtime credentials, persistent private PostgreSQL and
docs/22 are implemented. ADR-0028 and Docker handoff hold decisions/evidence.
Generated local Docker configuration is ignored; never copy its values here.
Full verification passes: 3,401 tests /116 suites, clean 70-migration rebuild,
restore evidence, typecheck/lint/build. Separate standalone build and 2/2 Compose
checks pass. Initial Windows test-process crash did not recur. Actual image
build/start needs a working Docker Linux engine. Keep live HTTPS and existing
phase/task acceptance pending.
Prior implementation and requirement decisions below remain relevant.

## Previous predeployment context

Updated 2026-10-10 Asia/Colombo. Branch `feat/p06-m02-final-documentation`, base
`053f6f6`. User authorized cross-owner fixes, docs and local commit; no push/PR/merge.
Current delivery: ADR-0027, handoff p06-m02-predeployment-completion and docs/21.
New M2 migrations 0628–0639 (block exhausted); no merged migration edits.

Implemented staff-only paired transfers/reversal/shared debit limits; savings unpaid
funded-day catch-up; automatic FD principal receipt; funding/system-reversal protection;
deposit replay/actor/attribution; document verification; real posting/receipt/statement,
customer accounts, admin user/role/reset/audit UI and searchable FD picker. Browser found
Host/Origin normalization and blank account-search failures; both fixed. MotionSurface
ignores absent scoped targets. Original stewardship retained; UI imprint saved.

Final `npm run verify:phase1 -- --catalog --tap` passed **3,397 tests / 116 suites**:
2,240 security checks plus 1,157 API/DB/e2e tests; zero failures, cancellations or skips.
Typecheck, ESLint and Next 15.5.27 production build passed. Clean **70-migration / 28-table**
rebuild/checksums and exact pg_dump/pg_restore (all tables, money, constraints, RLS,
ownership and sequences) passed within the same full run. Existing development data
was preserved. Temporary test/preview clusters and browser tab were cleaned up.
Host: Node 24.15.0 / PostgreSQL 18.6; `.nvmrc` retains Node 22.

Production npm audit zero; full audit seven high unpatched braces/glob development entries.
Live HTTPS was explicitly deferred. Node 22 pin remains; host verification used Node 24.
Closure retains zero/no-active-FD and denies positive unpaid interest. Final funded-account
settlement policy questions unanswered; do not waive plan minimum or forfeit interest.
Tracker 97 tasks: 86 DONE, 10 REVIEW, 1 IN_PROGRESS. Next is user/peer review, explicit
settlement decision, target-runtime/HTTPS checks and user-controlled publication.
No actual deployment, push, PR creation or merge is authorized/performed.

## Customer follow-up — 2026-10-11

/remember save: appended continuation context; prior sessions preserved.
User authorized branch `feat/p02-m02-customer-details` and a few local commits;
no push/PR/merge/deployment. P02-M02-T06 is locally verified REVIEW (ADR-0033).
Registration uses optional Male/Female select and server MALE/FEMALE validation.
Assigned agents receive full customer NIC/email under existing branch/assignment
SQL scope; manager and audit masking remain. Results have View details; the existing
profile includes gender/contact data and linked account/FD panels. No migration.
Verification passes 3,417 tests/117 suites, clean 70-migration rebuild, typecheck,
lint/build and production browser registration/navigation/mobile/empty checks.
Disposable browser signed out/closed, viewport restored, local preview stopped;
existing databases preserved. Review/imprint/contracts/state/overview updated.
Next: user-controlled publication/deployment, then live retest; no phase acceptance.
Full evidence/ownership: `.agent/handoffs/p02-m02-customer-details.md`.

PR #97 preparation: customer ADR renumbered 0033, with all references updated;
0032 remains PR #97's Vercel decision. Customer session/overview notes moved to
separate insertion points. Three-way Markdown checks against 26b315e pass without
conflicts and preserve both branches' notes. No branch integration performed;
incorporate merged main and rerun combined verification before publication.

## Record details and editing — 2026-10-11

/remember save appends current continuation context without overwriting previous memory.
P06-M02-T04 is locally verified REVIEW on `feat/p06-m02-record-details-edit`, base
`9e41cd3` (corrected PR #98, including PR #97 build/menu fixes). User authorizes
a few local commits; new PR waits for their merges of #97 and #98. No push/merge/deploy.
Full scoped View details and permitted Edit cover branches, agents, customers,
accounts; FD details link account and visible owners. Catalogue details reuse existing
edits. User explicitly keeps FD opening terms read-only. No migrations; stewardship
unchanged. Receipt/PR draft: `.agent/handoffs/p06-record-details-edit.md`, ADR-0034.
Agent native date fields require SQL DATE::text; do not serialize them as timestamps.
Customer masked email is absent from manager forms and cannot be written by manager.
Status/mandate edits lock and audit in one transaction; balances remain protected.
Full 3,584 tests/120 suites and final 361 API tests/33 suites pass; rebuild/restore,
typecheck/lint/build and production browser checks pass. Browser signed out/closed,
viewport restored and disposable previews stopped; existing databases preserved.
Review/imprint/state/tracker/overview updated. Tracker: 99 tasks, 86 DONE, 12 REVIEW,
one IN_PROGRESS. Next: after #97/#98 merge, incorporate actual integration target
and verify combined tree before authorized publication. General phase/live gates remain.

## /remember save — record filters and agent navigation, 2026-10-11

Continue feat/p06-m02-record-details-edit / P06-M02-T04 / ADR-0034. User follow-up
adds branch/agent/FD filters and exact AGENT menu order. All requested changes are
locally verified; original View/Edit and read-only FD terms are retained. Search/
Clear applies drafts; FD page resets. Explicit holder branch/assignment/self scope
prevents searched hidden co-holders from affecting results. No migration or financial
writes. M1 navigation/security and M5 FD stewardship retained; contribution recorded.
3,640 distinct tests verified across security/API/DB and corrected E2E runs; final
70 UI tests, rebuild/restore, type/lint/build and production browser pass. Renderer
fixture and owner-scope findings resolved. Review/imprint complete; see current-state
and record-management handoff for receipt/screenshots. All five overview tables
reviewed, task remains REVIEW. Synthetic localhost preview left running, normal
viewport restored, console clean. No credentials saved. Local commits authorized;
no push, PR, merge or deployment. Next: wait for user's #97/#98 merges and incorporate
actual integration target before publication; do not assume they have merged.

/remember save — 2026-10-11 dashboard follow-up: removed the requested role-access
caption in app/dashboard/page.tsx. Typecheck/targeted lint pass; review/imprint and
M1 contribution recorded. Same branch/publication dependency; no credentials saved.

## PR #98 build dependency recovery — 2026-10-11

Current branch is customer-details, not live-audit-fixes. PR98 published `3e6a292`
without PR97's build fix, so Vercel failed; PR97 `26b315e` now passes hosted Vercel/CI.
Cherry-picked build/menu fixes as `8e05feb` / `cc4147c`, preserving all customer
changes and documentation. Combined disposable verification passes: 3,418 tests,
117 suites, clean 70-migration rebuild/restore, typecheck/lint/production build.
Review passes; synthetic cluster removed and existing databases preserved. No push,
branch merge, new PR or deployment. Publish the corrected PR98 branch after checks;
retrying its old commit cannot pick up the fix. Receipts: docs/24 and customer handoff.

## Dev-to-main conflict fix — 2026-10-12

User switched to `feat/p06-m02-record-details-edit` and requested the prepared fix
on this branch. Applied Markdown-only changes: docs/24 matches main; its PR #98
supplement is preserved in the customer handoff; PR #98 memory moves to the end.
Agent/branch filters are already merged in dev via PR #100 (`05a1a26`, commit
`d0c2d0a`) and present here. No feature needs to be resent. Zero-conflict tree-only
simulation, TypeScript and seven deployment tests pass. No commit/push/PR/merge or
deployment; original owners, task statuses and phase gates retained. Next: user
reviews/commits/publishes this branch to dev, then rechecks dev against main.
Receipt: `.agent/handoffs/p06-dev-main-conflict-resolution.md`. Prior memory preserved.
