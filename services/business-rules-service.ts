import "server-only";
import { query, withTransaction, BusinessRuleError } from "@/lib/db";
import { getParameter } from "@/services/parameter-service";

// ─── Domain Errors ────────────────────────────────────────────────────────────

/** Thrown when an operation is attempted outside configured business hours. */
export class OutsideBusinessHoursError extends BusinessRuleError {
  constructor() {
    super("OUTSIDE_BUSINESS_HOURS", "This operation can only be performed during business hours.");
  }
}

/** Thrown when a withdrawal exceeds a single-transaction or daily limit. */
export class LimitExceededError extends BusinessRuleError {
  constructor(limitType: "single" | "daily", limit: string) {
    super(
      "LIMIT_EXCEEDED",
      limitType === "single"
        ? `This withdrawal exceeds the maximum single-transaction limit of ${limit}.`
        : `This withdrawal would exceed the daily withdrawal limit of ${limit}.`
    );
  }
}

// ─── Business Hours Check ─────────────────────────────────────────────────────

/**
 * Checks if the current server time is within business hours configured in
 * system_parameter (BUSINESS_HOUR_START / BUSINESS_HOUR_END).
 * Throws OutsideBusinessHoursError if outside hours.
 * Must be called INSIDE a transaction to benefit from a consistent snapshot.
 */
export async function checkBusinessHours(): Promise<void> {
  const rows = await query<{ is_open: boolean }>(
    "SELECT fn_is_business_hour(now() AT TIME ZONE 'Asia/Colombo') AS is_open"
  );
  if (!rows[0]?.is_open) {
    throw new OutsideBusinessHoursError();
  }
}

// ─── Withdrawal Limits ────────────────────────────────────────────────────────

/**
 * Validates that a withdrawal amount does not exceed the single-transaction
 * limit, and that the day's total withdrawals for the account do not exceed
 * the daily limit. Must be called INSIDE a transaction AFTER the account
 * row lock (SELECT … FOR UPDATE) has been acquired so the daily total is
 * accurate and race-condition-safe.
 */
export async function checkWithdrawalLimits(
  accountId: string,
  amount: string
): Promise<void> {
  const [singleLimit, dailyLimit] = await Promise.all([
    getParameter("WITHDRAWAL_SINGLE_LIMIT"),
    getParameter("WITHDRAWAL_DAILY_LIMIT"),
  ]);

  const amountNum = parseFloat(amount);
  const singleLimitNum = parseFloat(singleLimit);
  const dailyLimitNum = parseFloat(dailyLimit);

  if (amountNum > singleLimitNum) {
    throw new LimitExceededError("single", singleLimit);
  }

  // Check daily total for this account (INSIDE the lock)
  const dailyRows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM transaction
     WHERE account_id = $1
       AND transaction_type = 'WITHDRAWAL'
       AND transaction_date::date = CURRENT_DATE`,
    [accountId]
  );

  const dailyTotal = parseFloat(dailyRows[0]?.total ?? "0");
  if (dailyTotal + amountNum > dailyLimitNum) {
    throw new LimitExceededError("daily", dailyLimit);
  }
}
