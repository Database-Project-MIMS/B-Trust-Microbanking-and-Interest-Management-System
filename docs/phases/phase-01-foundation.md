# Phase 01 — Foundation, Master Data & Security

**Status:** READY · **Tasks:** 18 · **Effort:** 43 points · **Est.** ~1 week

## Goal

Everything the rest of the project stands on: authentication, roles, branches, agents,
products, the data-access layer and the application shell. Nothing financial moves yet.

## Entry criteria

- [x] Phase 0 approved
- [x] Migration `0000` applies to a clean database
- [x] Every member has read `AGENTS.md` and their member prompt

## Tasks by member

| Member | Tasks | Focus |
|---|---|---|
| **M1** | T01–T05 | `role`, `app_user`, `user_session`, `login_attempt`, `system_parameter`, `business_calendar`, `audit_log`; authentication; **RBAC (I-1)**; sign-in page and app shell |
| **M2** | T01–T04 | `branch`, `agent`; branch/agent APIs and admin pages |
| **M3** | T01–T03 | `savings_plan` with eligibility data; `fn_check_plan_eligibility`; plans page |
| **M4** | T01–T04 | Harden `lib/db` **(I-2)**; `transaction_channel`; migration runner tests; health page |
| **M5** | T01–T03 | `fd_plan`; FD product admin; **seed framework (I-8)** |

Full detail in `../09_task-tracker.md`.

## Parallelism

M1's RBAC is on everyone's critical path, so it ships first. To avoid four people waiting:
**every member starts with their database work**, which has no dependency on
authentication. Wire up APIs and UI after M1 publishes the `requireRole()` /
`branchScope()` signatures in a handoff (I-1).

Suggested order within each member's week: migration → SQL tests → service → route handler
→ page.

## Integration points published this phase

| ID | From | To | Contract |
|---|---|---|---|
| **I-1** | M1 | all | `requireUser()`, `requireRole(...)`, `branchScope()` — signatures published in a handoff before implementation |
| **I-2** | M4 | all | `withTransaction()` and SQLSTATE → domain error mapping |
| **I-8** | M5 | all | Seed file layout, fixed-UUID scheme, load order |

## Exit criteria

- [ ] A user can sign in, get a session, and be signed out server-side
- [ ] Role and branch scope are enforced **on the server** for every implemented route
- [ ] Failed sign-ins are throttled and reveal nothing about username existence
- [ ] 3 branches and 6 agents can be created, listed and deactivated
- [ ] Five savings plans and three FD products exist with **exactly** the specified rates and minimums
- [ ] Business hours and withdrawal limits are readable as data, not constants
- [ ] `npm run db:rebuild` succeeds from empty; `npm run db:verify` passes
- [ ] Editing an already-applied migration is rejected by the runner
- [ ] The app shell renders with role-aware navigation
- [ ] `/imprint` run — `ui-registry.md` has its first component entries
- [ ] All Phase 1 tests pass; every task `DONE`

## Risks

| Risk | Mitigation |
|---|---|
| Four members blocked behind M1's auth | Database work starts immediately; I-1 published as a handoff before implementation |
| Five different-looking UIs | M1 builds the shell and the first primitives; everyone runs `/imprint` |
| Rates entered as `12` instead of `0.1200` | `interest_rate` domain enforces `0 ≤ value ≤ 1`; seed test asserts exact values |
