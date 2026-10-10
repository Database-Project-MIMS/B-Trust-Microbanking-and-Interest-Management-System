import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import { closeAccount } from "@/services/account-service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "BRANCH_MANAGER");
    verifyCsrf(request);
    const { id } = await context.params;
    const data = await closeAccount(id, { ...user, ...branchScope(user) });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) { return errorResponse(error); }
}
