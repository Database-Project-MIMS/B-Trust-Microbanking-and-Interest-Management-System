# 🔵 Phase 1 — Tasks 03–04: Migration Runner Tests & Database Health Page
**Task IDs:** `P01-M04-T03`, `P01-M04-T04` · **Branch:** `feat/p01-m04-migration-runner-health`
**Status:** READY
**Depends on:** T02 (`transaction_channel`, for a rebuild target); T04 additionally
depends on T01 (pool metrics) and **I-1** (M1 RBAC)
**Story Points:** ~3 + ~2 = ~5 · **Layer:** Backend + Frontend

---

## What This Task Is

Two small Phase 1 closeout tasks: harden `scripts/migrate.mjs` and prove the
clean-rebuild guarantee the whole team depends on, then expose the pool health you built
in T01 as an authenticated admin page.

---

## T03 — Migration Runner Tests & Rebuild Proof

Harden `scripts/migrate.mjs`:
- **Rebuild from empty succeeds** — running every migration file in order against a
  fresh database produces no errors
- **Editing an applied migration is rejected** — if a migration file's content hash (or
  the file itself) changes after it's recorded in `schema_migration`, the runner must
  refuse to proceed, not silently re-apply or skip it. This directly enforces AGENTS.md
  §8: "A merged migration is immutable."
- `npm run db:verify` — a lightweight check that `schema_migration` row count matches
  the number of migration files present, and that no migration was skipped

Create `tests/db/migration-runner.test.mjs`:
1. ✅ `npm run db:rebuild` against an empty database succeeds and applies every
   migration in order
2. ✅ Re-running the same migration twice does not duplicate its `schema_migration` row
   or its effects (idempotent runner, not idempotent migration content — the migration
   itself only runs once)
3. ✅ Modifying a byte of an already-applied migration file and re-running the migrator
   causes it to **fail loudly**, not silently continue
4. ✅ `npm run db:verify` fails if a migration file exists on disk with no corresponding
   `schema_migration` row (missed application) or vice versa

## T04 — Database Health Page

### `GET /api/health`
Extend the existing (Phase 0 scaffold) health endpoint with pool stats:
- **Roles** authenticated (any role) for basic health; consider whether pool internals
  should be `ADMIN`/`CENTRAL_OPS`-only — err toward restricting detail, not toward
  exposing infrastructure internals to every role
- **Success** `200 { data: { status: 'ok', db: { connected: true, poolTotal, poolIdle,
  poolWaiting }, migrationsApplied } }`
- **Errors** an **unauthenticated** request must get no internal detail at all — not
  even "db: unreachable" with a stack trace. Return a minimal `503` with no internals.

`app/admin/health/page.tsx`:
- Simple dashboard: connection status, pool stats, last migration applied, uptime
- Gated to privileged roles via `requireRole()` server-side — hiding the nav link is not
  access control (FR-AUTH-02)

---

## How to Implement

### Step 1 — T03: Harden the Migration Runner
Review `scripts/migrate.mjs` from the Phase 0 scaffold. Add the content-hash check and
the failure-mode tests above.

### Step 2 — T03: Write & Run Tests
```bash
npm run db:rebuild
npm run db:verify
npm test -- migration-runner
```

### Step 3 — T04: Backend
Extend `app/api/health/route.ts` using the pool metrics exposed by T01
(`lib/db/pool.ts`).

### Step 4 — T04: Frontend
`app/admin/health/page.tsx` — Server Component, role-gated.

### Step 5 — Write Tests
- `tests/api/health.test.mjs`: unauthenticated request → `503` with no internal detail;
  authenticated privileged request → full pool stats; non-privileged request → status
  only, no pool internals (if you decided to restrict detail — document the decision
  either way)

### Step 6 — Run & Verify
```bash
npm run typecheck && npm test
```

### Step 7 — Update Docs
- Update `docs/05_api-and-pages.md` — confirm `/api/health` response shape
- Update `docs/13_system-operation-guide.md` if it references health checks or
  deployment readiness
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] `npm run db:rebuild` succeeds from empty and is proven by a test, not just
      manually run once
- [ ] Editing an already-applied migration file causes the runner to fail loudly
- [ ] `npm run db:verify` passes and catches a missed/duplicated migration
- [ ] Unauthenticated health requests reveal no internal detail
- [ ] Health page shows real pool stats to authorised roles
- [ ] `npm run typecheck && npm test` pass
