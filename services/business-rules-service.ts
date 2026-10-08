import "server-only";
import { withTransaction } from "@/lib/db";
import { BusinessRuleError, ValidationError } from "@/lib/db/errors";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WithdrawalLimitCheck {
  singleLimitOk: boolean;
  dailyLimitOk: boolean;
  singleLimit: string;
  dailyLimit: string;
  dailyUsed: string;
}

// ── Business hours ─────────────────────────────────────────────────────────

/**
 * Checks whether the current time (now()) is within business hours.
 * Reads from fn_is_business_hour() which consults business_calendar and
 * system_parameter (BUSINESS_HOUR_START, BUSINESS_HOUR_END).
 * Transaction boundary: single read query; caller may pass their own executor.
 *
 * @throws BusinessRuleError OUTSIDE_BUSINESS_HOURS (409) if outside hours.
 */
export async function enforceBusinessHours(): Promise<void> {
  const result = await withTransaction(async (tx) => {
    const row = await tx.query<{ is_open: boolean }>(
      "SELECT fn_is_business_hour(now()) AS is_open"
    );
    return row.rows[0]?.is_open ?? false;
  });
  if (!result) {
    throw new BusinessRuleError(
      "OUTSIDE_BUSINESS_HOURS",
      "Transactions can only be processed during business hours."
    );
  }
}

/**
 * Reads a system_parameter value as a numeric string.
 * Returns null if the key is not configured.
 * Transaction boundary: single read query.
 */
export async function getParameter(key: string): Promise<string | null> {
  return withTransaction(async (tx) => {
    const row = await tx.query<{ param_value: string }>(
      "SELECT fn_get_parameter($1) AS param_value",
      [key]
    );
    return row.rows[0]?.param_value ?? null;
  });
}

// ── Withdrawal limits ──────────────────────────────────────────────────────

/**
 * Checks both the single-transaction and daily withdrawal limits for an account.
 * MUST be called INSIDE the locked withdrawal transaction (after SELECT … FOR UPDATE)
 * and BEFORE the ledger insert, so the daily sum is computed on the same snapshot
 * as the balance check.
 *
 * @param tx       - The open transaction executor (from withTransaction callback).
 * @param accountId - The account being debited.
 * @param amount   - The withdrawal amount as a numeric string (never a JS float).
 *
 * @throws BusinessRuleError SINGLE_LIMIT_EXCEEDED (409) if the single transaction limit is breached.
 * @throws BusinessRuleError DAILY_LIMIT_EXCEEDED  (409) if the daily total would be exceeded.
 */
export async function enforceWithdrawalLimits(
  tx: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  accountId: string,
  amount: string
): Promise<void> {
  // Single-transaction limit
  const singleOk = await tx.query<{ ok: boolean }>(
    "SELECT fn_check_withdrawal_single_limit($1::numeric(15,2)) AS ok",
    [amount]
  );
  if (!(singleOk.rows[0]?.ok ?? true)) {
    const limitRow = await tx.query<{ param_value: string }>(
      "SELECT fn_get_parameter('WITHDRAWAL_SINGLE_LIMIT') AS param_value"
    );
    const limit = limitRow.rows[0]?.param_value ?? "unknown";
    throw new BusinessRuleError(
      "SINGLE_LIMIT_EXCEEDED",
      `Withdrawal exceeds the single-transaction limit of LKR ${limit}.`
    );
  }

  // Daily cumulative limit (computed inside the lock)
  const dailyOk = await tx.query<{ ok: boolean }>(
    "SELECT fn_check_withdrawal_daily_limit($1::uuid, $2::numeric(15,2)) AS ok",
    [accountId, amount]
  );
  if (!(dailyOk.rows[0]?.ok ?? true)) {
    const limitRow = await tx.query<{ param_value: string }>(
      "SELECT fn_get_parameter('WITHDRAWAL_DAILY_LIMIT') AS param_value"
    );
    const limit = limitRow.rows[0]?.param_value ?? "unknown";
    throw new BusinessRuleError(
      "DAILY_LIMIT_EXCEEDED",
      `This withdrawal would exceed the daily limit of LKR ${limit}.`
    );
  }
}

// ── Parameter validation helper ────────────────────────────────────────────

/**
 * Parses a system_parameter value as a positive numeric string.
 * Throws ValidationError if the value is null or non-numeric.
 */
export function parsePositiveNumericParameter(key: string, value: string | null): string {
  if (value === null) {
    throw new ValidationError(`System parameter '${key}' is not configured.`);
  }
  const n = Number(value);
  if (!isFinite(n) || n < 0) {
    throw new ValidationError(`System parameter '${key}' has an invalid value: '${value}'.`);
  }
  return value;
}
