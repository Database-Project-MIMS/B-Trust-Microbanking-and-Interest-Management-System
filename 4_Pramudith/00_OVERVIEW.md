# 📋 Member 4 (Pramudith) — Complete Work Overview

**Name:** Jayawardhana P.S.P · **Index:** 240298H
**Domain Slice:** Transactions & Ledger Integrity
**Total Story Points:** ~62 · **Total Tasks:** 17 across 6 phases

Full slice description and copy-paste session prompt: `../docs/member-prompts/member-4.md`
Running session log (updated via `/remember save`): `../.agent/members/member-4.md`

**Your Phase 3 work is the heart of the project's grade.** Two things must be right:
**lock before you decide** (`FOR UPDATE`, then re-read balance and status inside the
transaction), and **idempotency as a database constraint**, not an in-memory cache.

---

## 🗺️ Work Order Summary

| # | File | Phase | Task IDs | What You Build | Points |
|---|---|---|---|---|---|
| 01 | [Harden lib/db](01_P1-T01_lib-db-hardening.md) | P1 | T01 | Retry, SQLSTATE mapping, redacted logging — **publishes I-2** | ~5 |
| 02 | [Transaction Channel Schema](02_P1-T02_transaction-channel-schema.md) | P1 | T02 | `transaction_channel` + seed (`BRANCH_COUNTER`, `ONLINE`, `SYSTEM`) | ~2 |
| 03 | [Migration Runner Tests & Health Endpoint](03_P1-T03-T04_migration-runner-health-page.md) | P1 | T03–T04 | Rebuild proof, edited-migration rejection, `/admin/health` API | ~5 |
| 04 | [Transaction Schema & Immutability](04_P2-T01_transaction-schema-immutability.md) | P2 | T01 | `transaction` ledger table + `trg_financial_transaction_immutable` | ~5 |
| 05 | [Reference & Idempotency Indexes](05_P3-T01_reference-idempotency-indexes.md) | P3 | T01 | `reference_number UNIQUE`, `idempotency_key` partial unique index (G-04, G-05) | ~4 |
| 06 | [sp_post_deposit](06_P3-T02_sp-post-deposit.md) | P3 | T02 | Lock, insert ledger, update balance, `balance_after`, audit | ~6 |
| 07 | [sp_post_withdrawal](07_P3-T03_sp-post-withdrawal.md) | P3 | T03 | Lock, re-validate status/mandate/limits/minimum, debit — consumes **I-4** | ~7 |
| 08 | [Transaction Reversal](08_P3-T04_transaction-reversal.md) | P3 | T04 | `transaction_reversal` + `sp_reverse_transaction`, reversible once (G-02) | ~5 |
| 09 | [Transaction APIs](09_P3-T05_transaction-api-pages.md) | P3 | T05 | `Idempotency-Key` header handling; deposit, withdrawal, reversal APIs | ~8 |
| 10 | [Interest Credit Posting](10_P4_interest-credit-posting.md) | P4 | T01–T02 | `INTEREST_CREDIT` through the ledger routine — publishes **I-5**; statement display | ~6 |
| 11 | [RPT-05 Customer Activity Report](11_P5-T01-T02_rpt05-report.md) | P5 | T01–T02 | Customer activity view, API, CSV | ~6 |
| 12 | [Reconciliation](12_P5-T03_reconciliation.md) | P5 | T03 | Ledger vs `current_balance` vs `balance_after` (D-1, D-2) | ~4 |
| 13 | [Rollback, Idempotency & Performance Tests](13_P6_rollback-idempotency-performance-tests.md) | P6 | T01–T02 | Partial-failure evidence; posting performance under load | ~5 |

---

## 📊 Effort by Phase

```
Phase 1  ████████████████████████       12 pts (4 tasks — lib/db, channel, migrations, health)
Phase 2  ██████████                      5 pts (1 task — transaction ledger + immutability)
Phase 3  ██████████████████████████████████████████████████████  30 pts (5 tasks — HEAVIEST, the grade)
Phase 4  ████████████                    6 pts (2 tasks — interest posting)
Phase 5  ██████████████████████          10 pts (3 tasks — RPT-05 + reconciliation)
Phase 6  ██████████                      5 pts (2 tasks — rollback/idempotency/perf tests)
                                       ─────
                                       68 pts total (approx.)
```

---

## 🔗 Integration Points

### You Publish

| ID | What | Phase | Who Waits |
|---|---|---|---|
| **I-2** | `withTransaction()` and SQLSTATE → domain error mapping | P1 | **ALL members** — everyone's service layer depends on this |
| **I-5** | `INTEREST_CREDIT` posting through the ledger routine | P4 | M5 — the interest run posts through your routine, never writes `transaction` directly |

### You Consume

| ID | What | From | Phase |
|---|---|---|---|
| **I-1** | `requireRole()`, `branchScope()`, CSRF verify | M1 | P3 |
| **I-3** | `account.status` / `current_balance` read contract | M3 | P3 |
| **I-4** | `fn_check_plan_minimum` + joint-mandate validation | M3 | P3 |
| **I-7** | Report framework: filters, scope, CSV, access audit | M1 | P5 |

You are the **producer of I-2**, published in Phase 1 — every other member's service
layer is blocked on it. Prioritise it accordingly; it is not "just infrastructure," it
is the first cross-member dependency in the whole project.

---

## 🗄️ Database Objects You Own

### Tables (3)
`transaction`, `transaction_channel`, `transaction_reversal`

### Routines
- `sp_post_deposit` — lock, insert ledger, update balance, audit
- `sp_post_withdrawal` — lock, re-validate, debit
- `sp_reverse_transaction` — compensating entry, linked, balance updated
- `fn_next_transaction_reference` — reference-number generation
- `fn_account_running_balance` — window-function balance view (G-14 companion)
- `trg_financial_transaction_immutable` — rejects `UPDATE`/`DELETE` on posted rows

### Indexes
- `transaction.reference_number` — `UNIQUE NOT NULL` (G-05, resolves OQ-08)
- `ux_transaction_idempotency` — partial unique on `idempotency_key WHERE idempotency_key
  IS NOT NULL` (G-04)
- `(account_id, transaction_date DESC)` — statement queries
- `transaction_reversal.original_transaction_id` — `UNIQUE` (enforces "reversible once",
  G-02)

### Report Views (1)
- `vw_rpt05_customer_activity` — deposits, withdrawals, interest, net by customer

### Reconciliation Views
- Assert `account.current_balance = SUM(signed ledger amounts)` (D-1)
- Assert `transaction.balance_after` agrees with the window-function running balance (D-2)

---

## 📁 Files You Own

| Path | Shared? |
|---|---|
| `lib/db/**` | **Yes — you approve all changes to it** |
| `app/transactions/**` | No |
| `app/reports/customer-activity/**` | No |
| `app/reconciliation/**` | No |

---

## 🔥 Phase 3 Is Your Critical Phase

**Phase 3 is by far your heaviest phase (30 pts — 5 tasks) and the most important phase
in the entire project's grade.** The four things that must be right:

1. **Lock before deciding.** `SELECT ... FOR UPDATE` on the account row, then re-read
   status and balance **inside** the transaction. Validation done before the lock is
   stale — this is the single most common way this kind of routine fails under load.
2. **Atomicity.** Ledger row, balance update and audit event commit or roll back
   together. No partial state is ever observable (FR-DEP-05).
3. **Idempotency as a constraint.** A partial unique index on `idempotency_key` — not an
   in-memory cache — so it survives a process restart.
4. **Immutability.** A trigger rejects `UPDATE`/`DELETE` on `transaction`, and the app
   role has no `DELETE` grant. Corrections are compensating entries, never edits.

Suggested approach:
1. ✅ Do T01 (reference + idempotency indexes) first — resolves OQ-08/G-05, unblocks
   everything else
2. ✅ Do T02 (`sp_post_deposit`) — the simpler of the two posting routines, gets the
   lock-then-decide pattern right before withdrawal's extra validation layers
3. ⚡ Do T03 (`sp_post_withdrawal`) — needs M3's I-4 (`fn_check_plan_minimum`, mandate
   check); the hardest routine in your slice
4. ✅ Do T04 (`sp_reverse_transaction`) — compensating entries, not edits
5. ✅ Do T05 (APIs + pages) last, once all four routines exist

---

## 📝 Key Rules to Remember

1. **No ORM** — handwritten parameterized SQL only (`$1, $2, ...`)
2. **`lib/db` is the only module permitted to import `pg`** — and you own it; any
   change another member proposes there needs your approval
3. **Lock before you decide** — `SELECT ... FOR UPDATE`, then re-validate status and
   balance inside the transaction, never before the lock
4. **Idempotency is a partial unique index**, not a cache — `ux_transaction_idempotency
   WHERE idempotency_key IS NOT NULL`; catch `23505` and return the original result
5. **Transactions are immutable** — a trigger rejects `UPDATE`/`DELETE`; corrections are
   compensating entries via `sp_reverse_transaction`, never an edit
6. **Money is `NUMERIC(15,2)`** — string across the API, never a JavaScript float
7. **A rejected withdrawal writes an audit event and no ledger row** (BR-L1, FR-WD-05)
8. **No account-to-account transfers** — `reference_number` is `UNIQUE NOT NULL`, one
   row per transaction, per the OQ-08/G-05 resolution
9. **Migration numbers 0160–0179 (P1), 0260–0279 (P2), 0360–0379 (P3), 0460–0479 (P4),
   0560–0579 (P5), 0660–0679 (P6)** — never collide with others
10. **Never edit a merged migration** — write a new one
11. **You are a producer for I-2 and I-5** — write the handoff before the consuming
    member's task can move to `READY`
