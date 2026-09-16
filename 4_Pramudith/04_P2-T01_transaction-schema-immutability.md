# 🟢 Phase 2 — Task 01: Transaction Schema & Immutability Trigger
**Task ID:** `P02-M04-T01` · **Branch:** `feat/p02-m04-transaction-schema`
**Migration:** `0260_p02_m04_transaction.sql` · **Status:** TODO
**Depends on:** `P01-M04-T02` (`transaction_channel`), `P02-M03-T01` (M3's `account`)
**Story Points:** ~5 · **Layer:** Database only

---

## What This Task Is

The ledger table — created now, in Phase 2, specifically so M3's account-opening
routine can post an initial deposit. The full posting/withdrawal/reversal routines are
Phase 3 work; this task is the **table plus its immutability guarantee** only. Every
gap this table needs to resolve (G-02, G-04, G-05, G-07, G-14) is Phase 3's job to
finish — build the table shape now with those future columns in mind, but only
implement the constraints that are approved and unblocked as of Phase 2 (agent/branch
attribution is explicitly M2's Phase 3 task; idempotency and balance_after land in your
own Phase 3 tasks). Don't pre-empt another phase's approval gate.

---

## Table to Create

### `transaction`
The ledger. Immutable once posted (FR-TXN-02, BR-16).

| Column | Type | Constraints |
|---|---|---|
| `transaction_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `account_id` | `uuid` | **FK → account, NOT NULL** |
| `initiated_by_user_id` | `uuid` | **FK → app_user, NOT NULL** |
| `channel_id` | `uuid` | **FK → transaction_channel, NOT NULL** |
| `reference_number` | `varchar(50)` | NOT NULL — **`UNIQUE` added in Phase 3, T01 (G-05/OQ-08)** |
| `transaction_type` | `varchar(50)` | NOT NULL, `CHECK (transaction_type IN ('DEPOSIT','WITHDRAWAL','INTEREST_CREDIT','REVERSAL'))` (FR-TXN-01) |
| `amount` | `numeric(15,2)` | NOT NULL, `CHECK (amount > 0)` — always positive, direction comes from the type |
| `transaction_date` | `timestamptz` | NOT NULL DEFAULT `now()` — business timestamp |
| `narration` | `varchar(255)` | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` — system insert time |

- **DELETE rule:** never — `RESTRICT` everywhere, and the trigger below rejects
  `UPDATE`/`DELETE` outright, which is stronger than `RESTRICT` alone.
- **Indexes:** `(account_id, transaction_date DESC)` for statement queries.
- **Columns deliberately deferred to Phase 3** (do not add them in this migration —
  they need approval gates this task doesn't have yet): `agent_id`, `branch_id` (G-07,
  M2's task), `idempotency_key` (G-04), `balance_after` (G-14), `status` +
  reversal link (G-02). Leave a comment in the migration file naming each deferred
  column and its gap so nobody re-derives the plan differently in Phase 3.

### `trg_financial_transaction_immutable`

```sql
CREATE OR REPLACE FUNCTION trg_fn_financial_transaction_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'TRANSACTION_IMMUTABLE: posted transactions cannot be updated or deleted'
        USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_financial_transaction_immutable
    BEFORE UPDATE OR DELETE ON transaction
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_financial_transaction_immutable();
```

This is deliberately unconditional at this stage — no application role should ever be
able to modify a posted row. If Phase 3's reversal design needs a narrow, explicit
exception (it shouldn't — reversals are new rows, never edits to the original), that is
a decision for Phase 3, not something to soften here.

**Also revoke `UPDATE`/`DELETE` at the role level**, not just via the trigger — check
with M1 whether `database/roles/` already restricts the app role's grants; if not, flag
it as a note for their Phase 1/6 security tasks. The trigger is the primary defence;
the missing grant is defence in depth.

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P02-M03-T01" docs/09_task-tracker.md
```

### Step 2 — Write the Migration
Create file: `database/migrations/0260_p02_m04_transaction.sql` with the table and
trigger above, and a comment block naming every deferred column and its gap number.

### Step 3 — Write SQL Tests
Create file: `tests/db/transaction-immutability.test.mjs`

1. ✅ A transaction row can be inserted with valid FKs and `amount > 0`
2. ✅ `amount <= 0` is rejected by the CHECK constraint
3. ✅ Invalid `transaction_type` is rejected
4. ✅ **`UPDATE` on any column of an existing transaction row is rejected** by the
   trigger, with a clear error, not a generic constraint violation
5. ✅ **`DELETE` on an existing transaction row is rejected** by the trigger
6. ✅ Inserting with a non-existent `account_id`/`channel_id`/`initiated_by_user_id` is
   rejected (`23503`)
7. ✅ Deleting a `transaction_channel` referenced by a transaction is rejected (`23503`)

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` — `transaction` table, noting which Part B
  columns are still pending (G-02, G-04, G-05, G-07, G-14) and which phase will add each
- Update `docs/16_database-routines-views-indexes.md` — add
  `trg_financial_transaction_immutable`
- Update task status in `docs/09_task-tracker.md` → `DONE`
- **Write a handoff in `.agent/handoffs/`** — tell M3 the exact column list so
  `sp_open_savings_account`'s optional initial deposit insert matches exactly, and tell
  M2 that `agent_id`/`branch_id` land as their Phase 3 task against this table (a
  shared-file heads-up per AGENTS.md §13)

---

## Acceptance Criteria
- [ ] Migration applies to a clean DB without errors
- [ ] `UPDATE` and `DELETE` on a posted `transaction` row are both rejected by the
      trigger, with distinct test coverage for each
- [ ] `amount > 0` and `transaction_type` CHECK constraints hold
- [ ] Deferred Phase 3 columns are explicitly documented as deferred, not silently
      missing
- [ ] Handoffs written for M2 (Phase 3 column additions) and M3 (initial-deposit insert
      shape)
- [ ] `npm run db:rebuild` succeeds from empty
