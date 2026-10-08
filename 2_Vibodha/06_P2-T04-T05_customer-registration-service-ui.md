# Phase 2 — Customer registration, APIs and screens

**Tasks:** P02-M02-T04 and P02-M02-T05
**Branches:** feat/p02-m02-customer-registration (T04); feat/p02-m02-customer-api-ui (T05)
**Status:** T04 merged; T05 technically DONE locally, user publication pending
**Depends on:** T02/T03, M1 authentication/RBAC/CSRF and RLS/audit, M4 withTransaction
**Points:** ~5 + ~5 · **Layers:** backend and frontend

## Implemented contract

POST /api/customers authenticates AGENT/BRANCH_MANAGER, verifies CSRF, validates
strict fields, derives actor scope from the session and calls registerCustomer.
Input: fullName, nicPassportNo, dateOfBirth, optional gender/phone/address, email,
branchId, agentId and documents (zero to twenty { docType, filePath } references).
The service rechecks active stored actor/branch/selected ordinary agent state.
AGENT assigns to self; managers choose an active ordinary agent in their branch.
One withTransaction inserts the customer, trigger audit, documents and assignment;
any failure rolls all effects back. Success: 201 { data: { customerId, customerNumber } }.
Duplicate normalized identity/email returns a safe 409. ADR-0014 numbering is retained.

GET /api/customers accepts name/NIC/general query, branch, agent, status, allow-listed
sort/direction and pagination. Branch staff receive masked NIC/email; AGENT reads only
current assigned customers. CENTRAL_OPS/AUDITOR are bank-wide readers.
GET /api/customers/{id} returns identity, all assignment history, safe document metadata
and real account_holder links; CUSTOMER may read its optional-login-linked profile only.
Missing or out-of-scope profiles return the same 404. Money stays a string.

The service sets user/role/branch through M1's transaction-local helper.
New migration 0223 supplies scoped child SELECT/INSERT; no child UPDATE/DELETE.
M1's customer trigger supplies one sanitized audit event, replacing T04's explicit
minimal INSERT audit. M1 retains security stewardship and review; see ADR-0015.

## Live screens

- /customers: named scoped filters, sorting, pagination, loading/empty/error/retry states.
- /customers/new: session branch, appropriate agent options, optional document references,
  disabled saving fields, preserved inputs on failure, navigation to the new profile.
- /customers/{id}: masked or authorized identity, assignment history, document status
  and account links. Account-opening/detail implementation remains M3's responsibility.

Document references are metadata only. File upload/download, verification endpoints,
reassignment and customer login provisioning remain separate contracts.
The existing internal verifier still needs its role lock/scoped UPDATE integration before exposure.

## Acceptance and evidence

- [x] Atomic customer/document/assignment/audit commit and rollback
- [x] Duplicate NIC/email return safe HTTP 409 without partial effects
- [x] Session, role, branch, assignment and self access enforced on the server
- [x] CSRF and strict JSON/query/UUID validation
- [x] Server masking; document paths omitted
- [x] Assignment history and actual holder relation, string balances
- [x] Runtime tests use migrated grants/RLS without temporary customer grants
- [x] Live registration/search/profile and mobile/duplicate browser checks
- [x] 365 tests in 35 suites; zero failures/skips, clean 19-migration rebuild
- [x] Typecheck, lint and production build; /review and /imprint recorded
- [x] Task status and handoff updated
- [ ] User commit/push/PR and independent review/merge

[Handoff and review](../.agent/handoffs/p02-m02-t05-customer-api-ui.md).
Use the isolated full verifier for fixture/migration tests; never reset development data.
