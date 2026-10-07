# ADR-0015 — Customer API runtime integration

2026-10-07 · M2 implementation decision within user-authorized P02-M02-T05;
M1 security stewardship/review retained for the user-published PR.

## Decision

Reuse the merged setRlsContext helper, parent RLS policies and customer audit trigger.
Revalidate stored user/role/branch state, then set all three transaction-local values.
Remove T04's explicit customer INSERT audit to avoid duplicate events. The customer
trigger's masked row replaces T04's earlier minimal audit format; children and the
trigger event still commit or roll back in the same registration transaction.

Add migration 0223 in M2's reserved block for M2-owned customer_agent/customer_document.
Grant SELECT/INSERT with RLS tied to parent visibility, branch-only inserts, AGENT
self-assignment and null document verification fields. No UPDATE/DELETE, owner membership,
role UPDATE, global bypass or edits to merged security migrations are introduced.
Existing helpers are dependencies; M1 retains review of the security integration.

Wire session/CSRF-protected registration and authenticated search/profile routes to
live customer screens. Preserve ADR-0014 numbering/masking and existing mutation roles.
Use the real merged account_holder relation and keep monetary balances as strings.
Document references are metadata only; upload, verification routes, reassignment and
optional customer-login provisioning remain outside T05's contract.

## Evidence and implications

Route tests execute under SET ROLE mims_app using migrated grants, without test-only
customer grants. Direct SQL tests cover child scope and prohibited writes; owner fixtures
are guarded to disposable databases. M1-T03's wider customer/account route review remains
its owner's task. No other member completion or new phase approval is inferred.
Verification and review: ../handoffs/p02-m02-t05-customer-api-ui.md.
