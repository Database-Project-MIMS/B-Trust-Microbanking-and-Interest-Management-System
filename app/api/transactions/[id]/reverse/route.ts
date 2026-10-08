import { NextRequest, NextResponse } from "next/server";
import { requireRole, branchScope, withAuth } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { reverseTransaction } from "@/services/transaction-service";
import { DomainError } from "@/lib/db/errors";

export const POST = withAuth(async (request: NextRequest, user) => {
  // Only BRANCH_MANAGER and ADMIN can reverse a transaction
  requireRole(user, "BRANCH_MANAGER", "ADMIN");
  
  // Enforce CSRF protection for this state-changing endpoint
  verifyCsrf(request);
  
  const scope = branchScope(user);
  
  const parts = request.nextUrl.pathname.split("/");
  const transactionId = parts[parts.length - 2] as string;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const reason = body?.reason?.trim() ?? "";

  if (!reason) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A reversal reason is required." } },
      { status: 400 }
    );
  }

  try {
    // Note: passing body which contains reason.
    const result = await reverseTransaction(transactionId, body, { userId: user.userId, roleName: user.roleName, branchId: scope.branchId });
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Reversal error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
});
