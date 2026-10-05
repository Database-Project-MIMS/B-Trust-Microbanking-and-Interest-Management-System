# ADR-0006: Branch managers share the agent branch-staff profile

**Date:** 2026-09-18 · **Status:** Accepted

## Decision

`AGENT` and `BRANCH_MANAGER` remain distinct authorization roles, but both use the
existing `agent` table as their branch-staff profile. Their current branch is
`agent.branch_id`, reached through `app_user.user_id = agent.agent_id`. `role.role_name`
controls permissions.

`app_user` does not gain a `branch_id` column. Session resolution must join `agent` and
must deny an `AGENT` or `BRANCH_MANAGER` whose required profile or branch is missing.
Only explicitly bank-wide roles may receive a `null` branch scope.

Agent-management endpoints operate on ordinary `AGENT` users. When an endpoint or report
means frontline agents rather than all branch staff, it joins `role` and filters
`role_name = 'AGENT'`.

## Why

Both roles are bank employees with the same identity, employment and current-branch data,
while their permissions differ. Reusing the existing subtype avoids an undocumented
`app_user.branch_id`, gives branch managers a defined scope source, and avoids storing the
same branch twice for ordinary agents.

## What it rules out

- Reading the nonexistent `app_user.branch_id`
- Treating a missing branch profile as bank-wide access
- Trusting a role name or branch ID supplied by a request body
- Listing branch managers as ordinary agents without an explicit role filter

## Consequences

- Manager creation must create the `app_user` row with role `BRANCH_MANAGER` and its
  `agent` profile atomically.
- M1 owns session/RBAC resolution and manager identity creation; M2's organisation APIs
  consume the published scope and manage ordinary agents.
- Customer authorization remains account/holder based and does not use this profile.
