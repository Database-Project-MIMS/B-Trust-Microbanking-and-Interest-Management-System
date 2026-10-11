# Record details and editing — cross-owner handoff

P06-M02-T04 · 2026-10-11 · ADR-0034

The user explicitly requests View/Edit across organization, customers, accounts
and FDs, and confirms fixed-deposit opening terms remain read-only. M2 implements
this scoped contribution on feat/p06-m02-record-details-edit. M3 retains accounts,
M5 retains FDs/products, M1 retains authorization/security tests; no ownership transfer.
Changes to these owners' pages, services and endpoint security inventory are needed
to make the actions usable and verify role/branch denials. Merged SQL is unchanged.

## Implemented behavior

- Branch and agent tables expose View details and permitted Edit links. New detail
  pages show all registration/contact/employment fields and named relationships.
  Existing organization PATCH operations preserve their role/scope and status guards.
- Customer View/Edit reuses the scoped profile, with named branch and registration date. Agent/manager may update name,
  gender, phone and address; only the assigned agent may change email. Identity,
  birth date, branch, assignment and status remain protected. Manager email masking
  never enters a form or write payload. Customer trigger audit commits with the edit.
- Accounts have explicit View/Edit links. Managers may update ACTIVE/FROZEN status
  and existing joint withdrawal mandate. The service locks the scoped account and
  mandate, derives required signatures from holders, and commits audit with changes.
  Existing closure is exposed with confirmation and its original financial guards.
- FD details show all stored terms, linked account/plan/branch and visible owners,
  with account/customer navigation. Only existing linked-account and central interest
  management actions are exposed. No FD PATCH, principal/rate/date correction or
  balance editing. Exact decimal strings remain authoritative.
- Savings-plan and FD-product tables have keyboard-accessible native expandable
  View details, preserving existing product editing. Shared edit forms submit changed
  fields only, preserve failed drafts, support Cancel and confirm restrictive statuses.

## Interfaces and owners

M2: organization detail GET/pages, customer PATCH/profile/list, shared record controls.
M3 contribution: account PATCH/detail/list/edit, savings-plan details, account FD links;
paths under `app/accounts`, `app/api/accounts/[id]`, `app/plans`,
`services/account-service.ts`, `lib/validation/account.ts`.
M5 contribution: FD GET/detail/list and product details; `app/fixed-deposits`,
`app/api/fixed-deposits/[id]`, `app/fd-products`, `services/fixed-deposit-service.ts`.
M1 contribution: route security inventory and independent docs/19 permission matrix.
Original ownership retained. No migrations, grants or physical database objects added.

## Review and verification

API tests cover real runtime-role requests,
foreign/assignment/self denials, CSRF, strict protected fields, duplicate/normalized
email, closed accounts, exact FD terms, audit and injected-fault transaction rollback.
DB tests exercise existing runtime grants, immutable FD terms, account guards,
mandate constraints and RLS. Render tests check actions, permissions and form semantics.

Browser checks use a production app with disposable synthetic PostgreSQL. Branch
address/customer contact saves and account freeze confirmation/cancel/reactivation
pass; FD details show linked account and both joint owners. Catalogue disclosures
and auditor direct edit URL show correct read-only behavior. Mobile FD page has
no document overflow. Browser found agent DATE values serialized as timestamps;
both agent queries now cast DATE to text, retaining the exact stored calendar date.
API regression assertions cover GET/PATCH birth and hired dates.

Final full `npm run verify:phase1 -- --tap`: 3,584 tests/120 suites (2,392 security
plus 1,192 API/DB/e2e), zero failures/cancellations/skips, clean 70-migration rebuild,
checksums and exact backup/restore, typecheck, ESLint and production build pass.
After final customer branch/registration metadata, the entire API suite was repeated:
361 tests/33 suites pass; the final production build includes this metadata.
Logs: `test-results/record-details-verification-final.log` and
`test-results/record-details-api-final.log` (ignored local artifacts).
Final browser confirms exact agent date controls and manager agent save, assigned
agent email save, customer branch/registration display and scoped FD owner links.
No console errors/warnings. Evidence: `test-results/record-details-fd.jpg`,
`record-details-agent.jpg`, `record-details-owners.jpg`. Synthetic local screenshots;
attach to the eventual PR. Browser signed out/closed, viewport restored, previews stopped,
temporary clusters cleaned; existing developer/hosted databases preserved.

### /review

- Layer 1 / plan alignment: PASS. All requested record categories have View;
  permitted editing is accessible, and FD terms stay read-only as confirmed.
- Layer 2 / system integrity: PASS. SQL remains in scoped services, inputs are strict
  and parameterized, mutations require CSRF, locking/audit share transactions,
  runtime database guards remain, and UI uses registry tokens/patterns.
- Layer 3 / readiness: PASS for local delivery. Safe loading/retry/error/empty states,
  cancellation/confirmation, mobile layout, role denials and production browser saves
  verified. Missing audit actor_type, stale pre-edit test contract and DATE serialization
  findings were addressed and regression-tested. No unresolved feature findings.

/imprint captures shared actions/details/forms/disclosures in `ui-registry.md`.
/remember save appends continuation context, retaining previous memory without secrets.
REVIEW awaits peer review/publication, not general phase or deployment acceptance.

## Publication dependency / PR draft

PR #97 and #98 are still open/unmerged when checked this session. This branch starts
from #98's corrected 9e41cd3 tree, which includes #97's build/menu corrections.
PR creation waits for the user's merges of both. No push/merge/deployment.
Before publication, incorporate the actual integration target and verify the combined
tree; the repository currently uses `dev`/`main`, rather than the contract's `develop`.

Suggested PR title: `P06-M02-T04: add scoped record details and permitted editing`.
Task IDs: P06-M02-T04, with the contributions above. Database changes/migration
numbers: none; existing constraints, grants, RLS and audits reused. Backend: scoped
organization/FD GETs, validated customer/account PATCH and transactional audit.
Frontend: explicit actions, full details, guarded forms and FD owner/account links.
Tests/screenshots: final receipt below. Dependencies: merged #97/#98 and peer review.

## Filter/navigation follow-up — 2026-10-11

The user adds branch, agent and fixed-deposit filters and specifies the AGENT menu
order. M2 owns this follow-up to P06-M02-T04; M1 retains TopBar/security stewardship,
M5 retains FD listing/schema/service/page stewardship. Existing master-data and
financial mutation interfaces remain unchanged. No migration or new dependencies.

New shared RecordListFilters applies drafts through Search and restores defaults
through Clear. Organization SQL combines q, status and district/branch with existing
scope. FD SQL combines q, fdPlanId and existing filters, sharing predicates/count
in a read-only repeatable-read transaction. Holder-name matching explicitly enforces
branch, agent assignment and linked customer self scope alongside existing RLS.
This closes the co-holder search-count exposure caught by the negative API test.
Filter choices include permitted inactive branches and historical FD products;
agent creation continues to select only active branches. FD Search/Clear resets page.

Touched M1 paths: components/app-shell/top-bar.tsx, tests/helpers/security-routes.mjs,
docs/19_implemented-api-matrix.md. Touched M5 paths: app/fixed-deposits/{page,fd-list}.tsx,
app/api/fixed-deposits/route.ts, services/fixed-deposit-service.ts and
lib/validation/fixed-deposit.ts. M2 interfaces remain backward compatible;
list APIs preserve response shapes and optional existing service arguments.

Focused rerun: 367 API tests/34 suites pass, zero failures/cancellations/skips.
Rendered controls: 5 tests pass, including exact AGENT ordering and preserved
CUSTOMER/BRANCH_MANAGER menus. Full receipt and browser evidence follow after QA.

### Final filter/navigation verification and /review

All 3,640 distinct checks are verified across runs: 2,440 security checks, 1,130
API/DB checks and the corrected 70-test E2E suite. The initial combined run had
four UI cancellations because the old FD renderer omitted the new products prop;
its fixture was updated, the focused four tests passed, then all 70 E2E tests/14
suites passed with no failures/cancellations/skips. Final disposable verification
also passes the 70-migration rebuild/checksum/reseed/28-table restore, typecheck,
ESLint and optimized production build. Logs (ignored): record-filters-verification.log,
record-filters-api.log and record-filters-ui-build.log under test-results.

Production browser: branch drafts apply on Search; unmatched district/text and
Clear verified; agent identity/branch/status combinations and active-default Clear
verified with only permitted branch choices; FD account/product/status intersection,
owner search, empty products and all-status Clear verified. AGENT menu order is
exact on desktop and mobile. Page scrollWidth equals clientWidth at the mobile
breakpoint. Console has no errors/warnings; viewport restored. Fresh synthetic
preview remains running for the user; no existing developer/hosted database changed.
Screenshots (ignored): record-filters-branches.jpg, record-filters-agents.jpg,
record-filters-agent-menu.jpg, record-filters-mobile-menu.jpg, record-filters-mobile.jpg.

/review: all three layers PASS. Plan covers all requested filters/order; SQL remains
parameterized and scoped in services, FD count/rows share a read-only snapshot,
explicit holder scope prevents the discovered count exposure, native UI tokens and
role gates are retained. Safe loading/error/retry/empty and stale-response guards
are present. Both discovered verification findings were fixed and retested.
/imprint captures filters and responsive menu in ui-registry.md; /remember saves
continuation without credentials. P06-M02-T04 stays locally verified REVIEW pending
peer review and user publication; no new general task or phase gate is accepted.
All five member overview tables reviewed; their existing acceptance rows stay intact.

PR draft now also includes scoped branch/agent/FD filters, explicit holder-name
scope, Search/Clear and FD pagination reset, and the requested agent menu ordering.
No migration numbers, schema changes or dependencies added. Still no push/PR/merge.

Local implementation commit: d0c2d0a — scoped list filters and agent navigation order.
Documentation/verification is saved in a separate follow-up commit. Publication
still waits for the user; no push, PR, merge or deployment performed.

Dashboard label follow-up (2026-10-11): user requests removal of the role-access
caption beside Your workspaces. Removed its span in M1 app/dashboard/page.tsx;
existing heading/layout and scoped links retain their behavior. /review passes;
typecheck and targeted ESLint pass. No new test is needed for this text removal.
