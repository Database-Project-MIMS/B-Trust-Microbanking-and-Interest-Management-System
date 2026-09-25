import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  withTransaction,
  mapDatabaseError,
  isRetryable,
  UniqueViolationError,
  ForeignKeyViolationError,
  CheckViolationError,
  NotNullViolationError,
  SerializationFailureError,
  DeadlockDetectedError,
  DatabaseError,
  PG_ERROR,
  extractQueryTag,
  logQueryTiming,
  logQueryError,
  getPoolMetrics,
} from "../../lib/db/index.ts";

describe("P01-M04-T01: lib/db Hardening — Publishes I-2", () => {
  // -------------------------------------------------------------------------
  // 1. Domain Error Mapping & Security Redaction (NFR-SEC-05)
  // -------------------------------------------------------------------------
  describe("1. Error mapping & security redaction", () => {
    test("maps 23505 to UniqueViolationError with constraint and 409 status", () => {
      const raw = {
        code: "23505",
        constraint: "uq_branch_branch_code",
        detail: "Key (branch_code)=(HO01) already exists.",
        query: "INSERT INTO branch (branch_code) VALUES ('HO01')",
      };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof UniqueViolationError);
      assert.equal(mapped.code, "UNIQUE_VIOLATION");
      assert.equal(mapped.status, 409);
      assert.equal(mapped.constraint, "uq_branch_branch_code");
      assert.equal(mapped.sqlstate, PG_ERROR.UNIQUE_VIOLATION);
      // Ensure no raw SQL or secret details in error message
      assert.ok(!mapped.message.includes("INSERT INTO"));
      assert.ok(!mapped.message.includes("HO01"));
    });

    test("maps 23503 to ForeignKeyViolationError with constraint and 409 status", () => {
      const raw = {
        code: "23503",
        constraint: "fk_agent_branch_id",
        detail: "Key (branch_id)=(some-uuid) is not present in table 'branch'.",
      };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof ForeignKeyViolationError);
      assert.equal(mapped.code, "FOREIGN_KEY_VIOLATION");
      assert.equal(mapped.status, 409);
      assert.equal(mapped.constraint, "fk_agent_branch_id");
      assert.equal(mapped.sqlstate, PG_ERROR.FOREIGN_KEY_VIOLATION);
    });

    test("maps 23514 to CheckViolationError with constraint and 400 status", () => {
      const raw = {
        code: "23514",
        constraint: "ck_account_balance_non_negative",
      };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof CheckViolationError);
      assert.equal(mapped.code, "CHECK_VIOLATION");
      assert.equal(mapped.status, 400);
      assert.equal(mapped.constraint, "ck_account_balance_non_negative");
      assert.equal(mapped.sqlstate, PG_ERROR.CHECK_VIOLATION);
    });

    test("maps 23502 to NotNullViolationError with column and 400 status", () => {
      const raw = {
        code: "23502",
        column: "national_id",
      };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof NotNullViolationError);
      assert.equal(mapped.code, "NOT_NULL_VIOLATION");
      assert.equal(mapped.status, 400);
      assert.equal(mapped.column, "national_id");
      assert.equal(mapped.sqlstate, PG_ERROR.NOT_NULL_VIOLATION);
    });

    test("maps 40001 to SerializationFailureError with 503 status", () => {
      const raw = { code: "40001", message: "could not serialize access due to read/write dependencies" };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof SerializationFailureError);
      assert.equal(mapped.code, "SERIALIZATION_FAILURE");
      assert.equal(mapped.status, 503);
      assert.equal(mapped.sqlstate, PG_ERROR.SERIALIZATION_FAILURE);
    });

    test("maps 40P01 to DeadlockDetectedError with 503 status", () => {
      const raw = { code: "40P01", message: "deadlock detected" };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof DeadlockDetectedError);
      assert.equal(mapped.code, "DEADLOCK_DETECTED");
      assert.equal(mapped.status, 503);
      assert.equal(mapped.sqlstate, PG_ERROR.DEADLOCK_DETECTED);
    });

    test("maps unhandled SQLSTATE codes to safe DatabaseError (status 500)", () => {
      const raw = {
        code: "XX000",
        message: "internal error: disk corruption on /secret/path",
        query: "SELECT secret_token FROM tokens",
      };
      const mapped = mapDatabaseError(raw);
      assert.ok(mapped instanceof DatabaseError);
      assert.equal(mapped.code, "UNEXPECTED_DB_ERROR");
      assert.equal(mapped.status, 500);
      assert.ok(!mapped.message.includes("secret"));
      assert.ok(!mapped.message.includes("disk corruption"));
    });

    test("redacts sensitive SQL text, parameters, and passwords from error messages", () => {
      const sensitiveRaw = {
        code: "23505",
        constraint: "uq_user_password",
        query: "INSERT INTO app_user (password_hash) VALUES ('$argon2id$v=19$m=65536,t=3,p=4$SUPER_SECRET_HASH')",
        detail: "Key (password_hash)=('$argon2id$v=19$m=65536,t=3,p=4$SUPER_SECRET_HASH') already exists.",
      };
      const mapped = mapDatabaseError(sensitiveRaw);
      assert.ok(!mapped.message.includes("SUPER_SECRET_HASH"));
      assert.ok(!mapped.message.includes("argon2id"));
      assert.ok(!mapped.message.includes("INSERT INTO"));
    });
  });

  // -------------------------------------------------------------------------
  // 2. Retry Decision Logic (isRetryable)
  // -------------------------------------------------------------------------
  describe("2. Transient error retry detection", () => {
    test("identifies 40001 and 40P01 as retryable", () => {
      assert.equal(isRetryable({ code: "40001" }), true);
      assert.equal(isRetryable({ code: "40P01" }), true);
      assert.equal(isRetryable(new SerializationFailureError()), true);
      assert.equal(isRetryable(new DeadlockDetectedError()), true);
    });

    test("never marks business logic or constraint violations as retryable", () => {
      assert.equal(isRetryable({ code: "23505" }), false);
      assert.equal(isRetryable({ code: "23503" }), false);
      assert.equal(isRetryable({ code: "23514" }), false);
      assert.equal(isRetryable({ code: "23502" }), false);
      assert.equal(isRetryable(new UniqueViolationError("uq")), false);
      assert.equal(isRetryable(new Error("Generic failure")), false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. withTransaction: Execution, Rollback & Concurrency Retries
  // -------------------------------------------------------------------------
  describe("3. withTransaction transaction boundary and retry behavior", () => {
    function createMockPool(onQuery) {
      const calls = [];
      const mockClient = {
        query: async (sql, params) => {
          calls.push({ sql: String(sql).trim(), params });
          if (onQuery) return onQuery(sql, params, calls);
          return { rows: [] };
        },
        release: () => {
          calls.push({ action: "release" });
        },
      };

      const mockPool = {
        connect: async () => mockClient,
      };

      return { mockPool, calls };
    }

    test("commits and releases client on successful transaction", async () => {
      const { mockPool, calls } = createMockPool();

      const result = await withTransaction(
        async (tx) => {
          await tx.query("SELECT 1");
          return "SUCCESS";
        },
        { pool: mockPool },
      );

      assert.equal(result, "SUCCESS");
      assert.equal(calls[0].sql, "BEGIN");
      assert.equal(calls[1].sql, "SELECT 1");
      assert.equal(calls[2].sql, "COMMIT");
      assert.equal(calls[3].action, "release");
    });

    test("rolls back completely and releases client on non-retryable error", async () => {
      const { mockPool, calls } = createMockPool();

      await assert.rejects(
        async () => {
          await withTransaction(
            async (tx) => {
              await tx.query("INSERT INTO test VALUES (1)");
              const err = new Error("Validation failure");
              err.code = "23505";
              err.constraint = "uq_test_val";
              throw err;
            },
            { pool: mockPool, maxAttempts: 3 },
          );
        },
        (err) => {
          assert.ok(err instanceof UniqueViolationError);
          assert.equal(err.constraint, "uq_test_val");
          return true;
        },
      );

      const rollbacks = calls.filter((c) => c.sql === "ROLLBACK");
      const releases = calls.filter((c) => c.action === "release");
      const begins = calls.filter((c) => c.sql === "BEGIN");

      // Non-retryable error should NOT retry (exactly 1 BEGIN, 1 ROLLBACK, 1 release)
      assert.equal(begins.length, 1);
      assert.equal(rollbacks.length, 1);
      assert.equal(releases.length, 1);
    });

    test("retries on 40001 (serialization failure) and succeeds on subsequent attempt", async () => {
      let attempts = 0;
      const { mockPool, calls } = createMockPool();

      const result = await withTransaction(
        async (tx) => {
          attempts++;
          if (attempts === 1) {
            const err = new Error("could not serialize access");
            err.code = "40001";
            throw err;
          }
          await tx.query("SELECT 42");
          return "RECOVERED";
        },
        {
          pool: mockPool,
          maxAttempts: 3,
          backoffMs: () => 1, // immediate backoff for test speed
        },
      );

      assert.equal(result, "RECOVERED");
      assert.equal(attempts, 2);

      const begins = calls.filter((c) => c.sql === "BEGIN");
      const rollbacks = calls.filter((c) => c.sql === "ROLLBACK");
      const commits = calls.filter((c) => c.sql === "COMMIT");
      const releases = calls.filter((c) => c.action === "release");

      assert.equal(begins.length, 2);
      assert.equal(rollbacks.length, 1);
      assert.equal(commits.length, 1);
      assert.equal(releases.length, 2);
    });

    test("retries on 40P01 (deadlock) up to maxAttempts and throws mapped error on exhaustion", async () => {
      let attempts = 0;
      const { mockPool, calls } = createMockPool();

      await assert.rejects(
        async () => {
          await withTransaction(
            async () => {
              attempts++;
              const err = new Error("deadlock detected");
              err.code = "40P01";
              throw err;
            },
            {
              pool: mockPool,
              maxAttempts: 3,
              backoffMs: () => 1,
            },
          );
        },
        (err) => {
          assert.ok(err instanceof DeadlockDetectedError);
          assert.equal(err.status, 503);
          return true;
        },
      );

      assert.equal(attempts, 3);
      const begins = calls.filter((c) => c.sql === "BEGIN");
      const rollbacks = calls.filter((c) => c.sql === "ROLLBACK");
      assert.equal(begins.length, 3);
      assert.equal(rollbacks.length, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Query Logging & Redaction
  // -------------------------------------------------------------------------
  describe("4. Query tag extraction and redacted logging", () => {
    test("extracts explicit comment tags from query text", () => {
      const sql = "/* get_account_balance */ SELECT current_balance FROM account WHERE id = $1";
      const tag = extractQueryTag(sql);
      assert.equal(tag, "get_account_balance");
    });

    test("extracts safe command summary when no comment tag is present", () => {
      const sql = "SELECT current_balance, status FROM account WHERE account_id = $1";
      const tag = extractQueryTag(sql);
      assert.equal(tag, "SELECT current_balance, status FROM");
      assert.ok(!tag.includes("$1"));
    });

    test("timing logger handles slow queries without printing parameter values", () => {
      let loggedWarn = "";
      const originalWarn = console.warn;
      console.warn = (msg) => {
        loggedWarn = msg;
      };

      try {
        logQueryTiming("account_lookup", 150);
        assert.ok(loggedWarn.includes("account_lookup"));
        assert.ok(loggedWarn.includes("150ms"));
        assert.ok(!loggedWarn.includes("password"));
      } finally {
        console.warn = originalWarn;
      }
    });

    test("error logger formats error without leaking parameter values", () => {
      let loggedError = "";
      const originalError = console.error;
      console.error = (msg) => {
        loggedError = msg;
      };

      try {
        logQueryError("create_agent", 45, { code: "23505", message: "duplicate employee number" });
        assert.ok(loggedError.includes("tag=\"create_agent\""));
        assert.ok(loggedError.includes("code=23505"));
        assert.ok(loggedError.includes("45ms"));
      } finally {
        console.error = originalError;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 5. Pool Metrics
  // -------------------------------------------------------------------------
  describe("5. Pool metrics for health monitoring", () => {
    test("getPoolMetrics exposes totalCount, idleCount, and waitingCount", () => {
      const metrics = getPoolMetrics();
      assert.equal(typeof metrics.totalCount, "number");
      assert.equal(typeof metrics.idleCount, "number");
      assert.equal(typeof metrics.waitingCount, "number");
    });
  });
});
