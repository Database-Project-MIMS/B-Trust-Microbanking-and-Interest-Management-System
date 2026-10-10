# Phase 06 — Integration, Testing & Deployment

**Scoped live audit corrections — 2026-10-10:** the user authorized a new branch,
fixes for the audit findings, and editing other members' files. ADR-0031 records the
report/withdrawal/statement/plan navigation, period labels and nonce CSP corrections.
Original ownership remains unchanged. Local verification and a disposable production
preview precede deployment; this does not approve general phase entry or financial
posting on the live database. [Handoff](../../.agent/handoffs/p06-live-audit-fixes.md).

**Current scoped local delivery — 2026-10-09:** ADR-0026 authorizes M2 T03 and
necessary owner contributions, not general phase entry. T01/T02 are merged through
PR #88/#90. Security/FD/report/operations repairs are local REVIEW deliveries.
[docs/20](../20_final-local-closeout.md) records current evidence and unresolved savings,
transfer, UI/deployment and acceptance scope. Live HTTPS stays pending by user instruction.
Earlier scoped-start sections below are historical; their publication states are superseded.


**Status:** TODO · **Tasks:** 13 · **Effort:** 40 points · **Est.** ~1 week

**M2 T02 scoped start (2026-10-09):** Vibodha instructed implementation and
explicitly confirmed the blueprint in
[ADR-0025](../../.agent/decisions/ADR-0025-master-data-integrity.md).
Phase 2 dependencies are DONE. 100 database/16 API cases implement the master-data
stress pass; focused 309 tests, clean rebuild/checksums/typecheck/lint pass.
Full 1062 tests /98 suites (including security) pass with zero failures,
cancellations or skips; 51-migration rebuild/checksums pass. T02 is REVIEW
pending user publication/review. Local commits are authorized; no push, PR
creation or merge. General entry/T03 remain separate.
[Evidence and review](../../.agent/handoffs/p06-m02-master-data-integrity.md).

**Scoped early work (2026-10-08):** The user's direct request started M1's
security tasks only; it does not satisfy Phase 5 exit or approve general Phase 6
entry. T04 is in progress with local configuration checks, but no live HTTPS
deployment target or full green integration suite. T01/T02 still depend on
Phase 5 completion.

## Entry criteria

- [ ] Phase 5 exit criteria met
- [ ] All features implemented; remaining work is verification and delivery

**Scoped exception (2026-10-08):** Vibodha authorized only P06-M02-T01's early
seed-validation work ([ADR-0024](../../.agent/decisions/ADR-0024-seed-validation.md)).
The M5 transaction dependency is DONE. On 2026-10-09 Vibodha instructed completion
of the reported seed blockers, authorizing the necessary M5/M4 contributions.
Strict global AC-12 now passes on `p06-m02-seed-validation`: twelve funded FDs,
three completed nonempty cycles, thirty payouts and all seven roles/profile links.
T01 is implemented locally, REVIEW awaiting user publication. General entry and
T02 is separately authorized in ADR-0025 above; T03 remains separate. Vibodha additionally authorized repairs to the reported
full-suite failures in other members' code. The current branch full865 tests and
latest-dev overlay full940 tests all pass, with zero cancellations/skips; focused
seed/date proof is186 tests. These results do not certify general Phase 6 exit.
[Evidence and handoff](../../.agent/handoffs/p06-m02-seed-validation.md).

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
