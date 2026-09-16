# 🟡 Phase 3 — Task 01: Reference Number & Idempotency Indexes
**Task ID:** `P03-M04-T01` · **Branch:** `feat/p03-m04-reference-idempotency-indexes`
**Migration:** `0360_p03_m04_transaction_reference_idempotency.sql` · **Status:** TODO
(gated on **OQ-08**)
**Depends on:** **OQ-08** resolved (G-05)
**Story Points:** ~4 · **Layer:** Database only

---

## ⚠️ Blocking Gate — Read First

`P03-M04-T01` **cannot start** until **OQ-08** is resolved. Check
`.agent/open-questions.md` and `docs/17_erd-gap-analysis.md` (**G-05**) in full before
writing this migration.

**The conflict:** the ERD's *Assumption 4* says account-to-account transfers create two
`transaction` rows sharing one `reference_number` (a DEBIT and a CREDIT). But BR-10 and
FR-DEP-02 require every reference number to be **unique**, and FR-TXN-01 lists only four
transaction types (`DEPOSIT`, `WITHDRAWAL`, `INTEREST_CREDIT`, `REVERSAL`) — no
`TRANSFER`. The recommended resolution (from the gap analysis) is: **drop
account-to-account transfers from Release 1.0** and make `reference_number` `UNIQUE NOT
NULL`. Confirm this with the team/lecturer and record it as an ADR before proceeding —
do not guess.

---

## What to Add (assuming the recommended resolution)

### `transaction.reference_number` → `UNIQUE NOT NULL`

```sql
ALTER TABLE transaction
    ALTER COLUMN reference_number SET NOT NULL,
    ADD CONSTRAINT ux_transaction_reference UNIQUE (reference_number);
```

### `transaction.idempotency_key` (G-04)

```sql
ALTER TABLE transaction
    ADD COLUMN idempotency_key varchar(80);

CREATE UNIQUE INDEX ux_transaction_idempotency
    ON transaction (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
```

Nullable, because seeded and system-generated interest credits (Phase 4) don't carry a
client-supplied key — only client-initiated deposits and withdrawals do.

**Why this can't be `reference_number`:** `reference_number` is generated **by the
system** when the transaction is created, so a retried client request produces a *new*
reference and a second credit. Only a client-supplied token, echoed back on retry, can
deduplicate a retry. This is the mechanism BR-I1/FR-DEP-04 require: "a repeated request
with the same idempotency key shall not create a duplicate credit."

### `fn_next_transaction_reference()`

```sql
CREATE OR REPLACE FUNCTION fn_next_transaction_reference()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq bigint;
BEGIN
    v_seq := nextval('transaction_reference_seq');
    RETURN 'TXN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_seq::text, 8, '0');
END;
$$;
```

---

## How to Implement

### Step 1 — Resolve OQ-08
1. Read the OQ-08 entry in `.agent/open-questions.md` and G-05 in
   `docs/17_erd-gap-analysis.md` in full.
2. Run `/architect` — a schema-shape decision with two incompatible requirements is
   exactly what it's for.
3. Write the decision to `.agent/decisions/` as an ADR. Update
   `.agent/open-questions.md` to mark OQ-08 resolved.

### Step 2 — Write the Migration
Create file: `database/migrations/0360_p03_m04_transaction_reference_idempotency.sql`
with the sequence, function, `UNIQUE` constraint and partial index above.

### Step 3 — Write SQL Tests
Create file: `tests/db/transaction-reference-idempotency.test.mjs`

1. ✅ `fn_next_transaction_reference()` produces a unique value on each call
2. ✅ Duplicate `reference_number` is rejected (`23505`) — this is the direct resolution
   of G-05
3. ✅ NULL `reference_number` is rejected (`NOT NULL`)
4. ✅ Two transactions with the **same** `idempotency_key` are rejected on the second
   insert (`23505` on `ux_transaction_idempotency`)
5. ✅ Two transactions with `idempotency_key IS NULL` (e.g. two interest credits) can
   both be inserted — the partial index only constrains non-null keys
6. ✅ Two transactions with **different** `idempotency_key` values both succeed

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` — `transaction.reference_number` now `UNIQUE NOT
  NULL`, `idempotency_key` added (G-04, G-05 resolved)
- Update `docs/17_erd-gap-analysis.md` — mark G-04 and G-05 implemented, link the ADR
- Update `.agent/open-questions.md` — OQ-08 resolved
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] OQ-08 resolved and recorded as an ADR before the migration is written
- [ ] Migration applies to a clean DB without errors
- [ ] `reference_number` is `UNIQUE NOT NULL`
- [ ] `idempotency_key` partial unique index rejects a repeated key, allows repeated
      NULLs
- [ ] `fn_next_transaction_reference()` never produces a duplicate under test
- [ ] `npm run db:rebuild` succeeds from empty
