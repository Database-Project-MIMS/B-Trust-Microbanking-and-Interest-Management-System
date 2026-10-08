import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole, branchScope, withAuth } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";

export const POST = withAuth(async (request: NextRequest, user) => {
  // Only BRANCH_MANAGER and ADMIN can reverse a transaction
  requireRole(user, "BRANCH_MANAGER", "ADMIN");
  
  // Enforce CSRF protection for this state-changing endpoint
  verifyCsrf(request);
  
  const scope = branchScope(user);
  
  const parts = request.nextUrl.pathname.split("/");
  const transactionId = parts[parts.length - 2];

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  if (!body || typeof body.reason !== "string" || body.reason.trim() === "") {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A reversal reason is required." } },
      { status: 400 }
    );
  }

  // TODO: Verify the transaction belongs to the user's branch (scope.branchId)
  // Then call sp_reverse_transaction
  
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Reversal service is blocked on P03-M04-T04." } },
    { status: 501 }
  );
});
