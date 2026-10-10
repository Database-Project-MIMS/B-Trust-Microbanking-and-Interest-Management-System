import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import { ValidationError } from "@/lib/db/errors";
import { registerCustomerSchema, customerSearchSchema } from "@/lib/validation/customer";
import { registerCustomer, searchCustomers } from "@/services/customer-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR");
    const values: Record<string, unknown> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      if (key in values) throw new ValidationError("Search parameters must not be repeated.");
      values[key] = key === "page" || key === "pageSize" ? Number(value) : value;
    }
    const input = customerSearchSchema.parse(values);
    return NextResponse.json({ data: await searchCustomers(input, { ...user, ...branchScope(user) }) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER");
    verifyCsrf(request);
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ValidationError("Request body must be valid JSON."); }
    const input = registerCustomerSchema.parse(body);
    const data = await registerCustomer(input, { ...user, ...branchScope(user) });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
