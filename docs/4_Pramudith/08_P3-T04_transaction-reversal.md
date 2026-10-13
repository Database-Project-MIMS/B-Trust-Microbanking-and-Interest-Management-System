# 🟡 Phase 3 — Task 04: Transaction Reversal — `transaction_reversal` + `sp_reverse_transaction`
**Task ID:** `P03-M04-T04` · **Branch:** `feat/p03-m04-transaction-reversal`
**Migration:** `0363_p03_m04_transaction_reversal.sql` · **Status:** TODO
**Depends on:** T03 (`sp_post_withdrawal`)
**Story Points:** ~5 · **Layer:** Database only

---

## What This Task Is

Corrections are compensating entries, **never edits** — `trg_financial_transaction_
immutable` (Phase 2) already makes editing impossible at the database level; this task
is the mechanism for the correct alternative: a new, linked, opposite-direction row.
"Reversible only once" (G-02, DB-CON-04) is enforced by a `UNIQUE` constraint, not a
procedural check.

---

## Table to Create

### `transaction_reversal`

| Column | Type | Constraints |
|---|---|---|
| `reversal_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `original_transaction_id` | `uuid` | **FK → transaction, UNIQUE, NOT NULL** — the `UNIQUE` is what makes a transaction reversible exactly once (G-02, DB-CON-04) |
| `reversal_transaction_id` | `uuid` | **FK → transaction, UNIQUE, NOT NULL** |
| `reason` | `varchar(255)` | NOT NULL |
| `reversed_by_user_id` | `uuid` | **FK → app_user, NOT NULL** |
| `reversed_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

Also add to `transaction` (deferred from Phase 2, now unblocked):

```sql
ALTER TABLE transaction
    ADD COLUMN status varchar(20) NOT NULL DEFAULT 'POSTED'
        CHECK (status IN ('POSTED', 'REVERSED'));
```

## Routine to Create

### `sp_reverse_transaction(p_original_transaction_id uuid, p_reason varchar, p_reversed_by_user_id uuid)`

**Roles note:** this routine is called only by `BRANCH_MANAGER` per §4.8 — that role
check happens in the service layer (M1's Phase 3 task, `P03-M01-T02`, manager-only
authorization), not in this procedure. The procedure itself trusts the caller has
already authorized the request; it enforces the *data* invariants only.

Steps, inside one transaction:

1. **Lock the original transaction's account:** `SELECT current_balance, status FROM
   account WHERE account_id = (SELECT account_id FROM transaction WHERE transaction_id =
   p_original_transaction_id) FOR UPDATE`.
2. **Confirm the original exists and is `POSTED`, not already `REVERSED`** — if
   `status = 'REVERSED'`, raise `ALREADY_REVERSED`. (The `UNIQUE` constraint on
   `transaction_reversal.original_transaction_id` is the backstop that makes this
   impossible to bypass even under a race; this explicit check gives a clean error
   instead of a raw `23505`.)
3. **Compute the compensating amount and direction** — a `DEPOSIT` reversal is booked as
   a debit-direction compensating entry (reduces balance); a `WITHDRAWAL` reversal is
   booked as a credit-direction compensating entry (restores balance). The compensating
   row's `transaction_type` is `REVERSAL` with `amount` equal to the original's amount
   (always positive per the `transaction` table's convention) — direction must be
   inferrable from the linkage, not from a sign on `amount`.
4. **Insert the compensating `transaction` row** (`transaction_type = 'REVERSAL'`),
   `balance_after` computed from the locked current balance.
5. **Update the original row's `status` to `'REVERSED'`** — this is the **one** place in
   the entire codebase where `transaction.status` is allowed to change after posting;
   confirm the immutability trigger from Phase 2 has an explicit, narrow carve-out for
   this single column via this single routine only (e.g. a `SECURITY DEFINER` path or a
   session-level flag the trigger checks) — **do not weaken the trigger generally**.
   If you can't cleanly carve out this one case, the simpler and safer alternative is to
   **not** update the original row at all and instead derive "is this transaction
   reversed" entirely from the presence of a `transaction_reversal` row — prefer that
   approach unless there's a strong reason to duplicate the state as a column.
6. **Insert `transaction_reversal`** linking original → compensating.
7. **Update `account.current_balance`.**
8. **Insert `audit_log`.**

---

## How to Implement

### Step 1 — Decide the `status` Column Question First
Before writing the migration, settle: does `transaction.status` exist and get updated by
this routine (requiring a trigger carve-out), or is "reversed" purely derived from a
`transaction_reversal` row's existence (simpler, no trigger exception needed)? Run
`/architect` if it's not obvious — this is exactly the kind of load-bearing decision
worth pinning down before code. Document the choice in the migration's header comment.

### Step 2 — Write the Migration
`database/migrations/0363_p03_m04_transaction_reversal.sql`.

### Step 3 — Write SQL Tests
Create file: `tests/db/sp-reverse-transaction.test.mjs`

1. ✅ Reversing a valid `POSTED` deposit creates a compensating `REVERSAL` row, links it,
   and restores the balance to its pre-deposit value
2. ✅ Reversing a valid `POSTED` withdrawal restores the withdrawn amount
3. ✅ **The original transaction row is never modified** — every column except (if you
   chose the status-column approach) `status` is byte-identical before and after
4. ✅ Reversing an already-reversed transaction → `ALREADY_REVERSED`, no second
   compensating row
5. ✅ A second `transaction_reversal` row for the same `original_transaction_id` is
   rejected by the `UNIQUE` constraint even if the procedure-level check were somehow
   bypassed (test the constraint directly with a raw `INSERT`, not just through the
   procedure)
6. ✅ Reversing a non-existent transaction ID → clean error, not a null-pointer-style
   failure

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` — add `transaction_reversal`, confirm `status`
  column decision
- Update `docs/16_database-routines-views-indexes.md` — add `sp_reverse_transaction`
- Update `docs/17_erd-gap-analysis.md` — mark G-02 implemented
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] A transaction can be reversed exactly once; a second attempt is rejected both by
      the procedure and by the raw `UNIQUE` constraint
- [ ] The original transaction row's financial columns are never modified
- [ ] Reversal restores the account balance to the correct pre-original-transaction
      state
- [ ] `ALREADY_REVERSED` is a clean, specific error, not a generic constraint violation
      surfaced to the caller
- [ ] `npm run db:rebuild` succeeds from empty
