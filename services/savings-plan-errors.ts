import { BusinessRuleError, DomainError, PG_ERROR } from "@/lib/db/errors";

interface DatabaseErrorLike {
  code?: unknown;
  constraint?: unknown;
}

function databaseError(error: unknown): DatabaseErrorLike | null {
  return typeof error === "object" && error !== null
    ? (error as DatabaseErrorLike)
    : null;
}

/** Maps savings_plan's named CHECK constraints to safe API-facing domain errors. */
export function throwSavingsPlanDatabaseError(error: unknown): never {
  if (error instanceof DomainError) {
    throw error;
  }

  const dbError = databaseError(error);
  const code = typeof dbError?.code === "string" ? dbError.code : null;
  const constraint =
    typeof dbError?.constraint === "string" ? dbError.constraint : null;

  if (code === PG_ERROR.CHECK_VIOLATION) {
    if (constraint === "chk_savings_plan_age_range") {
      throw new BusinessRuleError(
        "INVALID_AGE_RANGE",
        "maxAgeYears must be greater than or equal to minAgeYears.",
      );
    }

    if (constraint === "chk_savings_plan_holder_range") {
      throw new BusinessRuleError(
        "INVALID_HOLDER_RANGE",
        "maxHolders must be greater than or equal to minHolders.",
      );
    }

    if (constraint === "chk_savings_plan_min_balance_nonneg") {
      throw new BusinessRuleError(
        "INVALID_MIN_BALANCE",
        "Minimum balance cannot be negative.",
      );
    }
  }

  throw error;
}
