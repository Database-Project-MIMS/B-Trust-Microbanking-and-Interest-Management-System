/**
 * T03: RBAC, Branch Scope & CSRF - Authorization Tests
 *
 * Task: P01-M01-T03
 * Run: npx tsx --env-file=.env --conditions react-server --test tests/api/authorization.test.mjs
 *
 * All RBAC/CSRF helpers are imported from the real production modules.
 * Tests must NOT re-implement the logic inline -- a regression in production
 * code must be caught here (task spec requirement, test 9 asserts this).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// -- Production imports -------------------------------------------------------
import {
  requireRole,
  branchScope,
  requireUser,
  assertBranchProfile,
} from "../../lib/auth/rbac.js";
import { verifyCsrf } from "../../lib/auth/csrf.js";

// -- Fixtures -----------------------------------------------------------------
const TEST_BRANCH_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_BRANCH_ID = "00000000-0000-0000-0000-000000000002";

function makeUser(roleName, branchId = null) {
  return { userId: "u1", username: "testuser", roleId: "r1", roleName, branchId };
}

// Minimal mock matching NextRequest.cookies / headers API used by verifyCsrf
function mockCsrfRequest({ cookieToken = null, headerToken = null } = {}) {
  return {
    cookies: { get: (n) => (n === "mims_csrf" && cookieToken ? { value: cookieToken } : undefined) },
    headers: { get: (n) => (n === "x-csrf-token" ? headerToken : null) },
  };
}

// Minimal mock matching the cookie API surface used by requireUser
function mockSessionRequest(cookieValue) {
  return {
    cookies: { get: (n) => (n === "mims_session" && cookieValue ? { value: cookieValue } : undefined) },
  };
}

// -- Tests --------------------------------------------------------------------
describe("T03: RBAC, Branch Scope & CSRF Tests", () => {

  // 1. Correct role -> access granted
  test("1. requireRole does not throw when user has an allowed role", () => {
    assert.doesNotThrow(() => requireRole(makeUser("ADMIN"), "ADMIN", "BRANCH_MANAGER"));
  });

  // 2. Wrong role -> 403
  test("2. requireRole throws 403 when user role is not in the allowed list", () => {
    assert.throws(
      () => requireRole(makeUser("AGENT", TEST_BRANCH_ID), "ADMIN", "BRANCH_MANAGER"),
      (err) => { assert.equal(err.status, 403); return true; }
    );
  });

  // 3. No session -> 401
  // requireUser reads the session cookie; a missing cookie throws 401 immediately
  // before any DB call, so no mocking is needed.
  test("3. requireUser throws 401 when session cookie is absent", async () => {
    await assert.rejects(
      () => requireUser(mockSessionRequest(null)),
      (err) => { assert.equal(err.status, 401, "Missing cookie must yield 401"); return true; }
    );
  });

  // 4. Cross-branch access denied (AC-11)
  test("4. branchScope for BRANCH_MANAGER returns own branch, never null", () => {
    const scope = branchScope(makeUser("BRANCH_MANAGER", TEST_BRANCH_ID));
    assert.notEqual(scope.branchId, null, "BRANCH_MANAGER must not receive bank-wide null scope");
    assert.equal(scope.branchId, TEST_BRANCH_ID);
  });

  test("4b. Scopes from different branches do not bleed into each other", () => {
    const scopeA = branchScope(makeUser("BRANCH_MANAGER", TEST_BRANCH_ID));
    const scopeB = branchScope(makeUser("BRANCH_MANAGER", OTHER_BRANCH_ID));
    assert.notEqual(scopeA.branchId, scopeB.branchId);
  });

  // 5. State change without CSRF token -> 403 (NFR-SEC-04)
  test("5a. verifyCsrf throws 403 when CSRF cookie is absent", () => {
    assert.throws(
      () => verifyCsrf(mockCsrfRequest({ cookieToken: null, headerToken: "tok" })),
      (err) => { assert.equal(err.status, 403); return true; }
    );
  });

  test("5b. verifyCsrf throws 403 when X-CSRF-Token header is absent", () => {
    assert.throws(
      () => verifyCsrf(mockCsrfRequest({ cookieToken: "aabbcc", headerToken: null })),
      (err) => { assert.equal(err.status, 403); return true; }
    );
  });

  test("5c. verifyCsrf throws 403 when cookie and header tokens do not match", () => {
    // Use equal-length hex strings so timingSafeEqual length check does not short-circuit.
    assert.throws(
      () => verifyCsrf(mockCsrfRequest({ cookieToken: "aa".repeat(32), headerToken: "bb".repeat(32) })),
      (err) => { assert.equal(err.status, 403); return true; }
    );
  });

  // 6. Bank-wide role sees all branches (null scope)
  test("6a. branchScope returns null for ADMIN (bank-wide access)", () => {
    assert.equal(branchScope(makeUser("ADMIN")).branchId, null);
  });

  test("6b. branchScope returns null for CENTRAL_OPS (bank-wide access)", () => {
    assert.equal(branchScope(makeUser("CENTRAL_OPS")).branchId, null);
  });

  test("6c. branchScope returns null for AUDITOR (bank-wide access)", () => {
    assert.equal(branchScope(makeUser("AUDITOR")).branchId, null);
  });

  // 7. Branch-scoped role sees only their own branch
  test("7a. branchScope returns branchId for BRANCH_MANAGER", () => {
    assert.equal(branchScope(makeUser("BRANCH_MANAGER", TEST_BRANCH_ID)).branchId, TEST_BRANCH_ID);
  });

  test("7b. branchScope returns branchId for AGENT", () => {
    assert.equal(branchScope(makeUser("AGENT", TEST_BRANCH_ID)).branchId, TEST_BRANCH_ID);
  });

  // 8. Branch-scoped role without an agent profile -> 403 (fail-closed scope)
  //
  // assertBranchProfile() is the extracted guard that requireUser calls after
  // the DB join. We test it directly with an AGENT user whose branchId is null
  // (simulating a missing agent row from the LEFT JOIN on the agent table).
  // This verifies the exact production logic: no DB mock needed.
  test("8a. assertBranchProfile throws 403 for AGENT with branchId=null (no agent row)", () => {
    assert.throws(
      () => assertBranchProfile("AGENT", null),
      (err) => {
        assert.equal(err.status, 403,
          "AGENT with no agent profile must be denied 403, not silently granted null scope");
        return true;
      }
    );
  });

  test("8b. assertBranchProfile throws 403 for BRANCH_MANAGER with branchId=null", () => {
    assert.throws(
      () => assertBranchProfile("BRANCH_MANAGER", null),
      (err) => { assert.equal(err.status, 403); return true; }
    );
  });

  test("8c. assertBranchProfile does NOT throw for ADMIN with branchId=null (bank-wide is valid)", () => {
    assert.doesNotThrow(() => assertBranchProfile("ADMIN", null),
      "Bank-wide roles are allowed to have null branchId");
  });

  test("8d. assertBranchProfile does NOT throw for AGENT with a valid branchId", () => {
    assert.doesNotThrow(() => assertBranchProfile("AGENT", TEST_BRANCH_ID),
      "An AGENT with a valid agent profile must pass the guard");
  });

  // 9. Tests use production implementations, not inline copies
  test("9. requireRole, branchScope, assertBranchProfile, verifyCsrf are real production exports", async () => {
    const rbac = await import("../../lib/auth/rbac.js");
    const csrf = await import("../../lib/auth/csrf.js");
    assert.strictEqual(requireRole, rbac.requireRole, "Must be production requireRole, not an inline copy");
    assert.strictEqual(branchScope, rbac.branchScope, "Must be production branchScope, not an inline copy");
    assert.strictEqual(assertBranchProfile, rbac.assertBranchProfile, "Must be production assertBranchProfile, not a copy");
    assert.strictEqual(verifyCsrf, csrf.verifyCsrf, "Must be production verifyCsrf, not an inline copy");
  });
});
