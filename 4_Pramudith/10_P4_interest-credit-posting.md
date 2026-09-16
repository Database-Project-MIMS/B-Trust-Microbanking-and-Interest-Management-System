# 🟠 Phase 4 — Tasks 01–02: Interest Credit Posting — Publishes I-5
**Task IDs:** `P04-M04-T01`, `P04-M04-T02` · **Branch:** `feat/p04-m04-interest-credit-posting`
**Status:** TODO
**Depends on:** `P03-M04-T02` (`sp_post_deposit`)
**Story Points:** ~4 + ~2 = ~6 · **Layer:** Database + Backend + Frontend — **you are
the producer of I-5**

---

## What This Task Is

A dedicated posting path for `INTEREST_CREDIT` rows, built on the same primitives as
`sp_post_deposit` but callable by M5's interest-run routine (`sp_run_interest_cycle`,
their Phase 4 task) — **M5 must never write to `transaction` directly**, only through
this routine. This is the mechanism BR-14 means by "credited... as a separate
transaction" and the reason G-12's savings-interest question and I-5 both exist.

---

## T01 — `sp_post_interest_credit(...)` — Publishes I-5

```
p_account_id uuid,
p_amount numeric(15,2),
p_fd_id uuid,              -- for interest_payout linkage; NULL if this is ever used for
                            -- non-FD interest (only if OQ-04/G-12 resolves that way)
p_cycle_date date,
OUT p_transaction_id uuid,
OUT p_reference_number varchar,
OUT p_balance_after numeric(15,2)
```

Steps, inside one transaction, called **once per FD distribution** (never batched — each
distribution is its own transaction per FR-INT-04, so a single failure doesn't roll back
already-completed ones):

1. **Lock the account:** `SELECT current_balance FROM account WHERE account_id = $1 FOR
   UPDATE`.
2. **No status/eligibility re-check here** — unlike a deposit, an interest credit is not
   requested by an external actor; it is a scheduled system action against an account
   that M5's routine already validated is eligible. If the account was closed between
   FD-selection and posting, that's a genuine exception M5's routine should catch and
   count (per FR-INT-05's `exception_count`), not something this routine silently works
   around.
3. **Generate the reference**, insert the ledger row: `transaction_type =
   'INTEREST_CREDIT'`, `channel_id` = the `SYSTEM` channel (seeded in Phase 1, T02),
   `initiated_by_user_id` = NULL or a system user (check the G-22 resolution — `audit_log`
   already handles nullable `user_id` for system actions; `transaction.initiated_by_user_id`
   is `NOT NULL` per your Phase 2 schema, so confirm whether a dedicated `SYSTEM` app_user
   row is the intended pattern, and use it consistently).
4. **Update `account.current_balance`.**
5. **Insert `audit_log`** with `actor_type = 'SYSTEM'`.
6. Return the transaction's values — M5's routine uses `p_transaction_id` to populate
   `interest_payout.transaction_id` (their own table, `UNIQUE` constraint enforcing one
   ledger row per distribution).

**Contract for M5 (write this into the handoff verbatim):**
- Call `sp_post_interest_credit` exactly once per FD per cycle, inside the **same**
  transaction as their `interest_payout` insert (so both succeed or both roll back
  together for that one FD).
- Never construct a `transaction` INSERT directly — every `INTEREST_CREDIT` row must
  come through this routine, so the immutability trigger, audit trail and balance update
  all stay in one place.
- This routine does not itself check `interest_payout`'s `UNIQUE(fd_id, cycle_date)` —
  that idempotency guarantee is M5's table's job (BR-F2); this routine simply posts
  whatever it's told to post, once, per call.

## T02 — Interest Credits Visible in the Statement

The statement (`GET /api/accounts/{id}/transactions`, built in Phase 3, T05) must
already show `INTEREST_CREDIT` rows correctly once they exist — `transaction_type` was
always part of the schema. This task is mostly **verification and a small display
refinement**:
- Confirm the statement UI labels `INTEREST_CREDIT` rows distinctly from
  `DEPOSIT`/`WITHDRAWAL` (different icon/color per whatever pattern `ui-registry.md`
  establishes)
- Confirm the running balance column is correct across a mixed sequence of deposits,
  withdrawals and interest credits — write a test proving `balance_after` values are
  monotonically consistent (each row's `balance_after` equals the previous row's
  `balance_after` plus/minus that row's signed amount)

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P03-M04-T02" docs/09_task-tracker.md
```

### Step 2 — Write the Migration
`database/migrations/0460_p04_m04_sp_post_interest_credit.sql`.

### Step 3 — Write SQL Tests
Create file: `tests/db/sp-post-interest-credit.test.mjs`

1. ✅ A valid interest credit posts, `balance_after` correct
2. ✅ `channel_id` is always the `SYSTEM` channel for these rows
3. ✅ `audit_log.actor_type = 'SYSTEM'` for these rows
4. ✅ The transaction is immutable exactly like any other row (re-confirm the Phase 2
   trigger applies uniformly — no special-casing that weakens it)
5. ✅ Calling this routine for the same `p_fd_id`/`p_cycle_date` twice produces **two**
   ledger rows (this routine itself does not dedupe — confirm the design intent that
   `interest_payout`'s constraint is the actual guard, and document that clearly so it
   isn't mistaken for a bug)

### Step 4 — Frontend (T02)
Verify/adjust the statement page from Phase 3.

### Step 5 — Write Tests (T02)
`tests/e2e/statement-interest-display.test.mjs`: seed a mixed transaction history
including an interest credit, view the statement, confirm labelling and running-balance
correctness.

### Step 6 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 7 — Update Docs & Publish the Handoff
- Update `docs/16_database-routines-views-indexes.md` — add `sp_post_interest_credit`
- Update `docs/07_business-rules.md` — confirm BR-14/BR-15 enforcement point
- **Write `.agent/handoffs/i-5-sp-post-interest-credit.md`** with the exact signature and
  the "never write `transaction` directly" contract — this unblocks M5's
  `sp_run_interest_cycle` (`P04-M05-T04`)
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] `sp_post_interest_credit` posts through the same immutability/audit machinery as
      every other transaction type
- [ ] Handoff published before M5's interest-run task can safely start
- [ ] Statement correctly labels and orders `INTEREST_CREDIT` rows alongside
      deposits/withdrawals
- [ ] Running balance stays consistent across a mixed transaction history
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
