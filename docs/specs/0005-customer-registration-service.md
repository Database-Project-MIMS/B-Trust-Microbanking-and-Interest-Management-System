# P02-M02-T04 — registration and customer read services

2026-10-05 · M2 · feat/p02-m02-customer-registration

The user's request authorizes the next READY task, T04. `/architect` restores the
existing approved schemas and task card. T05 controllers/UI wiring and M1's runtime
grants/RLS remain separate work; no owner credentials or broad grants are added.

## Blueprint

- Registration means one withTransaction: authenticate actor context against current
  active user/role/profile/branch, lock the active ordinary agent in that branch,
  insert customer, every document, one current assignment and a minimal audit event.
- Controllers will pass the authenticated actor, never request-selected identity.
  AGENT registers for self in its branch; BRANCH_MANAGER chooses an active AGENT
  in its branch. Missing/inactive profiles or stale actor scope fail closed.
- Strict server schemas normalize identity to uppercase/email to lowercase, validate
  real calendar dates, field lengths, UUIDs and metadata. Identity format is a bounded
  alphanumeric NIC/passport reference, not verification of government authenticity.
  Birth date is compared to database CURRENT_DATE inside the transaction. Documents
  may be empty at registration; required/verified documentation is M3's opening rule.
  Client-supplied IDs/status/login/verification fields are rejected.
- Customer numbers are opaque CUS- plus 24 uppercase random hex digits (28 chars).
  Existing UNIQUE is authoritative; no MAX+1 race, new sequence or migration is needed.
- Search is paginated, name/NIC/branch/agent/status filtered, with fixed allow-listed
  sort columns/direction. Scope lives in SQL. AGENT reads assigned customers only;
  managers read their branch; CENTRAL_OPS/AUDITOR are bank-wide. CUSTOMER can read
  only the profile linked through optional app_user_id, not search.
- Read DTOs mask NIC/email for AGENT/BRANCH_MANAGER; CENTRAL_OPS/AUDITOR and the
  owning CUSTOMER receive them. Documents omit paths. Profile includes complete
  assignment history and document verification metadata. Account links use the approved
  account_holder contract once M3 supplies that table; until then accounts is null,
  explicitly unavailable rather than a false empty list.
- Repeatable-read service transactions give consistent pagination/profile snapshots;
  transaction-local identity is set for future M1 RLS. Safe typed errors map duplicate
  NIC/email to 409. Registration audit uses this same client, not the old pooled helper.

## Checks and handoff

Test registration success, multi-document/assignment/audit rollback, duplicates and
concurrent duplicates/numbers, inactive/wrong-scope staff, strict validation and SQL
injection. Test scoped reads, masking, search/sorting/pagination, history and customer
self access. Extend the safe disposable-cluster harness and run all 134 regressions,
clean rebuild/reapplication/verification, typecheck/lint. No destructive dev rebuild.
Update docs/status/handoff/memory; no commits, pushes, merges or PRs by the assistant.
No UI edits/imprint; actual screens are prototypes in components/mims/workflow-screen.tsx.
