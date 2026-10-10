# Live audit corrections — 2026-10-10

Branch: `feat/p06-m02-live-audit-fixes`. The user requested a branch and fixes for
the live audit findings, and explicitly authorized editing other members' files.
Original ownership remains unchanged. The user subsequently authorized a local commit
of these changes. Push, PR and deployment remain unauthorized.

Scope: M1 shell/dashboard/report metadata/security infrastructure; M3 account-detail
statement link; shared report workspace and selector for all five owner reports;
local production preview tooling and focused regression tests. No schema, financial
routine, seed, server permissions or live database changes are required.

Blueprint: reuse existing cards/buttons and server page guards. Staff withdrawals
and savings plans get role-aware links. Reports link to a guarded catalogue, with
crosslinks on each report. Open-ended periods have explicit metadata. CSP middleware
overwrites incoming nonce/policy headers, creates a fresh nonce, and passes the same
policy to Next.js rendering and the response. Root rendering is dynamic so bootstrap
scripts carry the nonce; production disallows inline/eval scripts. Inline styles
remain allowed for existing React/GSAP layout. Development alone permits HMR eval.

Validation will use disposable local PostgreSQL only. The previous audit remains
historical evidence; live issues remain until these changes are deployed and retested.

## Verification and review

Implemented all six findings locally: report catalogue/crosslinks, staff withdrawals,
account statement link, savings-plan links, CSP and open-ended date metadata. The mobile
menu now follows the actual header height rather than a fixed offset.

Full isolated verification passes: 3,415 tests / 117 suites, no failures, cancellations
or skips; clean 70-migration rebuild, SQL setup verification, typecheck, lint and production
build. The first sandboxed initdb attempt could not rename a temporary WAL file; the
approved unsandboxed disposable-cluster run passed. Existing local/Neon data was preserved.

Production preview checks pass for six human roles. Admin reaches all five reports;
RPT-03/04 show All dates; RPT-04 CSV downloads. Agent reaches withdrawals, plans and a
real scoped account statement; direct /reports redirects to dashboard. Manager gets
branch-scoped RPT-04 and the staff links. Customer has withdrawals and no staff plans
or reports; direct report access redirects. CENTRAL_OPS/AUDITOR reach the catalogue.
Mobile staff navigation closes after selection, follows the header and has no document
overflow; the report/table viewport is also bounded. Browser warnings/errors: none.

Raw production HTML checks cover two sign-in responses, reset-password and a 404:
fresh nonces, matching nonce on every framework script, enforced production policy
without inline/eval script exceptions, and no-store caching. Browser login, route
transitions, report loading, export and logout confirm hydration under this policy.

/review: plan alignment, architecture/design integrity and local production readiness
pass. No schema/service/routine/role permission changes. /imprint updates existing token
patterns. Prior audit evidence and edits were preserved. Local commit subsequently
requested by the user; no push/PR/deployment.
The preview was signed out, closed and stopped. Live deployment/retest and previously
deferred consequential final actions remain pending; this is not Phase 6 acceptance.

Ignored evidence: test-results/live-audit-fixes-verification.log,
live-audit-fixes-preview.log, live-audit-fixes-csp.json, live-audit-fixes-ui.json,
live-audit-fixes-reports.jpg and live-audit-fixes-mobile.jpg.
