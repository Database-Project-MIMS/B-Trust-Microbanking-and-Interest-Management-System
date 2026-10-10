import { NextRequest, NextResponse } from "next/server";
import { requireRole, branchScope, withAuth } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { reverseTransaction } from "@/services/transaction-service";
import { requireIdempotencyKey } from "@/lib/api/idempotency";
import { DomainError } from "@/lib/db/errors";

export const POST = withAuth(async (request: NextRequest, user) => {
  // The existing specification permits branch managers only.
  requireRole(user, "BRANCH_MANAGER");
  
  // Enforce CSRF protection for this state-changing endpoint
  verifyCsrf(request);
  
  const idempotencyKey=requireIdempotencyKey(request);
  if(idempotencyKey instanceof NextResponse)return idempotencyKey;
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

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A reversal reason is required." } },
      { status: 400 }
    );
  }

  try {
    // Note: passing body which contains reason.
    const result = await reverseTransaction(transactionId, body, { userId: user.userId, roleName: user.roleName, branchId: scope.branchId }, idempotencyKey);
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
