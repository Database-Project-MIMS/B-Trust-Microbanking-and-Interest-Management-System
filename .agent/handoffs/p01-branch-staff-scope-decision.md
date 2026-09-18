# Branch-staff scope decision for I-1

**From:** Member 2 · **To:** Member 1 and integration lead · **Date/session:** 2026-09-18
**Status:** published

## Approved contract

`AGENT` and `BRANCH_MANAGER` are separate roles that share the `agent` branch-staff
profile. Obtain their branch using `app_user.user_id = agent.agent_id` and
`agent.branch_id`. Do not query or add an undocumented `app_user.branch_id`.

## Implemented in the merged I-1 work

- Session resolution joins `agent` and returns `agent.branch_id`.
- Branch-scoped `AGENT` and `BRANCH_MANAGER` users without a profile fail closed.
- Authorization tests import and exercise the production RBAC and CSRF helpers.

## Remaining Member 1 follow-ups

1. Return `branchId` in the login user DTO.
2. Add explicit malformed-CSRF-token rejection and coverage.
3. Add a request/service integration test proving cross-branch URL or body tampering is
   rejected by the SQL scope.
4. Refresh `.agent/handoffs/i1-rbac-helpers.md` with the branch-profile contract.
5. Ensure manager creation atomically creates both the `app_user` row with role
   `BRANCH_MANAGER` and the required `agent` profile when that workflow is implemented.

## Member 2 consumption

P01-M02-T03 treats the resolved branch ID as authoritative, applies it inside SQL, and
restricts agent-management targets to users whose joined role is `AGENT`. It does not
create or promote branch managers.
