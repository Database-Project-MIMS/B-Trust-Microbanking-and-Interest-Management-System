import "server-only";

/**
 * Typed domain errors. Route handlers map these to status codes.
 *
 * NFR-SEC-05: the `message` here is safe to show a user. Driver text, SQL and
 * stack traces are logged server-side and never returned to the client.
 */

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) { super("VALIDATION_FAILED", message, 400); }
}
export class NotAuthenticatedError extends DomainError {
  constructor() { super("NOT_AUTHENTICATED", "Sign in required.", 401); }
}
export class NotAuthorizedError extends DomainError {
  constructor(message = "You do not have access to this resource.") {
    super("NOT_AUTHORIZED", message, 403);
  }
}
export class NotFoundError extends DomainError {
  constructor(what: string) { super("NOT_FOUND", `${what} was not found.`, 404); }
}
/** Business-rule conflicts: overdraft, minimum balance, duplicate active FD, mandate. */
export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string) { super(code, message, 409); }
}

/** PostgreSQL SQLSTATE codes the services map deliberately. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  SERIALIZATION_FAILURE: "40001",
  DEADLOCK_DETECTED: "40P01",
  RAISE_EXCEPTION: "P0001",
} as const;
