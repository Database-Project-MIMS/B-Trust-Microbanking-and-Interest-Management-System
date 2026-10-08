# ADR-0019 — Complete M2 customer FD read scope

**Date:** 2026-10-08 · **Owner:** M2 · **Task:** P04-M02-T02
**Authorization:** Vibodha said “do it now” after the remaining phase gate was
explained. This extends the scoped M2 read-side exception to T02 only. T01 is DONE
through PR #60, merged into dev e9291dc. No general phase/lecturer approval is inferred.

## Blueprint

Branch scope means both customer home branch and immutable account owning branch.
AGENT also needs the current active customer assignment. Bankwide means CENTRAL_OPS
or AUDITOR; CUSTOMER is the optional-login-linked holder, not every joint co-holder.
The live M2 FD read path is the customer FD endpoint/service and invoker view. M5's
global FD/report paths and M3's account panel remain their owners' interfaces.

T01 already implemented parameterized SQL scope, live service identity checks and
SELECT-only FD RLS. Do not duplicate routes, broaden the DTO or add a new UI. Close
the direct SQL backstop gap: role-only or stale branch context must not reveal FDs.

0421 adds STABLE SECURITY INVOKER fn_customer_fd_actor_is_current(), using the
existing context helpers and active stored user/role/profile/branch. Branch staff
must have an active profile/branch and a matching current branch claim. Bankwide
and CUSTOMER roles need an active matching identity, independent of retained staff
profiles. This checks trusted transaction context consistency; it is not a replacement
for session authentication, and someone able to impersonate a valid identity in the
database context still sits inside the server trust boundary.

An additive RESTRICTIVE SELECT policy ANDs this check with existing row scope.
It adds no write grants/policies and does not replace M1 helpers or merged 0420/0480.
An owner-only installer follows 0420's late-binding pattern: bind immediately when
fixed_deposit exists, otherwise the existing M2 views binder runs after all migrations.
No table/DTO/business-rule shape changes or ownership shifts; M1/M5 review the policy
through the handoff. Existing read-only REPEATABLE READ service remains unchanged.

Plan: record approval/status and owner handoff → add 0421/binder → direct-runtime
negative tests and API scope transitions → clean disposable rebuild/full verification
→ three-layer review → docs and /remember save. No UI change, so no new /imprint or
browser layout pass is required. User controls staging, commits, push, PR and merge.
