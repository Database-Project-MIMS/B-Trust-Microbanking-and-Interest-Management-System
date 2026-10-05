# 🔵 Phase 1 — Task 01: Harden `lib/db` — Publishes I-2
**Task ID:** `P01-M04-T01` · **Branch:** `feat/p01-m04-lib-db-hardening`
**Status:** READY
**Depends on:** Phase 0 scaffold (`lib/db` already exists in skeleton form)
**Story Points:** ~5 · **Layer:** Backend only — **you are the producer of I-2**

---

## What This Task Is

`lib/db` is the **only** module in the whole codebase permitted to import `pg`
(AGENTS.md §6). Every other member's service layer calls `withTransaction()` from this
module. This task is not "infrastructure cleanup" — it is the first cross-member
dependency in the project, and every service written by M1, M2, M3 and M5 is blocked on
it existing in its hardened form. Prioritise this task above all your other Phase 1
work.

---

## What to Build

### 1. Retry on transient errors
Retry the transaction body (not the whole request) on:
- `40001` — serialization failure
- `40P01` — deadlock detected

Use exponential backoff with a small jitter and a maximum retry count (e.g. 3 attempts).
Never retry on a business-logic error — only on these two SQLSTATEs.

```ts
// lib/db/with-transaction.ts
/** Runs fn inside a transaction; retries on serialization failure or deadlock. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      if (isRetryable(err) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw mapDatabaseError(err);
    } finally {
      client.release();
    }
  }
  throw new Error('unreachable');
}
```

### 2. SQLSTATE → domain error mapping
`lib/db/errors.ts`: translate raw `pg` errors into typed domain errors
(`UniqueViolationError`, `ForeignKeyViolationError`, `CheckViolationError`, etc.) that
carry the SQLSTATE and constraint name but **never** the raw SQL text or driver message.
Route handlers across every member's slice will catch these typed errors and map them to
HTTP status codes — this mapping is the contract, so keep the error type names stable
once published.

```ts
// lib/db/errors.ts
export class UniqueViolationError extends Error {
  constructor(public readonly constraint: string) { super('UNIQUE_VIOLATION'); }
}
// ... ForeignKeyViolationError, CheckViolationError, etc.

export function mapDatabaseError(err: unknown): Error {
  if (isPgError(err)) {
    switch (err.code) {
      case '23505': return new UniqueViolationError(err.constraint ?? 'unknown');
      case '23503': return new ForeignKeyViolationError(err.constraint ?? 'unknown');
      case '23514': return new CheckViolationError(err.constraint ?? 'unknown');
      default: return new DatabaseError('UNEXPECTED_DB_ERROR');
    }
  }
  return err instanceof Error ? err : new Error('UNKNOWN_ERROR');
}
```

### 3. Query timing log with value redaction
Log query duration and the query name/tag (not the raw SQL text with bound values) for
slow-query visibility. **Never log parameter values** — some will be money amounts, NIC
numbers, or password hashes passed incidentally through a query in a future task.

### 4. Pool metrics
Expose pool stats (`totalCount`, `idleCount`, `waitingCount`) for the health page (T04)
to read.

---

## How to Implement

### Step 1 — Review the Phase 0 Scaffold
```bash
find lib/db -type f
```
Confirm what Phase 0 already set up (pool creation, `withTransaction` stub) before
rewriting from scratch.

### Step 2 — Implement Retry, Error Mapping, Logging, Metrics
As specified above, in `lib/db/pool.ts`, `lib/db/with-transaction.ts`,
`lib/db/errors.ts`.

### Step 3 — Write Tests
Create `tests/db/lib-db-hardening.test.mjs`:
1. ✅ `withTransaction` rolls back completely on a thrown error — no partial writes
   survive
2. ✅ A `40001` serialization failure is retried and eventually succeeds if the
   conflicting transaction clears
3. ✅ A `23505` unique violation raised inside `fn` is **not** retried — it surfaces
   immediately as a mapped `UniqueViolationError`
4. ✅ No secret or raw SQL text appears in any error message or thrown object's
   `message`/`stack` (grep test output for connection strings, passwords)
5. ✅ Query timing logs contain a duration and a query tag but never a bound parameter
   value

### Step 4 — Run & Verify
```bash
npm run typecheck && npm test
```

### Step 5 — Update Docs & Publish the Handoff
- **Write `.agent/handoffs/i-2-lib-db.md`** — publish the exact exported signatures:
  `withTransaction<T>(fn)`, the domain error class names, and how to import them. Every
  other member's service layer needs this before their Phase 1/2 backend tasks can
  safely start.
- Update `docs/03_architecture.md` if it documents `lib/db`'s contract
- Update task status in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] `withTransaction` rolls back on any thrown error, with no partial writes
- [ ] Retries only `40001`/`40P01`, never a business-logic error
- [ ] No secret or raw SQL text appears in any mapped error
- [ ] Pool metrics are readable by the health page task
- [ ] Handoff published in `.agent/handoffs/` before this task is marked `DONE` — this
      unblocks every other member's Phase 1/2 backend work
- [ ] `npm run typecheck && npm test` pass
