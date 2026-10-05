import "server-only";
import { Pool, type PoolClient } from "pg";

/**
 * The single PostgreSQL connection pool for the application.
 *
 * `lib/db` is the ONLY module permitted to import `pg` (AGENTS.md §6).
 * Route handlers and components never touch this directly — they call a service.
 *
 * NFR-SEC-08: connections are pooled and bounded so concurrent server functions
 * cannot exhaust PostgreSQL's connection limit.
 */

declare global {
  // eslint-disable-next-line no-var
  var __mimsPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  const pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECTION_TIMEOUT_MS ?? 5_000),
    statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT_MS ?? 10_000),
    application_name: "mims",
  });

  pool.on("error", (err) => {
    // Never surface driver detail to a client — log server-side only (NFR-SEC-05).
    console.error("[db] idle client error", err.message);
  });

  return pool;
}

// Next.js dev server hot-reloads modules; reuse the pool to avoid leaking connections.
export const pool: Pool = global.__mimsPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__mimsPool = pool;

export type { PoolClient };
