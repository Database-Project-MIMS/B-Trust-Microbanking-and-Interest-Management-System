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

/** Maps known organisation constraints to safe API-facing domain errors. */
export function throwOrganizationDatabaseError(error: unknown): never {
  if (error instanceof DomainError) {
    throw error;
  }

  const dbError = databaseError(error);
  const code = typeof dbError?.code === "string" ? dbError.code : null;
  const constraint =
    typeof dbError?.constraint === "string" ? dbError.constraint : null;

  if (code === PG_ERROR.UNIQUE_VIOLATION) {
    switch (constraint) {
      case "uq_branch_branch_code":
        throw new BusinessRuleError(
          "DUPLICATE_BRANCH_CODE",
          "A branch with this branch code already exists.",
        );
      case "app_user_username_key":
        throw new BusinessRuleError(
          "DUPLICATE_USERNAME",
          "A user with this username already exists.",
        );
      case "uq_agent_employee_no":
        throw new BusinessRuleError(
          "DUPLICATE_EMPLOYEE_NO",
          "An agent with this employee number already exists.",
        );
      case "uq_agent_nic_passport_no":
        throw new BusinessRuleError(
          "DUPLICATE_IDENTITY",
          "An agent with this identity number already exists.",
        );
      case "uq_agent_email":
        throw new BusinessRuleError(
          "DUPLICATE_EMAIL",
          "An agent with this email address already exists.",
        );
    }
  }

  if (code === PG_ERROR.CHECK_VIOLATION) {
    if (constraint === "ck_branch_no_active_agents") {
      throw new BusinessRuleError(
        "BRANCH_HAS_ACTIVE_AGENTS",
        "Deactivate or transfer all active agents before deactivating this branch.",
      );
    }

    if (constraint === "ck_agent_active_branch") {
      throw new BusinessRuleError(
        "BRANCH_NOT_ACTIVE",
        "An active agent must belong to an active branch.",
      );
    }
  }

  if (code === PG_ERROR.FOREIGN_KEY_VIOLATION && constraint === "fk_agent_branch") {
    throw new BusinessRuleError(
      "INVALID_BRANCH",
      "The selected branch does not exist.",
    );
  }

  throw error;
}
