import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { ValidationError } from "@/lib/db/errors";
import { errorResponse } from "@/lib/http/error-response";
import { getCustomerFixedDeposits } from "@/services/customer-service";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
    if ([...request.nextUrl.searchParams].length) throw new ValidationError("This endpoint accepts no query parameters.");
    const { id } = await context.params;
    return NextResponse.json({ data: await getCustomerFixedDeposits(id, { ...user, ...branchScope(user) }) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
