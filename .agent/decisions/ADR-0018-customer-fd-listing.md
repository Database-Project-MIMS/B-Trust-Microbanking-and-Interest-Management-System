# ADR-0018 — Customer FD listing under a scoped early start

**Date:** 2026-10-08 · **Owner:** M2 · **Task:** P04-M02-T01
**Decision:** Authorized by Vibodha's “do the task now”, following the explanation of
the incomplete M5 opening dependency and general Phase 4 entry gate.

Implement only the read-side customer/FD view, listing endpoint and profile panel.
The real `fixed_deposit` schema is merged in dev (0480, PRs #54/#56); M5 describes
P04-M05-T02 as partial. Synthetic disposable fixtures verify this slice without
calling that money-moving routine. No Phase 3 exit/general Phase 4 entry, OQ-13/OQ-14,
M5 opening completion or unrelated task approval is inferred.

Use `start_date`, not the task card's illustrative `opened_date`; preserve the FD
snapshot rate and principal as decimal strings. All statuses are listed, including
historical matured/closed deposits. Join through `account_holder`; a joint FD appears
once for each linked customer, without exposing the other holders.

Roles match the customer profile: AGENT (current assigned customers, own branch),
BRANCH_MANAGER (customer and account both own branch), CENTRAL_OPS/AUDITOR (bankwide),
CUSTOMER (optional-login-linked self). Denied/unknown customer IDs share a 404.
Revalidate the stored active actor and staff branch in a read-only repeatable-read
transaction; set existing local RLS context; apply scope in SQL.

The view uses PostgreSQL 15+ `security_invoker` and `security_barrier`. Its runtime
SELECT grant requires narrowly scoped FD column SELECT plus SELECT-only FD RLS
through visible accounts/holders/customers, including agent assignment checks.
No FD mutation grant/policy is added. M1/M5 coordination is recorded in the handoff;
their auth, grant files, opening routine, seeds and merged migrations are untouched.
These are the baseline controls needed for T01; T02's broader FD access integration
remains a separate task.

Migration 0420 must precede 0480 on a clean rebuild. It defines an owner-only,
security-invoker installer with the authoritative view/policy definition. It binds
immediately on an existing FD schema; the existing post-migration view stage invokes
it on clean builds. The installer is idempotent and unavailable to `mims_app`/PUBLIC.
No shared migration runner or another member's migration is modified.

Plan: implement migration/binder → scoped service/API → profile panel → DB/API
negative tests → isolated rebuild/checksum/tests/type/lint/build → browser QA →
three-layer review, imprint and handoff. User retains all Git publication control.
