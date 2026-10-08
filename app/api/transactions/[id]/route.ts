import { NextRequest, NextResponse } from "next/server";
import { withAuth, branchScope } from "@/lib/auth/rbac";
import { getTransaction } from "@/services/transaction-service";
import { DomainError } from "@/lib/db/errors";

export const GET = withAuth(async (request: NextRequest, user) => {
  const parts = request.nextUrl.pathname.split("/");
  const transactionId = parts[parts.length - 1] as string;

  try {
    const scope = branchScope(user);
    const result = await getTransaction(transactionId, { userId: user.userId, roleName: user.roleName, branchId: scope.branchId });
    return NextResponse.json({ data: result.data });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Transaction error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
});
