import { NextRequest, NextResponse } from "next/server";
import { withAuth, branchScope } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { requireIdempotencyKey } from "@/lib/api/idempotency";
import { postWithdrawal } from "@/services/transaction-service";
import { DomainError } from "@/lib/db/errors";

export const POST = withAuth(async (request: NextRequest, user) => {
  verifyCsrf(request);

  const idempotencyKey = requireIdempotencyKey(request);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  try {
    const scope = branchScope(user);
    const result = await postWithdrawal(body, { userId: user.userId, roleName: user.roleName, branchId: scope.branchId }, idempotencyKey);
    return NextResponse.json({ data: result.data }, { status: result.replayed ? 200 : 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Withdrawal error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
});
