import { DomainError, PG_ERROR, isPgError } from "@/lib/db/errors";

/** A business-rule or semantic error with an explicit HTTP status (409 conflict, 422 invalid, ...). */
export class TransactionRuleError extends DomainError {
  constructor(code: string, message: string, status = 409) {
    super(code, message, status);
  }
}

const DEPOSIT_RULES: Record<string, { code: string; message: string; status: number }> = {
  ck_deposit_account_id: { code: "ACCOUNT_ID_REQUIRED", message: "Account ID is required.", status: 400 },
  ck_deposit_amount_positive: { code: "INVALID_DEPOSIT_AMOUNT", message: "Deposit amount must be greater than zero.", status: 400 },
  ck_deposit_user_id: { code: "USER_ID_REQUIRED", message: "Initiating user ID is required.", status: 400 },
  ck_deposit_channel_required: { code: "CHANNEL_REQUIRED", message: "Transaction channel is required.", status: 400 },
  ck_deposit_channel_active: { code: "CHANNEL_UNAVAILABLE", message: "Transaction channel is inactive or does not exist.", status: 409 },
  ck_deposit_account_exists: { code: "ACCOUNT_NOT_FOUND", message: "Account was not found.", status: 404 },
  ck_deposit_account_active: { code: "ACCOUNT_NOT_ACTIVE", message: "Account is not active.", status: 409 },
  ck_deposit_business_hours: { code: "OUTSIDE_BUSINESS_HOURS", message: "Deposits can only be taken during business hours.", status: 409 },
};

const WITHDRAWAL_REVERSAL_CODES: Record<string, { message: string; status: number }> = {
  WITHDRAWAL_NOT_AUTHORIZED: { message: "You are not authorized to withdraw from this account.", status: 403 },
  ACCOUNT_NOT_FOUND: { message: "Account was not found.", status: 404 },
  ACCOUNT_NOT_ACTIVE: { message: "Account is not active.", status: 409 },
  OUTSIDE_BUSINESS_HOURS: { message: "Transactions can only be performed during business hours.", status: 409 },
  MANDATE_NOT_SATISFIED: { message: "The withdrawal mandate is not satisfied.", status: 409 },
  LIMIT_EXCEEDED: { message: "Withdrawal limit exceeded.", status: 409 },
  INSUFFICIENT_FUNDS: { message: "Insufficient funds for withdrawal.", status: 409 },
  BELOW_MINIMUM_BALANCE: { message: "Withdrawal leaves account below minimum balance.", status: 409 },
  TRANSACTION_NOT_FOUND: { message: "Transaction not found.", status: 404 },
  ALREADY_REVERSED: { message: "Transaction is already reversed.", status: 409 },
  TYPE_NOT_REVERSIBLE: { message: "This transaction type cannot be reversed.", status: 409 },
};

/** No transaction: maps a committed withdrawal rejection to a safe domain error. */
export function withdrawalRejectionError(code: string): TransactionRuleError {
  const rule = WITHDRAWAL_REVERSAL_CODES[code];
  if (!rule || !["ACCOUNT_NOT_ACTIVE", "OUTSIDE_BUSINESS_HOURS", "MANDATE_NOT_SATISFIED",
    "LIMIT_EXCEEDED", "INSUFFICIENT_FUNDS", "BELOW_MINIMUM_BALANCE"].includes(code)) {
    return new TransactionRuleError("BUSINESS_RULE_VIOLATION", "The operation was rejected by a business rule.");
  }
  return new TransactionRuleError(code, rule.message, rule.status);
}

/**
 * Translates a raw database error from the transaction routines into a safe domain error.
 */
export function throwTransactionDatabaseError(error: unknown): never {
  if (error instanceof DomainError) throw error;
  if (isPgError(error)) {
    if (error.code === PG_ERROR.RAISE_EXCEPTION) {
      if (typeof error.constraint === "string") {
        const rule = DEPOSIT_RULES[error.constraint];
        if (rule) {
          throw new TransactionRuleError(rule.code, rule.message, rule.status);
        }
      }
      
      const msg = error.message;
      if (msg) {
        if (WITHDRAWAL_REVERSAL_CODES[msg]) {
          throw new TransactionRuleError(msg, WITHDRAWAL_REVERSAL_CODES[msg].message, WITHDRAWAL_REVERSAL_CODES[msg].status);
        }
        
        const baseMsg = msg.split(":")[0];
        if (baseMsg && WITHDRAWAL_REVERSAL_CODES[baseMsg]) {
          throw new TransactionRuleError(baseMsg, WITHDRAWAL_REVERSAL_CODES[baseMsg].message, WITHDRAWAL_REVERSAL_CODES[baseMsg].status);
        }
      }

      throw new TransactionRuleError("BUSINESS_RULE_VIOLATION", "The operation was rejected by a business rule.", 409);
    }
  }
  throw error;
}
