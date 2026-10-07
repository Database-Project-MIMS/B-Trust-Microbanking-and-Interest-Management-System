import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import { ValidationError } from "@/lib/db/errors";
import { idempotencyKeySchema } from "@/lib/validation/account";
import { listAccounts, openAccount } from "@/services/account-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR");
    const values: Record<string, unknown> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      if (key in values) throw new ValidationError("Search parameters must not be repeated.");
      values[key] = key === "page" || key === "pageSize" ? Number(value) : value;
    }
    return NextResponse.json({ data: await listAccounts(values, { ...user, ...branchScope(user) }) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "AGENT", "BRANCH_MANAGER");
    verifyCsrf(request);
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    if (!key.success) throw new ValidationError("A valid Idempotency-Key header is required.");
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ValidationError("Request body must be valid JSON."); }
    const { data, replayed } = await openAccount(body, { ...user, ...branchScope(user) }, key.data);
    // 201 for a new account; 200 with the original result for a replayed Idempotency-Key.
    return NextResponse.json({ data }, { status: replayed ? 200 : 201 });
  } catch (error) { return errorResponse(error); }
}
