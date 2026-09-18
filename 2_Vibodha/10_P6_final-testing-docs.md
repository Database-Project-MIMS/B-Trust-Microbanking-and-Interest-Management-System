# ⚫ Phase 6 — Tasks 01–03: Seed Validation, Master-Data Integrity & Final Docs
**Task IDs:** `P06-M02-T01`, `P06-M02-T02`, `P06-M02-T03` · **Branch:** `feat/p06-m02-final-testing-docs`
**Status:** TODO
**Depends on:** `P03-M05-T01` (seed set 4), Phase 2 (your own tables), all (for T03)
**Story Points:** ~2 + ~2 + ~2 = ~6 · **Layer:** Tests + Docs

---

## What This Task Is

No new schema. This phase closes out your slice: prove the seed data meets its minimum
counts, prove the master-data constraints you built across Phases 1–2 actually hold
under adversarial tests, and do a documentation consistency pass. This is the task that
makes the project demonstrable and gradeable.

---

## T01 — Seed Validation (AC-12)

Confirm every minimum count from `docs/06_seed-data-spec.md` that touches your tables is
actually met after M5's full seed run:

| Entity | Minimum required | Requirement |
|---|---|---|
| Branches | ≥ 3 | FR-ORG-01 |
| Agents | ≥ 5 | FR-ORG-01 |
| Customers | ≥ 15 | FR-CUS-05 |

Create `tests/db/seed-validation-org-customers.test.mjs`:
1. ✅ `SELECT COUNT(*) FROM branch` ≥ 3
2. ✅ `SELECT COUNT(*) FROM agent` ≥ 5
3. ✅ `SELECT COUNT(*) FROM customer` ≥ 15
4. ✅ Every active agent has exactly one active branch (trivially true by schema, but
   assert it anyway as a regression guard)
5. ✅ Every customer has exactly one active `customer_agent` row (re-assert
   `ux_customer_agent_one_active` holds across the full seeded dataset, not just a
   single test insert)

Run after `npm run seed` (or whatever M5's seed command ends up being):
```bash
npm run db:rebuild && npm run seed && npm test -- seed-validation
```

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
npm run seed
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

### Step 5 — Update Docs
- All of §T03 above
- Update task statuses in `docs/09_task-tracker.md` → `DONE` for T01, T02, T03
- Update `.agent/current-state.md`

---

## Acceptance Criteria
- [ ] Seed validation confirms ≥ 3 branches, ≥ 5 agents, ≥ 15 customers
- [ ] Every constraint from Phases 1–2 has an adversarial test proving it holds
- [ ] No `DELETE` succeeds against a referenced `branch`, `agent`, or `customer`
- [ ] All documentation listed in T03 is internally consistent with the merged
      migrations
- [ ] `npm run db:rebuild && npm run seed && npm test` all pass from empty
- [ ] All 18 of Member 2's rows in `docs/09_task-tracker.md` show `DONE`
