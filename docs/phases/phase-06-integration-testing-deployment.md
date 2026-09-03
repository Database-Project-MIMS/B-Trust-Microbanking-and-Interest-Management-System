# Phase 06 — Integration, Testing & Deployment

**Status:** TODO · **Tasks:** 13 · **Effort:** 40 points · **Est.** ~1 week

## Entry criteria

- [ ] Phase 5 exit criteria met
- [ ] All features implemented; remaining work is verification and delivery

## Tasks by member

| Member | Focus |
|---|---|
| **M1** | SQL-injection suite across every endpoint; full role × route authorization matrix; RLS verification bypassing the app; deployment secrets, HTTPS, security headers |
| **M2** | Seed validation against all minimum counts (AC-12); master-data integrity tests; final documentation pass |
| **M3** | Concurrency tests; complete constraint test suite |
| **M4** | Rollback and idempotency tests; partial-failure evidence; posting performance |
| **M5** | Interest re-run idempotency; report totals reconciliation; **backup, restore, migration rollback**; demonstration script |

## Verification checklist

### Database
- [ ] `db:rebuild` from empty succeeds every time
- [ ] Every table has a primary key; no floating-point money column exists
- [ ] Every `CHECK`, `UNIQUE` and FK has a test that proves it fires
- [ ] `EXPLAIN ANALYZE` evidence collected for all five reports
- [ ] Scale probe: 1,000,000 ledger rows, index plans still hold (NFR-PERF-04)

### Concurrency and integrity
- [ ] Parallel withdrawals cannot overspend (AC-06)
- [ ] Parallel deposits do not lose updates
- [ ] Interest re-run creates nothing new (AC-08)
- [ ] Every rollback scenario leaves **no** partial state
- [ ] Reconciliation is clean across the whole dataset

### Security
- [ ] SQL-injection payloads on every endpoint are neutralised **by parameter binding**
- [ ] Every role × route combination behaves per `15_security-and-rbac.md`
- [ ] RLS holds when connecting directly as `mims_app`, bypassing the application
- [ ] No secret in client-reachable code; no `NEXT_PUBLIC_` credential
- [ ] Error responses leak no SQL, stack trace or credential

### Delivery
- [ ] CI gate green: lint, typecheck, clean-database migration, all tests
- [ ] Backup taken, restored to a clean environment, verified (AC-13)
- [ ] Migration rollback exercised and documented
- [ ] Deployed to the approved environment over HTTPS
- [ ] All 14 acceptance criteria demonstrated
- [ ] Documentation final; no document contradicts another
- [ ] Remaining TBDs and known limitations recorded

## Demonstration preparation

Rehearse the ten-minute script in `../13_system-operation-guide.md`. Every step should
demonstrate a **database** guarantee: a constraint firing, a trigger rejecting, a lock
serialising, an index being used. A demonstration of the UI alone misses the point of the
project.

Reset with `npm run db:rebuild` immediately before demonstrating so totals are
deterministic.

## Final validation

- [ ] No ORM, Supabase, Firebase or InsForge anywhere in the dependency tree (AC-02)
- [ ] PostgreSQL used consistently
- [ ] Every member has substantial database, backend **and** frontend contributions
- [ ] All five reports present and reconciling
- [ ] Seed meets every minimum count
- [ ] ACID and concurrency evidenced by tests, not asserted in prose
- [ ] Roles and security covered and tested
- [ ] No uploaded requirement silently dropped — check against `02_srs-summary.md`
- [ ] ERD differences documented and their resolutions recorded as ADRs

## Risks

| Risk | Mitigation |
|---|---|
| Testing deferred to this phase | Every earlier phase has its own test exit criteria; Phase 6 verifies, it does not start testing |
| Deployment fails at the last minute | Deploy to staging from Phase 4 onward, not for the first time here |
| Documentation drifted from the code | Docs are updated in the same PR as the change (AGENTS.md §14); M2 does a final consistency pass |
