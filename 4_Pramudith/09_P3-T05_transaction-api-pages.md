# 🟡 Phase 3 — Task 05: Transaction APIs
**Task ID:** `P03-M04-T05` · **Branch:** `feat/p03-m04-transaction-apis`
**Status:** TODO
**Depends on:** T04 (`sp_reverse_transaction`), **I-1** (M1 RBAC)
**Story Points:** ~8 · **Layer:** Backend only

> ⚡ **UI COMPLETE** — Deposit, withdrawal, receipt, statement and reversal screens have
> been pre-built in `app/dashboard/**`. Your job is to implement the **service layer and
> API routes** that back those screens. Do not rebuild any UI component.

---

## What This Task Is

Wrap all four Phase 3 routines in services and route handlers. This is where
`Idempotency-Key` becomes an HTTP contract, not just a database column.

---

## APIs

### `POST /api/transactions/deposits`
- **Roles** `AGENT`, `BRANCH_MANAGER`
- **Headers** `Idempotency-Key` (**required**) — `400 MISSING_IDEMPOTENCY_KEY` if absent
- **Body** `{ accountId, amount, channelId, narration? }`
- **Validation** `amount > 0`, exactly 2 decimals; account active; within business hours
  (pre-check for a fast response; the routine re-checks for real)
- **SQL routine** `CALL sp_post_deposit($1..$n)`
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter,
  postedAt } }` — **or `200`** with the identical body if the `Idempotency-Key` was
  already used (FR-DEP-04) — status code distinguishes "created" from "replayed"
- **Errors** `409 ACCOUNT_NOT_ACTIVE`, `409 OUTSIDE_BUSINESS_HOURS`

### `POST /api/transactions/withdrawals`
- **Roles** `AGENT`, `BRANCH_MANAGER`; `CUSTOMER` if an authorised holder
- **Headers** `Idempotency-Key` (**required**)
- **Body** `{ accountId, amount, channelId, onBehalfOfCustomerId?, narration? }`
- **Validation** requester is an authorised holder; account active; business hours;
  single and daily limits (pre-checks only — the routine is the real gate)
- **SQL routine** `CALL sp_post_withdrawal(...)`
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter } }`
- **Errors** map every routine error code to its documented HTTP status: `409
  INSUFFICIENT_FUNDS`, `409 BELOW_MINIMUM_BALANCE`, `409 MANDATE_NOT_SATISFIED`, `409
  LIMIT_EXCEEDED`, `409 ACCOUNT_NOT_ACTIVE`
- **Note** A rejection writes an audit event and **no ledger row** (FR-WD-05) — this is
  already true at the routine level; the route handler just needs to not paper over it

### `POST /api/transactions/{id}/reverse`
- **Roles** **`BRANCH_MANAGER` only** (§4.8)
- **Body** `{ reason }` (required, non-empty)
- **Routine** `CALL sp_reverse_transaction(...)`
- **Errors** `409 ALREADY_REVERSED`, `403` for non-managers

| `GET /api/accounts/{id}/transactions` | Statement with running balance (FR-TXN-04) | `AGENT`, `BRANCH_MANAGER`, `AUDITOR`, `CUSTOMER` (own) | Paginated; uses `(account_id, transaction_date DESC)` index |
| `GET /api/transactions/{id}` | Single transaction + reversal status | as above | |

### Idempotency middleware

Build a small, reusable piece (`lib/api/idempotency.ts` or similar, inside your owned
scope, not `lib/db`) that:
1. Requires the `Idempotency-Key` header on `POST /api/transactions/deposits` and
   `POST /api/transactions/withdrawals`
2. Passes it straight through to the routine as `p_idempotency_key` — **the database is
   the source of truth for deduplication**, this middleware only enforces the header's
   presence and format, it does not itself cache or dedupe in memory (that would violate
   NFR-REL-03's "survives a restart" requirement)

---

## How to Implement

### Step 1 — Confirm Dependencies
```bash
grep -n "P03-M04-T04\|P01-M01-T03\|P03-M01-T02" docs/09_task-tracker.md
```

### Step 2 — Backend
1. `services/transaction-service.ts`: `postDeposit()`, `postWithdrawal()`,
   `reverseTransaction()`, `getStatement()`, `getTransaction()`
2. Route handlers: parse → `requireRole([...])` → `branchScope()`/holder-authority check
   → validate → call service → map routine error codes precisely → respond
3. CSRF verification on all four state-changing routes

### Step 3 — Write Tests
- `tests/api/deposits.test.mjs`: missing `Idempotency-Key` → `400`; valid deposit →
  `201`; repeated key → `200` with identical body; inactive account → `409`
- `tests/api/withdrawals.test.mjs`: each of the five rejection reasons maps to the
  correct error code; non-holder `CUSTOMER` → `403`; successful withdrawal → `201`
- `tests/api/reversals.test.mjs`: non-manager → `403`; valid reversal → success;
  double-reversal → `409 ALREADY_REVERSED`

### Step 4 — Run & Verify
```bash
npm run typecheck && npm test
```

### Step 5 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches every endpoint exactly, including status
  codes for idempotent replay
- Update task status in `docs/09_task-tracker.md` → `DONE`
- Write a handoff in `.agent/handoffs/` — M3's balance panel (Phase 3, their T03) and
  M5's FD opening (Phase 4) will both call these endpoints

---

## Acceptance Criteria
- [ ] `Idempotency-Key` is required and enforced at the database level, not an
      in-memory cache
- [ ] Every routine error code maps to its documented HTTP status — no generic `500`
      for a business rejection
- [ ] Reversal is `BRANCH_MANAGER`-only, enforced on the server
- [ ] `GET /api/accounts/{id}/transactions` returns a correct running balance and paginates
- [ ] `npm run typecheck && npm test` pass
