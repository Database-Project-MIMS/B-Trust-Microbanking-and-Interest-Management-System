# I-2: lib/db Hardening & Database Contract

**From:** Member 4 (Pramudith) · **To:** All Members (M1, M2, M3, M5) · **Date:** 2026-09-25  
**Status:** published  
**Task ID:** `P01-M04-T01`

---

## What this gives you

`lib/db` is the **only** module in the entire application permitted to import `pg` (AGENTS.md §6).
This handoff publishes:
1. `withTransaction<T>(fn, options)` with automatic retry for transient concurrency errors.
2. Typed domain error classes and `mapDatabaseError(err)` that safely translate SQLSTATEs without leaking query text, parameters, or driver stacks (NFR-SEC-05).
3. Redacted query timing logs.
4. Connection pool metrics (`getPoolMetrics()`) for `/api/health`.

### 1. `withTransaction<T>(fn, options)`

```ts
import { withTransaction, type Executor } from "@/lib/db";

// Signature:
export async function withTransaction<T>(
  fn: (tx: Executor) => Promise<T>,
  options?: {
    isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
    maxAttempts?: number; // default: 3
    backoffMs?: (attempt: number) => number;
  },
): Promise<T>;
```

#### Behavior & Invariants:
- **Transaction Boundary:** Runs `BEGIN`, executes `fn(tx)`, and runs `COMMIT` on resolution.
- **Rollback on Error:** Runs `ROLLBACK` immediately if `fn` throws.
- **Automatic Concurrency Retry:** Automatically retries transient PostgreSQL errors with exponential backoff + jitter up to `maxAttempts` (default 3):
  - `40001` — `SERIALIZATION_FAILURE`
  - `40P01` — `DEADLOCK_DETECTED`
- **Never retries business or constraint violations** (`23505`, `23503`, `23514`, `23502`, etc.).
- Thrown errors are mapped to safe domain error instances before surfacing.

---

### 2. Typed Domain Errors

All services should import domain errors from `@/lib/db`:

```ts
import {
  DomainError,
  ValidationError,            // 400
  NotNullViolationError,       // 400 - missing column
  NotAuthenticatedError,      // 401
  NotAuthorizedError,         // 403
  NotFoundError,              // 404
  BusinessRuleError,          // 409
  UniqueViolationError,       // 409 - duplicates
  ForeignKeyViolationError,   // 409 - missing or in-use referenced entity
  CheckViolationError,        // 400 - check constraint failure
  SerializationFailureError,  // 503
  DeadlockDetectedError,      // 503
  DatabaseError,              // 500 - generic safe db error
  mapDatabaseError,
  PG_ERROR,
} from "@/lib/db";
```

#### SQLSTATE Mapping Summary:

| SQLSTATE | Postgres Meaning | Mapped Domain Error | HTTP Status | Exposed Info |
|---|---|---|---|---|
| `23505` | Unique violation | `UniqueViolationError` | `409` | `constraint` name |
| `23503` | Foreign key violation | `ForeignKeyViolationError` | `409` | `constraint` name |
| `23514` | Check violation | `CheckViolationError` | `400` | `constraint` name |
| `23502` | Not null violation | `NotNullViolationError` | `400` | `column` name |
| `40001` | Serialization failure | `SerializationFailureError` | `503` | Safe retry message |
| `40P01` | Deadlock detected | `DeadlockDetectedError` | `503` | Safe retry message |
| `P0001` | Routine exception | `BusinessRuleError` | `409` | Procedure message |
| others | Unhandled error | `DatabaseError` | `500` | Generic message |

> 🔒 **Security Guarantee (NFR-SEC-05):** Driver error details, internal stack traces, bound query parameters, and raw SQL text are strictly scrubbed from domain errors.

---

### 3. Example Usage in Service Layer

```ts
import { withTransaction, queryOne, NotFoundError } from "@/lib/db";

export async function openAccountService(data: OpenAccountInput) {
  return withTransaction(async (tx) => {
    // 1. Lock before deciding
    const existing = await tx.query(
      `SELECT account_id FROM account WHERE account_number = $1 FOR UPDATE`,
      [data.accountNumber],
    );

    // 2. Perform updates / inserts
    const res = await tx.query(
      `INSERT INTO account (account_number, current_balance)
       VALUES ($1, $2)
       RETURNING account_id`,
      [data.accountNumber, data.initialDeposit],
    );

    return res.rows[0];
  });
}
```

---

### 4. Pool Metrics for Health Endpoint (`/api/health`)

```ts
import { getPoolMetrics } from "@/lib/db";

const { totalCount, idleCount, waitingCount } = getPoolMetrics();
```
