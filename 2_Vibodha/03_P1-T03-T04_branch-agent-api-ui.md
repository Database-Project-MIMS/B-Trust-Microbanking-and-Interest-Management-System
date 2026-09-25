# 🔵 Phase 1 — Tasks 03–04: Branch & Agent APIs
**Task IDs:** `P01-M02-T03`, `P01-M02-T04` · **Branch:** `feat/p01-m02-branch-agent-api`
**Status:** READY
**Depends on:** T02 (`agent`), **I-1** (`requireRole()`/`branchScope()` from M1)
**Story Points:** ~4 + ~4 = ~8 · **Layer:** Backend only

> ⚡ **UI COMPLETE** — Admin pages for branches and agents have been pre-built and live in
> `app/dashboard/**`. Your job is to implement the **API routes and service layer only**.
> Do not rebuild any UI component.

---

## What This Task Is

Expose `branch` and `agent` as CRUD-ish APIs (create, list, update/deactivate — **never
delete**) and wire them to services. This is the first task in your slice that needs M1's
**I-1** integration point (`requireRole()`, `branchScope()`). Confirm M1 has published
the handoff before you start the backend half.

Approved branch-staff model: `AGENT` and `BRANCH_MANAGER` are distinct roles but both have
an `agent` profile. M1's session/RBAC layer obtains their scope from `agent.branch_id` and
must deny a branch-scoped login with no profile. These organisation endpoints manage
ordinary `AGENT` users; they do not create or promote branch managers.

---

## T03 — Branch & Agent APIs

| Method & path | Purpose | Roles | Notes |
|---|---|---|---|
| `GET /api/branches` | List branches | `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER`, `AUDITOR` | `BRANCH_MANAGER` sees only their own branch — apply via `branchScope()` in the `WHERE` clause |
| `POST /api/branches` | Create branch | `ADMIN` | `409 DUPLICATE_BRANCH_CODE` on `23505` |
| `PATCH /api/branches/{id}` | Update / deactivate | `ADMIN` | Never deletes (FR-ORG-05) — sets `status = 'INACTIVE'` |
| `GET /api/agents` | List ordinary agents | `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER` | Scoped by branch; filter joined role to `AGENT` so managers are not listed as ordinary agents |
| `POST /api/agents` | Create ordinary agent + linked user | `ADMIN`, `BRANCH_MANAGER` | **One transaction**: `app_user` with server-assigned `AGENT` role + `agent` + audit; never accept a role from the body |
| `PATCH /api/agents/{id}` | Update / deactivate / transfer ordinary agent | `ADMIN`, `BRANCH_MANAGER` | Restrict target to `AGENT`; transfer updates `branch_id`; history stays attributable via `transaction.branch_id` (Phase 3) |

### Service layer

Create `services/branch-service.ts` and `services/agent-service.ts`. Route handlers
(`app/api/branches/route.ts`, `app/api/branches/[id]/route.ts`, `app/api/agents/route.ts`,
`app/api/agents/[id]/route.ts`) call these — **no SQL in the route handler**.

`createAgent()` must run inside `withTransaction()` (from `lib/db`, M4's I-2):
1. Insert into `app_user` (username, password hash issued by M1's `lib/auth`, or a
   temporary-password flow if that's not ready yet — check with M1)
2. Insert into `agent` with the new `user_id` as `agent_id`
3. Insert an `audit_log` row (actor, entity, before/after — `NULL` before since this is a
   create)
4. Roll back all three on any failure

```ts
// services/agent-service.ts
/** Creates the login and agent record in one transaction. */
export async function createAgent(input: CreateAgentInput, actor: AuthContext) {
  return withTransaction(async (client) => {
    const user = await insertAppUser(client, input);
    const agent = await insertAgent(client, { ...input, agentId: user.userId });
    await writeAudit(client, { actor, entityType: 'agent', entityId: agent.agentId, before: null, after: agent });
    return agent;
  });
}
```

Error mapping:
- `23505` on `employee_no` → `409 DUPLICATE_EMPLOYEE_NO`
- `23505` on `nic_passport_no` → `409 DUPLICATE_IDENTITY`
- `23505` on `email` → `409 DUPLICATE_EMAIL`
- `23505` on `branch_code` → `409 DUPLICATE_BRANCH_CODE`

### Deactivate, not delete

`PATCH` is the only mutation path after create. There is no `DELETE /api/branches/{id}`
or `DELETE /api/agents/{id}` route — if a record is referenced by history, a real delete
attempt must fail with `409` at the database (`RESTRICT`) even if somehow bypassed above
the service layer.

---

## How to Implement

### Step 1 — Confirm I-1 Is Published
```bash
ls .agent/handoffs/ | grep -i rbac
grep -n "P01-M01-T03" docs/09_task-tracker.md
```
If `requireRole()`/`branchScope()` signatures aren't published yet, work on the service
layer (pure logic, testable without the route) and wait before wiring the route handler.

### Step 2 — Backend
1. `services/branch-service.ts`: `listBranches(scope)`, `createBranch(input, actor)`,
   `updateBranch(id, input, actor)`
2. `services/agent-service.ts`: `listAgents(scope)`, `createAgent(input, actor)`,
   `updateAgent(id, input, actor)`
3. Route handlers: parse → `requireRole([...])` → `branchScope()` → validate → call
   service → map errors → respond `{ data }` / `{ error: { code, message } }`
4. All state-changing routes verify the CSRF token (I-1)

### Step 3 — Write Tests
- `tests/api/branches.test.mjs`: create → 201; duplicate code → 409; non-`ADMIN` create
  → 403; `BRANCH_MANAGER` list only sees their own branch
- `tests/api/agents.test.mjs`: create is atomic (kill the transaction mid-way in a test
  double if feasible, or assert no orphan `app_user` row on a forced failure); duplicate
  employee_no/nic/email → 409; deactivate does not delete the row
- `tests/e2e/branches-agents.test.mjs`: create a branch, create an agent, deactivate the
  agent, confirm it no longer appears in the default (active-only) list but still exists

### Step 4 — Update Docs
- `docs/05_api-and-pages.md` — confirm the endpoint table matches what you built
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] All six endpoints implemented, authorized on the server (role **and** branch scope)
- [ ] `createAgent` is atomic — a forced failure after the `app_user` insert leaves no
      orphan row
- [ ] No `DELETE` route exists for branches or agents
- [ ] Deleting a referenced record at the DB level still returns `409`, not `500`
- [ ] `BRANCH_MANAGER` cannot see or act on another branch's rows (enforced in SQL)
- [ ] `npm run typecheck && npm test` pass
