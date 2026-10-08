import { DomainError, PG_ERROR, isPgError } from "@/lib/db/errors";

/** A business-rule or semantic error with an explicit HTTP status (409 conflict, 422 invalid, ...). */
export class AccountRuleError extends DomainError {
  constructor(code: string, message: string, status = 409) {
    super(code, message, status);
  }
}

interface Rule { code: string; message: string; status: number }

// Named constraints raised by sp_open_savings_account (0243), sp_add_account_holder (0245),
// sp_close_account and its guard trigger (0441) and the holder/mandate triggers (0242). Messages are fixed text: the routine's own messages carry
// ids and must never reach a client (NFR-SEC-05).
const RULES: Readonly<Record<string, Rule>> = {
  ck_open_account_plan: { code: "PLAN_NOT_FOUND", message: "The savings plan does not exist or is not active.", status: 422 },
  ck_open_account_agent: { code: "AGENT_NOT_ELIGIBLE", message: "The opening agent is not an active agent of this branch.", status: 403 },
  ck_account_holder_count: { code: "INVALID_HOLDER_COUNT", message: "The number of holders is not allowed for this plan.", status: 409 },
  ck_open_account_holders_payload: { code: "INVALID_HOLDERS_PAYLOAD", message: "The holders list is invalid.", status: 422 },
  ck_open_account_holder_exists: { code: "HOLDER_NOT_FOUND", message: "Every holder must be an existing active customer.", status: 409 },
  ck_account_holder_one_primary: { code: "MISSING_PRIMARY_HOLDER", message: "Exactly one holder must be the primary holder.", status: 422 },
  ck_open_account_eligibility: { code: "PLAN_ELIGIBILITY_FAILED", message: "The applicant does not satisfy this plan's eligibility rules.", status: 409 },
  ck_open_account_documents: { code: "DOCUMENTS_NOT_VERIFIED", message: "Every holder needs a verified document.", status: 409 },
  ck_open_account_mandate: { code: "MANDATE_REQUIRED", message: "This plan needs an operating mandate.", status: 409 },
  ck_joint_mandate_multi_holder_plan: { code: "MANDATE_NOT_ALLOWED", message: "This plan does not take a joint mandate.", status: 409 },
  ck_joint_mandate_type: { code: "INVALID_MANDATE_TYPE", message: "The mandate type is invalid.", status: 422 },
  ck_joint_mandate_signatories_fit: { code: "INVALID_MANDATE_SIGNATORIES", message: "The required signatories do not fit the holders.", status: 409 },
  ck_joint_mandate_signatories_range: { code: "INVALID_MANDATE_SIGNATORIES", message: "The required signatories must be from 1 to 4.", status: 422 },
  ck_joint_mandate_any_one_single: { code: "INVALID_MANDATE_SIGNATORIES", message: "An ANY_ONE mandate needs exactly one signatory.", status: 422 },
  ck_open_account_deposit: { code: "INVALID_DEPOSIT_AMOUNT", message: "The initial deposit amount is invalid.", status: 422 },
  ck_open_account_minimum_balance: { code: "BELOW_MINIMUM_BALANCE", message: "The initial deposit is below the plan minimum.", status: 409 },
  ck_open_account_business_hours: { code: "OUTSIDE_BUSINESS_HOURS", message: "An initial deposit can only be taken during business hours.", status: 409 },
  ck_open_account_channel: { code: "CHANNEL_UNAVAILABLE", message: "The deposit channel is not available.", status: 409 },
  ck_account_holder_adult: { code: "UNDERAGE_HOLDER", message: "This plan requires every holder to be an adult.", status: 409 },
  ck_add_holder_account: { code: "ACCOUNT_NOT_FOUND", message: "Account was not found.", status: 404 },
  ck_add_holder_account_active: { code: "ACCOUNT_NOT_ACTIVE", message: "Holders can only be added to an active account.", status: 409 },
  // A mismatch between the acting user and the session user is a service bug, not a client error.
  ck_open_account_actor: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", status: 500 },
  ck_add_holder_actor: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", status: 500 },
  // sp_close_account (0441) and trg_account_close_guard (0441) share the two business-rule names.
  ck_close_account_not_found: { code: "ACCOUNT_NOT_FOUND", message: "Account was not found.", status: 404 },
  ck_close_account_already_closed: { code: "ACCOUNT_ALREADY_CLOSED", message: "The account is already closed.", status: 409 },
  ck_close_account_not_active: { code: "ACCOUNT_NOT_ACTIVE", message: "Only an active account can be closed.", status: 409 },
  ck_close_account_balance: { code: "BALANCE_NOT_ZERO", message: "An account can only be closed with a zero balance.", status: 409 },
  ck_close_account_active_fd: { code: "ACTIVE_FD_EXISTS", message: "An account with an active fixed deposit cannot be closed.", status: 409 },
  ck_close_account_actor: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", status: 500 },
  uq_account_holder_account_customer: { code: "DUPLICATE_HOLDER", message: "This customer already holds the account.", status: 409 },
};

/**
 * Translates a raw database error from the account routines into a safe domain error.
 * Call it INSIDE the transaction callback: withTransaction would otherwise collapse every
 * P0001 into one generic error carrying the raw message. Unknown errors are rethrown as-is
 * (and mapped generically); an unknown P0001 or an actor mismatch becomes a generic rule error.
 */
export function throwAccountDatabaseError(error: unknown): never {
  if (error instanceof DomainError) throw error;
  if (isPgError(error)) {
    const rule = typeof error.constraint === "string" ? RULES[error.constraint] : undefined;
    if (rule && [PG_ERROR.RAISE_EXCEPTION, PG_ERROR.UNIQUE_VIOLATION, PG_ERROR.CHECK_VIOLATION].includes(error.code as never)) {
      throw new AccountRuleError(rule.code, rule.message, rule.status);
    }
    if (error.code === PG_ERROR.RAISE_EXCEPTION) {
      // Includes ACTOR_MISMATCH, which signals a service bug rather than a client mistake.
      throw new AccountRuleError("BUSINESS_RULE_VIOLATION", "The operation was rejected by a business rule.", 409);
    }
  }
  throw error;
}
