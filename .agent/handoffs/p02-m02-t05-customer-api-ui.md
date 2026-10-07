# P02-M02-T05 — customer API and screens

2026-10-07 · M2 · feat/p02-m02-customer-api-ui · base dev 25fc264

## Authorized plan and ownership — before implementation

The user explicitly requests T05 now, retaining commit/push/merge/PR control.
Move M2's row to IN_PROGRESS with this integration scope. T04 and M1 RLS/audit are
merged; remaining integration gaps are handled within this task rather than bypassed.
/architect: implement GET/POST /api/customers and GET /api/customers/{id}, session,
role/branch scope, CSRF on registration, strict inputs and safe typed errors.
Connect M2-owned customer list/new/detail pages using existing Emerald UI patterns.
Metadata only: no file upload/download, verification endpoint or login provisioning.
Use existing server-only services, auth helpers, transaction-local RLS helper and
M1's customer audit trigger; eliminate duplicate explicit customer INSERT audit.

M1 coordination note: missing child-table runtime access is completed in a NEW M2
migration 0223 for M2-owned customer_agent/customer_document. Scope SELECT/INSERT
through the visible parent customer; no UPDATE/DELETE, global bypass or owner grants.
No edit to M1's roles files, helpers or merged migrations. M1 retains security stewardship
and should review these policies/grants and the audit reconciliation in the user's PR.
The registration transaction still rolls back parent-trigger audit with failed children.
M3's real account_holder is used; do not create/drop a synthetic substitute in tests.
The pre-existing document verifier role lock remains a separate T03 integration issue;
T05 exposes no verification operation. No other member task is marked complete.

## Verification plan

Test real sessions and routes under SET ROLE mims_app without temporary child grants:
create/search/profile, masking, role/branch/self denial, CSRF, malformed JSON/query/IDs,
duplicates and rollback, one sanitized audit, child RLS and no UPDATE/DELETE grants.
Adapt M2's existing tests to real holder migration and merged audit/grants contracts.
Run full isolated rebuild/tests/typecheck/lint/build; UI browser/render checks.
/review and /imprint evidence, task status, remaining limitations and exact counts
are recorded here before publication. No local development data reset or secrets saved.

## Completed implementation and verification — 2026-10-07

- GET/POST /api/customers and GET /api/customers/{id} are wired to real services.
  Session/role checks, CSRF on POST, strict JSON/query/UUID validation, safe errors
  and SQL branch/assignment/self predicates apply. No SQL is placed in the routes.
- Live search has named scoped branch/agent filters, sort/pagination and loading,
  empty/error/retry states. Registration preserves failed inputs, disables saving
  controls and opens the created profile. Profiles mask staff NIC/email and show all
  assignment history, safe document metadata and real holder/account links.
- 0223 scopes M2 child SELECT/INSERT using M1 helpers; no UPDATE/DELETE or role UPDATE.
  Customer service sets all three shared RLS values and uses one sanitized trigger audit.
  Failed child writes roll back that audit and customer together.
- Existing tests now match the merged trigger/grants and use M3's real holder table,
  without replacing its schema. New route tests run sessions/services as mims_app;
  new DB tests bypass services to prove child RLS and prohibited writes.
- Full isolated PostgreSQL 18.6 run: 365 tests / 35 suites, 0 fail/cancel/skip;
  all 19 migrations rebuild from empty, runner checks/reapplication and seeds verify;
  TypeScript, ESLint and Next production build pass.
  Local ignored log: test-results/t05-verification.log.
- Browser preview used a separate disposable cluster and synthetic seeded agent.
  Verified registration with document metadata → profile, masked identity, assignment,
  unverified status, no linked accounts; filtered search → profile and back links;
  duplicate NIC error retains entered data; narrow form/profile layout has no document
  overflow. Screenshot: test-results/t05-customer-profile.png (ignored, synthetic data).
  The final search retry improvement passed typecheck/lint/build and browser navigation
  again; final build log: test-results/t05-final-build.log. Temporary clusters/server stopped.
- Initial sandbox PostgreSQL/build file operations required approved execution outside
  the sandbox. These were environment permission failures; no failed code check remains.
  The normal development database was not reset or migrated. Use npm run db:migrate
  to apply 0223 before running this branch against that database.

## /review — T05

Plan alignment: PASS. All three routes and customer screens are live; metadata-only
document scope is maintained. No verification/upload/login provisioning or reassignment.

System integrity: PASS. Shared auth/CSRF/RLS/error/transaction helpers reused; service
owns transactions; parameterized values and fixed sort identifiers; balances stay strings.
No merged migration, lib/auth, lib/db, database/roles, shared shell or global CSS edit.
ADR-0015 and the ownership plan above explicitly retain M1 review of child policies.

Readiness: PASS for the T05 implementation. Authentication/scope/CSRF/validation,
duplicates, atomic rollback, concurrent registration and one masked audit pass.
Browser loading/empty/success/duplicate states and responsive layout were inspected.
Review found repeat-search retry behavior; corrected and verified. Existing shared GSAP
missing-target warnings are outside these screens; no new customer JavaScript error found.
Remaining prerequisites for publication are user commit/PR and independent review.

## /imprint, /remember and task state

Customer Emerald card/form/table/button/error patterns are saved to ui-registry.md.
Current state, M2 context, task card/overview, all member summary snapshots, tracker,
phase doc and non-sensitive memory are reconciled. Other-member rows retain their
existing statuses; overview strikethroughs now match those tracker rows.
P2: 10 DONE / 1 READY / 5 TODO. M2 T01–T05 technically DONE locally.
M1-T03's broader customer/account route work remains TODO; M3-T03 remains READY.
Phase 2 entry approval persists; no Phase 2 exit or Phase 3 entry approval inferred.

M1 review: 0223/security/audit integration and the existing ADMIN permission-document
discrepancy. Future document verification exposure still requires its recorded lock
and scoped UPDATE integration. M3 account-detail routes/screens and opening/mandate
work remain its responsibility; account links currently use its existing route contract.
The user owns commit/push/PR/merge. No assistant publication or completed Git merge.
