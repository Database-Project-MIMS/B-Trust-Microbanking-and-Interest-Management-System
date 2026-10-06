# P02-M02-T02/T03 — customer assignment and document blueprint

2026-10-05 · M2 · `feat/p02-m02-customer-agent-document`

The user's "do it" authorizes this documented combined task. `/architect` uses
the approved task card and existing customer schema; no new identity model is needed.

## Contract and decisions

- Assignment is effective-dated history. Migration 0221 adds RESTRICT customer/agent
  FKs, required dates/active flag, date-order check and G-10 partial unique index.
  The index guarantees **at most one** current assignment. T04 registration and a
  future reassignment transaction supply existence and preserve history atomically.
- Document is metadata: type and path, without file contents or upload infrastructure.
  Migration 0222 adds RESTRICT customer/verifier FKs, a paired verification check
  and customer lookup index. Account-opening document eligibility remains M3 work.
- Both mutable tables have created_at/updated_at and the shared timestamp trigger,
  per AGENTS.md §§7–8. uploaded_date retains its separate domain meaning. These
  contract-required timestamps supplement the task card's abbreviated ERD columns.
- The migration runner records filename/checksum; omit the card's incompatible
  schema_migration(version,name) example. Existing migrations stay immutable.
- `verifyDocument(docId, verifierUserId)` is a server-only service. The caller must
  pass the authenticated session user ID, never a client-selected verifier ID.
  Following docs/05's customer mutation roles, only active AGENT/BRANCH_MANAGER
  users with an active branch/profile are accepted. Agents must currently serve the
  customer; managers may verify any active customer in their branch. Scope is in SQL.
- One withTransaction boundary locks authorization rows, customer and document,
  sets both verification fields and writes a minimal audit event via the same client.
  Repeat verification by the same user returns the original result. A different
  verifier receives DOCUMENT_ALREADY_VERIFIED (409), preserving original attribution.
- No endpoint/UI is added here. T04/T05 supply authentication/CSRF controllers and
  registration. M1 owns scoped grants/RLS and generic audit bindings. No broad grants,
  owner credentials in runtime configuration, or edits to M1/M4 implementation files.

## Implementation and verification

1. Add 0221/0222 and document their exact columns/integrity guarantees.
2. Implement the verification service with parameterized SQL and typed safe errors.
3. Test SQL constraints, historical assignments, verification authorization, retries,
   concurrency and audit-failure rollback using the existing lib/db pool.
4. Extend the disposable PostgreSQL verification command; rebuild all migrations,
   rerun migrations, run selected DB/service/API/workflow regressions, typecheck/lint.
   Service/concurrency fixtures that commit are restricted to the disposable test DB.
5. Apply only the two additive migrations to the normal development DB. Review and
   record evidence, task states, overview, handoff and continuation memory.

The service's logic is tested as owner in the disposable cluster while real runtime
customer privileges remain denied. Runtime integration requires M1's scoped grants/RLS;
this verification does not certify those future policies. Customer registration remains
incomplete. User retains commits, merges and PR creation.
