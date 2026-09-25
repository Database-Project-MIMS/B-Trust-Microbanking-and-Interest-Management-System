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
  constructor(message: string) {
    super("VALIDATION_FAILED", message, 400);
  }
}

export class NotAuthenticatedError extends DomainError {
  constructor() {
    super("NOT_AUTHENTICATED", "Sign in required.", 401);
  }
}

export class NotAuthorizedError extends DomainError {
  constructor(message = "You do not have access to this resource.") {
    super("NOT_AUTHORIZED", message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} was not found.`, 404);
  }
}

/** Business-rule conflicts: overdraft, minimum balance, duplicate active FD, mandate. */
export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
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

export class UniqueViolationError extends DomainError {
  readonly sqlstate = PG_ERROR.UNIQUE_VIOLATION;
  constructor(
    readonly constraint: string,
    message = "A record with this identifier already exists.",
  ) {
    super("UNIQUE_VIOLATION", message, 409);
  }
}

export class ForeignKeyViolationError extends DomainError {
  readonly sqlstate = PG_ERROR.FOREIGN_KEY_VIOLATION;
  constructor(
    readonly constraint: string,
    message = "Referenced record does not exist or is currently in use.",
  ) {
    super("FOREIGN_KEY_VIOLATION", message, 409);
  }
}

export class CheckViolationError extends DomainError {
  readonly sqlstate = PG_ERROR.CHECK_VIOLATION;
  constructor(
    readonly constraint: string,
    message = "The operation violates a data integrity rule.",
  ) {
    super("CHECK_VIOLATION", message, 400);
  }
}

export class NotNullViolationError extends DomainError {
  readonly sqlstate = PG_ERROR.NOT_NULL_VIOLATION;
  constructor(
    readonly column: string,
    message = `Missing required field: ${column}.`,
  ) {
    super("NOT_NULL_VIOLATION", message, 400);
  }
}

export class SerializationFailureError extends DomainError {
  readonly sqlstate = PG_ERROR.SERIALIZATION_FAILURE;
  constructor(
    message = "Transaction aborted due to concurrent modification. Please retry.",
  ) {
    super("SERIALIZATION_FAILURE", message, 503);
  }
}

export class DeadlockDetectedError extends DomainError {
  readonly sqlstate = PG_ERROR.DEADLOCK_DETECTED;
  constructor(
    message = "Transaction aborted due to a deadlock. Please retry.",
  ) {
    super("DEADLOCK_DETECTED", message, 503);
  }
}

export class DatabaseError extends DomainError {
  constructor(
    code = "DATABASE_ERROR",
    message = "A database error occurred.",
  ) {
    super(code, message, 500);
  }
}

export interface PgDatabaseErrorLike {
  code: string;
  constraint?: string;
  column?: string;
  table?: string;
  message?: string;
  detail?: string;
  schema?: string;
}

export function isPgError(err: unknown): err is PgDatabaseErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

/** Determines if a database error is transient and safe to retry. */
export function isRetryable(err: unknown): boolean {
  if (
    err instanceof SerializationFailureError ||
    err instanceof DeadlockDetectedError
  ) {
    return true;
  }
  if (isPgError(err)) {
    return (
      err.code === PG_ERROR.SERIALIZATION_FAILURE ||
      err.code === PG_ERROR.DEADLOCK_DETECTED
    );
  }
  return false;
}

/**
 * Translates database driver errors into safe, typed domain errors.
 *
 * NFR-SEC-05: Driver text, raw SQL, parameters, and stack traces are NEVER
 * returned in the mapped domain error message.
 */
export function mapDatabaseError(err: unknown): Error {
  if (err instanceof DomainError) {
    return err;
  }

  if (isPgError(err)) {
    switch (err.code) {
      case PG_ERROR.UNIQUE_VIOLATION:
        return new UniqueViolationError(err.constraint ?? "unknown");
      case PG_ERROR.FOREIGN_KEY_VIOLATION:
        return new ForeignKeyViolationError(err.constraint ?? "unknown");
      case PG_ERROR.CHECK_VIOLATION:
        return new CheckViolationError(err.constraint ?? "unknown");
      case PG_ERROR.NOT_NULL_VIOLATION:
        return new NotNullViolationError(err.column ?? "unknown");
      case PG_ERROR.SERIALIZATION_FAILURE:
        return new SerializationFailureError();
      case PG_ERROR.DEADLOCK_DETECTED:
        return new DeadlockDetectedError();
      case PG_ERROR.RAISE_EXCEPTION:
        return new BusinessRuleError(
          "BUSINESS_RULE_VIOLATION",
          typeof err.message === "string" &&
            !err.message.includes("SELECT") &&
            !err.message.includes("FROM")
            ? err.message
            : "The operation was rejected by business logic rules.",
        );
      default:
        return new DatabaseError("UNEXPECTED_DB_ERROR", "A database error occurred.");
    }
  }

  if (err instanceof Error) {
    return err;
  }

  return new DatabaseError("UNKNOWN_ERROR", "An unexpected error occurred.");
}
