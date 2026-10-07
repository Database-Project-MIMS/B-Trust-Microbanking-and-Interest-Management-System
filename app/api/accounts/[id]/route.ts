import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { getAccountDetail } from "@/services/account-service";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
    const { id } = await context.params;
    return NextResponse.json({ data: await getAccountDetail(id, { ...user, ...branchScope(user) }) });
  } catch (error) { return errorResponse(error); }
}
