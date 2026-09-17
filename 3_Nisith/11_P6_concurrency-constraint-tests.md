# ⚫ Phase 6 — Tasks 01–02: Concurrency & Constraint Test Suites
**Task IDs:** `P06-M03-T01`, `P06-M03-T02` · **Branch:** `feat/p06-m03-concurrency-constraint-tests`
**Status:** TODO
**Depends on:** `P03-M04-T03` (M4's `sp_post_withdrawal`, for T01); Phase 4 complete (for T02)
**Story Points:** ~3 + ~2 = ~5 · **Layer:** Tests only

---

## What This Task Is

No new schema, no new routines. This is the phase that proves the concurrency safety
and constraint completeness of the account/plan/mandate machinery you built across
Phases 1–4 actually holds under adversarial and parallel conditions — the difference
between "the happy path works" and "this is safe to grade as a database systems
project."

---

## T01 — Concurrency Tests: Parallel Withdrawals Cannot Overspend (AC-06)

This is the single most important test in your slice. `FOR UPDATE` row locking (M4's
`sp_post_withdrawal`, which calls your `fn_check_plan_minimum` and
`fn_check_joint_mandate` from Phase 3) must serialise concurrent withdrawals on the same
account so the balance never goes negative, even under a race.

Create `tests/db/concurrent-withdrawals.test.mjs`:

1. **Setup:** open an account with balance exactly 1,000 (Adult plan, min balance 1,000
   — pick numbers so a double-spend is only possible if locking fails)
2. **Fire two withdrawal requests concurrently** for 600 each (`Promise.all` against two
   separate pool connections / separate `withTransaction` calls hitting
   `sp_post_withdrawal` at the same time)
3. **Assert:** exactly one succeeds and one fails with `409 INSUFFICIENT_FUNDS` or
   `409 BELOW_MINIMUM_BALANCE` — never both succeeding (which would leave `-200`) and
   never both failing
4. **Assert:** `account.current_balance` after both requests resolve equals
   `1000 - <the one that succeeded>` exactly — no float drift, no lost update
5. **Repeat** with 3–5 concurrent requests against a tighter balance to increase
   contention pressure
6. **Assert:** the ledger (`SUM` of `transaction.amount` for `WITHDRAWAL` rows) agrees
   exactly with the balance change — no ledger/balance divergence under concurrency
   (this is the D-1 reconciliation check, exercised specifically under a race rather
   than sequentially)

If any of this fails, the bug is almost certainly a missing or misplaced `FOR UPDATE` in
`sp_post_withdrawal` — that's M4's routine, but it's your test that proves or disproves
it, since NFR-SAFE-01/AC-06 sit on your slice's `account.current_balance` invariant.
Report findings to M4 rather than patching their routine yourself unless a handoff
authorises it.

---

## T02 — Constraint Test Suite: Every `CHECK`, `UNIQUE` and FK You Own

This is a completeness pass, not new coverage of a single feature — enumerate **every**
constraint across your four tables and prove each one individually rejects a violation.
Some of these already exist as tests from earlier phases; this task's job is to collect
them into one comprehensive suite and fill any gaps.

Create `tests/db/constraint-suite-plans-accounts.test.mjs`:

**`savings_plan`**
- Duplicate `plan_name` → `23505`
- `max_age_years < min_age_years` → CHECK violation
- `max_holders < min_holders` → CHECK violation
- `interest_rate` outside `[0,1]` → CHECK violation (if that CHECK exists — add it now
  if T01 in Phase 1 didn't include it)

**`account`**
- `current_balance < 0` → CHECK violation
- Duplicate `account_number` → `23505`
- FK violations on `plan_id`, `branch_id`, `opened_by_agent_id`
- Delete a referenced `account` → `23503` (once `transaction`/`account_holder` rows
  exist)

**`account_holder`**
- Duplicate `(account_id, customer_id)` → `23505`
- Invalid `holder_type` → CHECK violation
- FK violations on `account_id`, `customer_id`

**`joint_mandate`**
- Duplicate `account_id` → `23505` (one mandate per account)
- Invalid `mandate_type` → CHECK violation
- `trg_validate_joint_mandate`: 1-holder and 5-holder joint accounts both rejected
  (re-assert here even if covered in Phase 2, since this suite is the canonical
  reference a grader would run)

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P03-M04-T03" docs/09_task-tracker.md   # for T01
```

### Step 2 — Write T01
Use two separate `pg` client connections (not the same connection sequentially) so the
test genuinely exercises row locking rather than just calling the routine twice in
series. `Promise.all([withdrawal1, withdrawal2])` against two independent
`withTransaction`-wrapped calls.

### Step 3 — Write T02
Enumerate constraints from `docs/04_database-schema.md` and your own migrations —
cross-check nothing was missed by grepping your migration files for every `CHECK`,
`UNIQUE` and `REFERENCES`:
```bash
grep -n "CHECK\|UNIQUE\|REFERENCES" database/migrations/014*.sql database/migrations/024*.sql
```

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/12_testing-and-acceptance.md` — add the concurrency scenario and
  reference the constraint suite
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Concurrent withdrawal test proves exactly one of two racing withdrawals succeeds,
      never both, never neither, on a tight balance
- [ ] Ledger and balance agree exactly after a concurrent test run (no lost updates)
- [ ] Every `CHECK`, `UNIQUE` and FK across `savings_plan`, `account`, `account_holder`,
      `joint_mandate` has an explicit negative test
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm test` passes, including the concurrency suite, on a clean rebuild
