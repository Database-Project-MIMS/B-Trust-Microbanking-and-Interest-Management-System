import "server-only";
import type { QueryResultRow } from "pg";
import { pool, type PoolClient } from "./pool";

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
): Promise<T[]> {
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

/** Run a parameterized query expecting at most one row. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run `fn` inside a single explicit database transaction.
 *
 * Commits when `fn` resolves, rolls back when it throws. This is the ONLY way
 * services open a transaction — do not issue bare BEGIN/COMMIT (AGENTS.md §11).
 *
 * Every financial operation runs inside one of these. A failure must leave no
 * partial ledger, balance or audit effect (FR-DEP-05, NFR-SAFE-05).
 *
 * @example
 *   await withTransaction(async (tx) => {
 *     // lock BEFORE deciding, then re-read inside the transaction
 *     const acct = await tx.query(
 *       "SELECT current_balance, status FROM account WHERE account_id = $1 FOR UPDATE",
 *       [accountId],
 *     );
 *     ...
 *   });
 */
export async function withTransaction<T>(
  fn: (tx: Executor) => Promise<T>,
  options: { isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE" } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(
      options.isolationLevel
        ? `BEGIN ISOLATION LEVEL ${options.isolationLevel}`
        : "BEGIN",
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[db] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

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
