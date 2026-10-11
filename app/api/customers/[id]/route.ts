import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { getCustomerProfile, updateCustomer } from "@/services/customer-service";
import { verifyCsrf } from "@/lib/auth/csrf";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
    const { id } = await context.params;
    return NextResponse.json({ data: await getCustomerProfile(id, { ...user, ...branchScope(user) }) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER");
    verifyCsrf(request);
    return NextResponse.json({ data: await updateCustomer((await context.params).id,
      await request.json(), { ...user, ...branchScope(user) }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
