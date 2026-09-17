# ⚫ Phase 6 — Tasks 01–02: Rollback/Idempotency Evidence & Posting Performance
**Task IDs:** `P06-M04-T01`, `P06-M04-T02` · **Branch:** `feat/p06-m04-rollback-idempotency-performance`
**Status:** TODO
**Depends on:** `P03-M04-T05` (transaction APIs, for T01); T01 for T02
**Story Points:** ~3 + ~2 = ~5 · **Layer:** Tests only

---

## What This Task Is

No new schema, no new routines. This phase closes out your slice by proving — with
reproducible, adversarial tests — the two guarantees your entire Phase 3 work rests on:
partial failures never leave partial state, and posting stays fast under load. This is
also the evidence a grader would want to see for the "ACID under concurrency" claim the
whole project's Phase 3 entry criteria are built around.

---

## T01 — Rollback & Idempotency Tests; Partial-Failure Evidence

Create `tests/db/rollback-idempotency-evidence.test.mjs`:

1. **Forced mid-transaction failure in `sp_post_deposit`**: inject a failure after the
   ledger `INSERT` but before the `account` `UPDATE` (e.g. a test-only trigger that
   raises on the second statement, or a deliberately invalid follow-up statement in a
   test harness wrapper). Assert:
   - Neither the `transaction` row nor the `account` balance change survives
   - `SELECT COUNT(*) FROM transaction WHERE account_id = $1` is unchanged from before
     the attempt
2. **Same test, for `sp_post_withdrawal`** — force a failure between the limit check and
   the ledger insert; assert zero partial effect.
3. **Same test, for `sp_reverse_transaction`** — force a failure between the
   compensating-entry insert and the `transaction_reversal` insert; assert **neither**
   survives (not just that the reversal link is missing, but that the compensating
   `transaction` row itself was rolled back too — a half-reversal, where a compensating
   entry exists with no link, would be worse than no reversal at all).
4. **Idempotency replay across a real HTTP round-trip** (not just the DB routine): use
   `tests/api/` to POST the same deposit twice with the same `Idempotency-Key`,
   including once where the **first** request's connection is killed mid-flight (if your
   test infrastructure can simulate that) to prove the second request still returns the
   correct original result rather than double-crediting.
5. **Collect the evidence**: this task's deliverable includes a short written summary
   (in the PR description, and optionally `docs/12_testing-and-acceptance.md`) of what
   was tested and what it proved — "partial-failure evidence" is meant to be readable by
   someone who didn't write the tests, not just a passing test suite.

## T02 — Posting Performance Under Load (NFR-PERF-02, NFR-PERF-04)

Check `docs/02_srs-summary.md` or wherever NFR-PERF-02/04 are quantified (response time
and throughput targets) before writing this — don't invent a target number.

Create `tests/db/posting-performance.test.mjs` (or a dedicated load-test script if the
project has a pattern for that — check `scripts/` first):

1. **Sequential baseline**: time N deposits against N different accounts, sequentially.
   Record p50/p95 latency.
2. **Concurrent load**: fire M concurrent deposit/withdrawal requests against a mix of
   accounts (some contended, some not) and record latency distribution and any errors —
   distinguish expected business rejections (e.g. `LIMIT_EXCEEDED`) from unexpected
   failures.
3. **Assert** the measured p95 (or whatever NFR-PERF-02/04 specifies) is within the
   documented target. If it isn't, that's a real finding to report, not something to
   quietly loosen the test threshold for.
4. Record the numbers in the PR description or `docs/12_testing-and-acceptance.md` —
   this is evidence for the grade, not just a pass/fail gate.

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P03-M04-T05" docs/09_task-tracker.md
```

### Step 2 — Write T01
Build the fault-injection harness first (a small helper that can force a statement to
fail inside a routine call for testing purposes only — never used outside `tests/`).

### Step 3 — Write T02
Check for existing load-testing conventions:
```bash
ls scripts/ | grep -i load
grep -n "NFR-PERF" docs/02_srs-summary.md docs/07_business-rules.md 2>/dev/null
```

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/12_testing-and-acceptance.md` — record the rollback/idempotency evidence
  summary and the performance numbers
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Forced mid-transaction failures in all three posting routines (deposit,
      withdrawal, reversal) leave zero partial state, each with an explicit test
- [ ] Idempotency replay is proven at the HTTP layer, not only at the database routine
      layer
- [ ] Posting performance is measured against the documented NFR target, not an
      invented one, and the numbers are recorded
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm test` passes, including the fault-injection and performance suites
