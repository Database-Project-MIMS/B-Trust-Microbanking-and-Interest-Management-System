# ⚫ Phase 6 — Tasks 01–03: Seed Validation, Master-Data Integrity & Final Docs
**Task IDs:** `P06-M02-T01`, `P06-M02-T02`, `P06-M02-T03` · **Current T01 branch:** `p06-m02-seed-validation`; T02/T03 use separate future branches
**Status:** T01 implemented locally, REVIEW (AC-12 passes; user publication pending); T02/T03 TODO
**Depends on:** `P03-M05-T01` (seed set 4), Phase 2 (your own tables), all (for T03)
**Story Points:** ~2 + ~2 + ~2 = ~6 · **Layer:** Tests + Docs

---

## What This Task Is

No new tables are required. Completion adds corrective routine migration 0620. This phase closes out your slice: prove the seed data meets its minimum
counts, prove the master-data constraints you built across Phases 1–2 actually hold
under adversarial tests, and do a documentation consistency pass. This is the task that
makes the project demonstrable and gradeable.

---

## T01 — Seed Validation (AC-12)

**Completed locally, 2026-10-09 (ADR-0024):** Vibodha authorized completion of
the reported seed blockers. Thirty-nine strict seed tests cover minimums, missing
evidence, current assignments, role/profile links, real funding, FD audits,
signed-ledger balances, payout formulas/control totals, duplicate FD/cycle credits,
CLI failure behavior and restoration of custom hours/limits. Seed checks own a
fresh disposable database, so other suites' fixtures cannot inflate counts.

The seed has three branches, six ordinary agents plus three managers, fifteen
customers, ten accounts/two valid joint mandates, twelve funded FDs, three
nonempty successful cycles/thirty payouts, 191 postings and fourteen users
covering seven roles. All global minima and financial invariants pass. Sum of
balances is `1582020.52`; payouts and run totals each sum to `66020.52`.
Reseeding preserves measured counts and exact totals. M5 stewardship remains.

Migration 0620 fixes shared-prefix interest reference collisions without editing
merged migrations. Opening balances are actual idempotent deposits; FD funding,
principal returns and interest use posting routines, with same-transaction FD
audit. Operational timestamps/UUIDs are routine-generated; exact totals and
fixed master/business dates are reproducible, not byte-identical posting history.
The specification records this distinction and actual data counts.

186 focused tests /15 suites, clean current46/latest51-migration rebuilds,
checksums, reseeding, typecheck and lint pass. After explicit authorization to
repair other members' integration failures, current full865/87 suites and
latest-dev full940/95 suites all pass, with zero failures/cancellations/skips.
The repairs include real session/RLS/role fixtures, SQL dates/overloads, audit
contracts and safe audit/interest request authorization/service boundaries.
T01 is REVIEW awaiting user publication; general Phase 6 gates remain separate.
No UI change; /imprint N/A.
[Evidence and review](../.agent/handoffs/p06-m02-seed-validation.md).

`npm run verify:seed-validation -- --global` proves the delivery inside a new
temporary PostgreSQL cluster. Add `--all-tests` for full integration diagnostics.
`npm run db:seed-validate` is strict and read-only; organization-only scope
explicitly disclaims global AC-12. `npm run db:seed-check` also reruns the seed
on the configured database and compares actual counts/exact totals. The loader
fails a missing ordered seed stage before writing. No developer DB is rebuilt
by the disposable harness. The user has now authorized grouped local commits;
push, PR creation and merge remain with the user.

T02/T03 remain separate future work.

## T02 — Master-Data Integrity Tests

Adversarial tests against every constraint you added in Phases 1–2. This is not new
coverage of new features — it's a stress pass on what already exists, written as if
someone is deliberately trying to violate the rules.

Create `tests/db/master-data-integrity.test.mjs`:
1. ✅ Cannot insert a `branch` with a duplicate `branch_code`
2. ✅ Cannot insert an `agent` with a duplicate `employee_no`, `nic_passport_no`, or
   `email`
3. ✅ Cannot insert an `agent` referencing a non-existent `branch_id`
4. ✅ Cannot insert a `customer` with a duplicate `nic_passport_no` or `email`
5. ✅ Cannot insert a second active `customer_agent` row for the same customer
   (`23505` on `ux_customer_agent_one_active`)
6. ✅ Cannot insert a `customer_document` with only one of `verified_by`/`verified_date`
   set
7. ✅ Cannot delete a `branch` referenced by an `agent` or `customer`
8. ✅ Cannot delete an `agent` referenced by `customer_agent`
9. ✅ Cannot delete a `customer` referenced by `customer_agent` or `customer_document`
10. ✅ Every deactivate path (`PATCH .../status = 'INACTIVE'`) leaves the row intact and
    queryable — confirm no soft-delete accidentally became a hard delete somewhere

## T03 — Final Documentation Pass

Read every doc your slice touches end-to-end and fix contradictions:

- `docs/04_database-schema.md` — `branch`, `agent`, `customer`, `customer_agent`,
  `customer_document` sections match the actual merged migrations exactly (column
  names, types, constraints)
- `docs/05_api-and-pages.md` — every endpoint you built is listed with the roles and
  error codes it actually returns
- `docs/07_business-rules.md` — FR-ORG-01…05 and FR-CUS-01…05 each have an
  "enforcement point" that names a real constraint, routine, or service function
- `docs/16_database-routines-views-indexes.md` — `ux_customer_agent_one_active`,
  `ux_customer_nic`, the trigram index, `vw_customer_fd_summary`,
  `vw_rpt01_agent_transactions`, and both `transaction` reporting indexes are all listed
- `docs/17_erd-gap-analysis.md` — G-07, G-10, G-20 (and any others you touched) are
  marked resolved with a link to the migration that resolved them
- `docs/09_task-tracker.md` — all 18 of your rows are `DONE`
- `.agent/current-state.md` — reflects that your slice is complete

---

## How to Implement

### Step 1 — Run the Full Seed and Test Suite
```bash
npm run db:rebuild
npm run db:seed
npm run db:verify
npm run typecheck
npm test
```

### Step 2 — Write T01 and T02 Test Files
As specified above. Run them against the fully seeded database, not an empty one — T01
specifically needs the seed data to exist.

### Step 3 — Documentation Pass (T03)
Go file by file through the list above. For each doc, diff what it says against
`git log --oneline -- database/migrations/012*.sql database/migrations/022*.sql
database/migrations/032*.sql database/migrations/042*.sql database/migrations/052*.sql`
(your reserved blocks) to confirm nothing drifted.

### Step 4 — Final Review
Run `/review` one last time across your whole slice, not just the last task, to catch
anything that fell through between phases.

### Step 5 — Update Docs (future combined closeout)
- All of §T03 above
- Update only completed, accepted task statuses. T01 is currently BLOCKED for global
  seed acceptance; T02/T03 remain TODO. Do not mark all three DONE together merely
  because organization seed checks pass.
- Update `.agent/current-state.md`

---

## Acceptance Criteria
- [ ] Seed validation confirms ≥ 3 branches, ≥ 5 agents, ≥ 15 customers
- [ ] Every constraint from Phases 1–2 has an adversarial test proving it holds
- [ ] No `DELETE` succeeds against a referenced `branch`, `agent`, or `customer`
- [ ] All documentation listed in T03 is internally consistent with the merged
      migrations
- [ ] `npm run db:rebuild && npm run db:seed && npm test` all pass from empty
- [ ] All 18 of Member 2's rows in `docs/09_task-tracker.md` show `DONE`
