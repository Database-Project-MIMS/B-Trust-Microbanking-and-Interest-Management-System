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
