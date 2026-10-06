# P02-M02-T04 — customer registration and read services

2026-10-05 · M2 · `feat/p02-m02-customer-registration`

## Delivered contract

`services/customer-service.ts` is server-only. Exported async functions:

- `registerCustomer(input: unknown, actor: CustomerActor)` returns customerId/customerNumber.
- `searchCustomers(input: unknown, actor)` returns customers/total/page/pageSize.
- `getCustomerProfile(customerId, actor)` returns customer/assignmentHistory/documents/accounts.

Actor is session-derived userId/roleName/branchId, rechecked against active current
database state. Strict schemas live in `lib/validation/customer.ts`. Registration
accepts an ISO past birth date, bounded metadata, uppercase identity/lowercase email;
rejects status/login/verification fields. It creates independent customers without
credentials (ADR-0007). Documents may be empty; account-opening documentation is M3's rule.

One withTransaction writes customer, every document, one active assignment and minimal
audit. AGENT registers for self; BRANCH_MANAGER chooses an active ordinary AGENT in
its branch. Active staff/user/branch rows are locked and scope checked before writing.
Numbers are CUS- plus 24 uppercase random hex digits; UNIQUE remains authoritative
(ADR-0014). Duplicate identity/email use safe typed 409 errors. Audit includes customer
number, branch, assigned agent and document count; no identity/contact/path content.
The existing pooled audit helper is not used, preserving rollback atomicity.

Search filters q/name/NIC/branch/agent/status; sortBy fullName/customerNumber/createdAt,
sortDirection asc/desc, page>=1, pageSize<=100. Controllers parse numeric query strings.
All user values are parameterized; ordering identifiers come from fixed allow-lists.
LIKE wildcard characters are literal. Count and page share a repeatable-read snapshot.
AGENT sees currently assigned customers, managers their branch, CENTRAL_OPS/AUDITOR all.
CUSTOMER cannot search and can read only its optional-login-linked profile. Out-of-scope
profiles use the same 404 as missing rows. Branch staff NIC/email are masked; central,
auditor and self customer detail is retained. Document paths are omitted. Profile
includes inactive assignment history. Accounts are null until M3 supplies account_holder;
then approved joins apply account branch scope and return numeric balances as strings.

## Verification

`npm run verify:customer-registration` passed on 2026-10-05:

- 181 tests, 11 suites, zero failures/skips: 43 new service tests, 4 new DB rollback tests,
  134 existing customer/relation/document/organization regressions.
- Forced later-document, assignment and audit insert failures roll back every table;
  successful commit has all documents and exactly one current assignment. Duplicate
  concurrency, number generation, validation, inactive/stale actors, masking, SQL
  injection, pagination, history and customer self access are covered.
- All 14 migrations rebuild from empty, reapply and checksum-verify; typecheck/lint pass.
- An actual SET ROLE mims_app service test temporarily grants SELECT/INSERT on customer
  tables inside the disposable database, then revokes. It confirms no role UPDATE grant
  is needed by T04. This is not certification of missing production grants or RLS.
- A disposable synthetic account_holder fixture checks the approved future join/money
  contract. It is not M3's migration or actual account-opening integration.

Harness uses a fresh temporary PostgreSQL 18.6 cluster, removed after completion. Test
committing fixtures require mims_test_customer_schema. The destructive legacy migration
runner test is excluded. No development database rebuild or new migration occurred;
the normal database's existing 14 migrations passed read-only verification. PostgreSQL
15/16 was not separately exercised. No customer HTTP/session/CSRF/UI tests are claimed.

## M1 / M3 / T05 integration

M1 must supply scoped customer/child grants and RLS, using transaction-local
app.current_user_id/app.current_branch_id (bank-wide branch is empty string; handle
with NULLIF). Verify policies for assigned agents, own-branch managers, bank-wide
central/auditor and customer self access; test with the application login. Account
RLS/grants must also support authorized profile links once account_holder lands.
Coordinate generic audit bindings with T04's explicit creation event to prevent duplicate
or unsanitized audit rows; child keys are cust_agent_id/doc_id, not generic id.
No security implementation files were changed by M2.

Review found pre-existing T03 verifyDocument locks role FOR SHARE, requiring write
privilege absent from the runtime role. Its older owner tests did not cover this.
M2 should narrow that lock before exposing document verification; M1 should retain
read-only role grants. T04 already locks only writable staff/user/branch rows.

M3 can consume the committed customer/assignment/metadata rows, but must validate
customer eligibility and required verified documents within account opening. Do not
invoke verifyDocument on uncommitted registration rows; it owns a separate transaction.
Publish account_holder before claiming complete customer account links.

T05 must add authenticated, authorized and CSRF-protected controllers, safe response
mapping and real screen bindings. Screens are currently prototypes in
components/mims/workflow-screen.tsx, not completed app/dashboard customer integration.
No UI component was rebuilt by T04. Runtime integration is BLOCKED pending M1 work;
service/controller development can use the contracts above.

## /review report

Plan alignment: PASS for T04 registration/search/profile services and safe test harness.
T05 endpoints/UI and M1/M3 owned implementation are explicitly outside T04 delivery.
System integrity: PASS — lib/db transactions, handwritten parameterized SQL, typed
errors, no pg import outside lib/db, no migration/ownership violation, money as strings.
Production readiness: service tests PASS; runtime release remains blocked by scoped
grants/RLS/audit integration, actual controllers and future account-holder integration.
The pre-existing T03 lock issue is recorded above for its owner before exposure.
No UI changes: /imprint is not applicable. No unresolved T04 implementation defect
was found in the final review; runtime/other-task limitations are not marked complete.

Technical task status is DONE locally under the existing publication exception.
User review, commit, PR and merge remain pending and user-controlled. No assistant
commit, push, merge or PR was performed. Historical Phase 2 entry approval is retained;
these focused checks do not recertify missing Phase 1 closeout repairs or approve exit.

## PR #36 integration follow-up — 2026-10-06

The missing-closeout warning above describes the original focused run. Dev's committed
Phase 1 repairs are restored by the pending local merge of 76701e7. Combined verification
now passes 328 tests with no failures/skips, a clean 14-migration rebuild, TypeScript,
lint and production build. Customer decision is renumbered ADR-0014 to preserve dev's
distinct ADR-0013. Fixture isolation and disposable role membership repairs are detailed
in [the conflict-resolution handoff](p02-m02-t04-pr36-conflict-resolution.md).
Application services/migrations are unchanged; T05 and other runtime limitations remain.
The user still controls commit, push and merge; no later phase approval is inferred.
