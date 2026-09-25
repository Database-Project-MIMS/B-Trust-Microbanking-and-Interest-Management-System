import "server-only";

/**
 * Redacted query logger for database operations.
 *
 * NFR-SEC-05: Parameter values are strictly redacted to prevent accidental
 * leakage of financial amounts, NIC numbers, password hashes, or customer PII.
 */

/** Extracts an operation tag or the first few SQL tokens without literals. */
export function extractQueryTag(sql: string): string {
  const trimmed = sql.trim();
  const commentMatch = trimmed.match(/^\/\*\s*([^*]+)\s*\*\//);
  if (commentMatch && commentMatch[1]) {
    return commentMatch[1].trim();
  }
  // Extract up to 4 words from the SQL command (e.g., "SELECT * FROM account")
  const tokens = trimmed.replace(/\s+/g, " ").split(" ");
  return tokens.slice(0, 4).join(" ");
}

/** Logs query duration without bound parameter values. */
export function logQueryTiming(tag: string, durationMs: number): void {
  const isSlow = durationMs >= 100;
  if (isSlow) {
    console.warn(`[db:slow] tag="${tag}" duration=${durationMs}ms`);
  } else if (process.env.LOG_LEVEL === "debug") {
    console.log(`[db] tag="${tag}" duration=${durationMs}ms`);
  }
}

/** Logs query failure with SQLSTATE and tag, omitting all parameter values and raw driver messages. */
export function logQueryError(tag: string, durationMs: number, err: unknown): void {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as Record<string, unknown>).code)
      : "UNKNOWN";
  console.error(`[db:error] tag="${tag}" code=${code} duration=${durationMs}ms`);
}
