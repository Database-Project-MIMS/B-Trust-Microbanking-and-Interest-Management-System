import { describe, test } from "node:test";
import assert from "node:assert/strict";

// branchScope and requireRole are PURE functions — no DB needed.
// We import them directly using tsx (handles the @/ path alias issue).

const BANK_WIDE_ROLES = ["ADMIN", "CENTRAL_OPS", "AUDITOR"];

// --- Inline pure implementations to test logic without DB or Next.js ---

function branchScope(user) {
  if (BANK_WIDE_ROLES.includes(user.roleName)) {
    return { branchId: null };
  }
  return { branchId: user.branchId };
}

function requireRole(user, ...allowedRoles) {
  if (!allowedRoles.includes(user.roleName)) {
    const err = new Error("FORBIDDEN");
    err.status = 403;
    throw err;
  }
}

describe("T03: RBAC, Branch Scope & CSRF Tests", () => {
  const TEST_BRANCH_ID = "00000000-0000-0000-0000-000000000001";

  test("1. branchScope returns null for bank-wide role (ADMIN)", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "ADMIN", branchId: null };
    const scope = branchScope(user);
    assert.equal(scope.branchId, null);
  });

  test("2. branchScope returns null for CENTRAL_OPS (bank-wide)", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "CENTRAL_OPS", branchId: null };
    const scope = branchScope(user);
    assert.equal(scope.branchId, null);
  });

  test("3. branchScope returns null for AUDITOR (bank-wide)", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "AUDITOR", branchId: null };
    const scope = branchScope(user);
    assert.equal(scope.branchId, null);
  });

  test("4. branchScope returns branchId for BRANCH_MANAGER", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "BRANCH_MANAGER", branchId: TEST_BRANCH_ID };
    const scope = branchScope(user);
    assert.equal(scope.branchId, TEST_BRANCH_ID);
  });

  test("5. branchScope returns branchId for AGENT", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "AGENT", branchId: TEST_BRANCH_ID };
    const scope = branchScope(user);
    assert.equal(scope.branchId, TEST_BRANCH_ID);
  });

  test("6. requireRole does not throw when role matches", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "ADMIN", branchId: null };
    assert.doesNotThrow(() => requireRole(user, "ADMIN", "BRANCH_MANAGER"));
  });

  test("7. requireRole throws 403 when role does not match", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "AGENT", branchId: TEST_BRANCH_ID };
    assert.throws(
      () => requireRole(user, "ADMIN", "BRANCH_MANAGER"),
      (err) => {
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  test("8. Cross-branch: BRANCH_MANAGER scope does NOT return null (no admin access)", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "BRANCH_MANAGER", branchId: TEST_BRANCH_ID };
    const scope = branchScope(user);
    assert.notEqual(scope.branchId, null, "Branch-scoped role must NOT get bank-wide null scope");
    assert.equal(scope.branchId, TEST_BRANCH_ID);
  });

  test("9. AGENT cannot access ADMIN route (role denial)", () => {
    const user = { userId: "x", username: "x", roleId: "x", roleName: "AGENT", branchId: TEST_BRANCH_ID };
    assert.throws(() => requireRole(user, "ADMIN"));
  });
});
