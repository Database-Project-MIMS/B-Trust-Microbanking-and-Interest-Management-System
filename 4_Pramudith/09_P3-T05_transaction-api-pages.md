# 🟡 Phase 3 — Task 05: Transaction APIs & Pages
**Task ID:** `P03-M04-T05` · **Branch:** `feat/p03-m04-transaction-api-pages`
**Status:** TODO
**Depends on:** T04 (`sp_reverse_transaction`), **I-1** (M1 RBAC)
**Story Points:** ~8 · **Layer:** Backend + Frontend

---

## What This Task Is

Wrap all four Phase 3 routines in services and route handlers, then build deposit,
withdrawal, receipt, statement and reversal pages. This is where `Idempotency-Key`
becomes an HTTP contract, not just a database column.

---

## APIs

### `POST /api/transactions/deposits`
- **Roles** `AGENT`, `BRANCH_MANAGER`
- **Headers** `Idempotency-Key` (**required**) — `400 MISSING_IDEMPOTENCY_KEY` if absent
- **Body** `{ accountId, amount, channelId, narration? }`
- **Validation** `amount > 0`, exactly 2 decimals; account active; within business hours
  (pre-check for a fast UX response; the routine re-checks for real)
- **SQL routine** `CALL sp_post_deposit($1..$n)`
- **Success** `201 { data: { transactionId, referenceNumber, amount, balanceAfter,
  postedAt } }` — **or `200`** with the identical body if the `Idempotency-Key` was
  already used (FR-DEP-04) — status code distinguishes "created" from "replayed"
- **Errors** `409 ACCOUNT_NOT_ACTIVE`, `409 OUTSIDE_BUSINESS_HOURS`
- **Page** `/transactions/deposit`

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
- **Page** `/transactions/withdraw`

### `POST /api/transactions/{id}/reverse`
- **Roles** **`BRANCH_MANAGER` only** (§4.8) — check with M1's `P03-M01-T02` manager-only
  authorization helper before writing your own role check
- **Body** `{ reason }` (required, non-empty)
- **Routine** `CALL sp_reverse_transaction(...)`
- **Errors** `409 ALREADY_REVERSED`, `403` for non-managers
- **Page** `/transactions/{id}` — reversal action embedded in the transaction detail view

| `GET /api/accounts/{id}/transactions` | Statement with running balance (FR-TXN-04) | `AGENT`, `BRANCH_MANAGER`, `AUDITOR`, `CUSTOMER` (own) | Paginated; uses `(account_id, transaction_date DESC)` index |
| `GET /api/transactions/{id}` | Single transaction + reversal link | as above | |

### Idempotency middleware

Build a small, reusable piece (`lib/api/idempotency.ts` or similar, inside your owned
`app/transactions/**` scope, not `lib/db`) that:
1. Requires the `Idempotency-Key` header on `POST /api/transactions/deposits` and
   `POST /api/transactions/withdrawals`
2. Passes it straight through to the routine as `p_idempotency_key` — **the database is
   the source of truth for deduplication**, this middleware only enforces the header's
   presence and format, it does not itself cache or dedupe in memory (that would violate
   NFR-REL-03's "survives a restart" requirement)

---

## Pages

`app/transactions/deposit/page.tsx`, `app/transactions/withdraw/page.tsx`,
`app/transactions/[id]/page.tsx` (receipt/detail + reversal), and the statement view
(likely `app/accounts/[id]/statement/page.tsx` or embedded in M3's account detail page —
confirm the exact route with M3 since account pages are their owned files; you may only
be adding a statement **tab/section**, not a new top-level route, depending on how
`app/accounts/**` is laid out by the time you get here).

- **Deposit/withdrawal forms**: amount input (2 decimal places enforced client-side for
  UX, server-side for correctness), account lookup/selection, channel selection,
  narration; generate a client-side idempotency key (UUID) once per form session and
  reuse it across retries of the *same* submission, not a new one per click
- **Receipt view**: reference number, amount, balance after, timestamp — printable/simple
- **Statement**: paginated list with running balance column, filter by date range
- **Reversal**: only visible/enabled for `BRANCH_MANAGER`, requires a reason field before
  submission

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

### Step 3 — Frontend
As described above, matching `ui-registry.md` patterns.

### Step 4 — Write Tests
- `tests/api/deposits.test.mjs`: missing `Idempotency-Key` → `400`; valid deposit →
  `201`; repeated key → `200` with identical body; inactive account → `409`
- `tests/api/withdrawals.test.mjs`: each of the five rejection reasons maps to the
  correct error code; non-holder `CUSTOMER` → `403`; successful withdrawal → `201`
- `tests/api/reversals.test.mjs`: non-manager → `403`; valid reversal → success;
  double-reversal → `409 ALREADY_REVERSED`
- `tests/e2e/deposit-withdraw-reverse.test.mjs`: deposit, view receipt, withdraw, view
  updated statement, reverse as manager, confirm balance restored

### Step 5 — Run & Verify
```bash
npm run typecheck && npm test
```

### Step 6 — Update Docs
- Confirm `docs/05_api-and-pages.md` matches every endpoint exactly, including status
  codes for idempotent replay
- Run `/imprint` — deposit/withdrawal form, receipt, statement table patterns
- Update task status in `docs/09_task-tracker.md` → `DONE`
- Write a handoff in `.agent/handoffs/` — M3's balance panel (Phase 3, their T03) and
  M5's FD opening (Phase 4) will both link into these pages

---

## Acceptance Criteria
- [ ] `Idempotency-Key` is required and enforced at the database level, not an
      in-memory cache
- [ ] Every routine error code maps to its documented HTTP status — no generic `500`
      for a business rejection
- [ ] Reversal is `BRANCH_MANAGER`-only, enforced on the server
- [ ] Statement shows a correct running balance and paginates correctly
- [ ] `/imprint` run; `ui-registry.md` updated
- [ ] `npm run typecheck && npm test` pass
