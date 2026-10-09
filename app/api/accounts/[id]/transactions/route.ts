import { NextRequest, NextResponse } from "next/server";
import { withAuth, branchScope } from "@/lib/auth/rbac";
import { getStatement } from "@/services/transaction-service";
import { DomainError } from "@/lib/db/errors";

export const GET = withAuth(async (request: NextRequest, user) => {
  const parts = request.nextUrl.pathname.split("/");
  const accountId = parts[parts.length - 2] as string;

  
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  try {
    const scope = branchScope(user);
    const result = await getStatement(accountId, { userId: user.userId, roleName: user.roleName, branchId: scope.branchId }, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Statement error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
});
