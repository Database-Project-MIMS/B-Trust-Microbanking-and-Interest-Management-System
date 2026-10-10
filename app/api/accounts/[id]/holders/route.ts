import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import { ValidationError } from "@/lib/db/errors";
import { addAccountHolder } from "@/services/account-service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "BRANCH_MANAGER");
    verifyCsrf(request);
    const { id } = await context.params;
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ValidationError("Request body must be valid JSON."); }
    const data = await addAccountHolder(id, body, { ...user, ...branchScope(user) });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
