import "server-only";
import type { QueryResultRow } from "pg";
import { pool, type PoolClient } from "./pool";
import { mapDatabaseError } from "./errors";
import { extractQueryTag, logQueryTiming, logQueryError } from "./logger";

/**
 * Parameterized query helpers.
 *
 * NFR-SEC-02: every value is passed as a bound parameter ($1, $2, ...).
 * SQL is NEVER built by concatenating or interpolating user input.
 */

export type Executor = Pick<PoolClient, "query">;

/** Run a parameterized query outside any explicit transaction. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  queryTag?: string,
): Promise<T[]> {
  const start = performance.now();
  const tag = queryTag ?? extractQueryTag(text);
  try {
    const result = await pool.query<T>(text, params as unknown[]);
    const durationMs = Math.round(performance.now() - start);
    logQueryTiming(tag, durationMs);
    return result.rows;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    logQueryError(tag, durationMs, err);
    throw mapDatabaseError(err);
  }
}

/** Run a parameterized query expecting at most one row. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  queryTag?: string,
): Promise<T | null> {
  const rows = await query<T>(text, params, queryTag);
  return rows[0] ?? null;
}

/**
 * Re-export withTransaction from with-transaction.ts
 * Retries on 40001 (serialization failure) and 40P01 (deadlock detected).
 */
export { withTransaction, type TransactionOptions } from "./with-transaction";

/**
 * Resolve a dynamic SQL identifier from a server-side allow-list.
 *
 * NFR-SEC-02: identifiers (sort column, direction) can never be parameterized,
 * so they must be chosen from a fixed allow-list — never taken from the request.
 */
export function allowListed<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
