import "server-only";
import { pool, type PoolClient } from "./pool";
import { isRetryable, mapDatabaseError } from "./errors";

export interface TransactionOptions {
  isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  /** Optional pool override for dependency injection in testing */
  pool?: { connect: () => Promise<PoolClient> };
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Calculates exponential backoff delay with random jitter.
 * Attempt 1: ~25-50ms, Attempt 2: ~50-100ms, Attempt 3: ~100-200ms.
 */
function defaultBackoffMs(attempt: number): number {
  const base = 25 * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 25);
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn` inside a single explicit PostgreSQL transaction.
 *
 * Transaction Boundary: Commits when `fn` resolves, rolls back when `fn` throws.
 *
 * Automatically retries transient concurrency failures:
 * - SQLSTATE 40001: serialization failure
 * - SQLSTATE 40P01: deadlock detected
 *
 * Retries use exponential backoff with jitter up to maxAttempts (default 3).
 * Never retries business-logic, validation, or constraint errors.
 *
 * NFR-SEC-05: Errors thrown are mapped domain errors with no SQL text or credentials.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const getBackoff = options.backoffMs ?? defaultBackoffMs;
  const activePool = options.pool ?? pool;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = await activePool.connect();
    try {
      await client.query(
        options.isolationLevel
          ? `BEGIN ISOLATION LEVEL ${options.isolationLevel}`
          : "BEGIN",
      );

      const result = await fn(client);

      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error(
          "[db] rollback failed",
          rollbackErr instanceof Error ? rollbackErr.message : "unknown error",
        );
      }

      if (isRetryable(err) && attempt < maxAttempts) {
        const delay = getBackoff(attempt);
        await sleep(delay);
        continue;
      }

      throw mapDatabaseError(err);
    } finally {
      client.release();
    }
  }

  throw new Error("Transaction failed after maximum retries");
}
