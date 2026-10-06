# P02-M02-T02/T03 — customer relations and verification handoff

2026-10-05 · M2 → M1, M3, M5 and next M2 task
Branch: `feat/p02-m02-customer-agent-document`.
Technical implementation verified locally; team review/publication pending.

## Stable schema contract

- 0221_p02_m02_customer_agent.sql: cust_agent_id UUID PK; customer_id/agent_id
  required RESTRICT FKs; assigned_date defaults CURRENT_DATE; end_date nullable;
  ck_customer_agent_dates forbids end before assignment; is_active defaults true.
  ux_customer_agent_one_active allows at most one current assignment, including
  concurrent INSERT/UPDATEs. Multiple inactive histories and repeated historical
  customer-agent pairs are valid. ix_customer_agent_customer/agent serve history/FKs.
- 0222_p02_m02_customer_document.sql: doc_id UUID PK; customer_id required RESTRICT
  FK; doc_type varchar(50), file_path varchar(500) required; uploaded_date defaults
  now(); verified_by nullable RESTRICT FK to app_user and verified_date nullable.
  ck_customer_document_verification requires both verified fields set or neither.
  ix_customer_document_customer serves document/profile/eligibility lookup.
- Both tables have non-null created_at/updated_at defaults and set_updated_at triggers.
  Child customer_id refers to independent customer identity, not optional app_user_id.
  Migration runner owns filename/checksum recording; no merged migration was edited.

## Verification service contract

services/customer-document-service.ts exports verifyDocument(docId, verifierUserId).
The future authenticated/CSRF-protected controller supplies verifierUserId from its
session, never a client body. Active AGENT/BRANCH_MANAGER roles require an active
profile/branch. Customer must be active/in that branch; an AGENT also needs a current
assignment. SQL scope/row locks protect the decision. Missing profile fails closed.

One withTransaction sets transaction-local identity, locks authorization/customer/
document/assignment rows, updates both verification fields and inserts a minimal
audit UPDATE with original/null and resulting verification fields only. No path,
file contents or customer identity enters that JSON. Audit failure rolls back all
verification changes. Same-user retry returns original timestamp without another audit;
different verifier gets DOCUMENT_ALREADY_VERIFIED (409). Invalid UUIDs give 400,
denied access 403, missing document 404. Return: docId/customerId/verifiedBy/verifiedDate.

This is an independent transaction for **existing** documents. Do not call it inside
registration's open transaction: a separately pooled transaction cannot see uncommitted
rows. T04 registration inserts customer, documents, assignment and its own minimal audit
using one client; verify separately after commit, or implement a transaction-local helper
if that later task truly needs verification during registration.

## Integration work remaining

- **M1:** P02-M01-T01 scoped runtime grants/RLS and P02-M01-T02 generic master audit
  bindings. No grants were added for customer or children. Consider child-table scope,
  not only parent customer policies. Generic audit must resolve customer_id/doc_id/
  cust_agent_id correctly and omit paths/identity; verification already writes its
  explicit minimal event, so avoid duplicate events when binding a document trigger.
  Existing writeAuditEvent uses the global pool and cannot join this transaction.
  No M1-owned implementation file was edited. docs/15 permits ADMIN registration but
  docs/05/task card omit it; verification follows the narrower contract pending resolution.
- **M2 T04:** Dependencies T02/T03 and I-1/I-2 are available, so registration-service
  implementation is READY. Supply exactly one current assignment at registration and
  close/insert atomically on reassignment. Validate staff/branch suitability in service;
  FK/index alone do not enforce branch matching. Future API runtime integration must
  wait for M1 scoped privileges/policies. T05 remains TODO; specific task card calls for
  backend API integration with prebuilt screens, rather than rebuilding UI.
- **M3:** Account opening must validate required/verified documentation using customer_id
  inside its opening transaction. No account-opening eligibility rule is claimed here.
- **M5:** Metadata/assignment tables are available for later synthetic seeds; no permanent
  seed files were changed and test fixtures stay in the disposable cluster.

## Evidence and /review

`npm run verify:customer-agent-document`: **134 tests**, 0 failures/skips: 23 assignment,
23 document, 23 service/concurrency, 27 existing customer and 38 organization regressions.
Full clean rebuild of 14 migrations, repeat application/verification, typecheck and lint
pass on disposable PostgreSQL 18.6. Cleanup removes its generated temporary cluster.
Committing service/concurrency tests reject any DB name other than the disposable one.
Existing destructive legacy migration-runner test is excluded. Normal development DB
received only 0221/0222 additively and verifies; existing data was not reset.

/review plan alignment: PASS for T02/T03's DB + light backend scope.
System integrity: PASS; parameterized SQL, server-only code, pg only through existing
lib/db, explicit transaction/audit boundary, restrictive FKs, justified indexes,
immutable existing migrations and ownership respected.
Readiness: PASS for local task logic/constraints, including negative authorization,
verification retry/races, concurrent assignment commit/rollback and forced audit rollback.
Runtime integration remains pending scoped M1 access, generic audit binding and T04/T05
controllers. No UI changed; imprint is not applicable. The phase's full exit is open.

Earlier uncommitted Phase 1 closeout repairs are absent from this checkout; the historical
approval record still applies. This task evidence does not recertify those missing repairs.
All five overview tables were reviewed; only M2's newly completed row was struck through.
No commit, push, merge or PR was performed, per user instruction.

## Integration follow-up — 2026-10-06, PR #35

The missing closeout condition above describes the original 2026-10-05 tree. PR #35's
conflict resolution now restores committed dev closeout repairs and retains these
implementations unchanged. Fresh combined validation passes 281 tests, clean 14-migration
rebuild, typecheck/lint/build. The fixture guard also supports dev's full isolated
mims_test_closeout harness only with its isolation marker; development remains denied.
Runtime grants/RLS and the pre-existing role FOR SHARE lock still need integration
before endpoint exposure. See the PR #35 resolution handoff; user controls publication.
