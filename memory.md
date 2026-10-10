# Memory — predeployment local completion

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
