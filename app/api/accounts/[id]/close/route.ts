import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";

/** Closing an account (BR-18: zero balance, no active FD) is a Phase 4 rule; this route is a deliberate stub. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "BRANCH_MANAGER");
    verifyCsrf(request);
    return NextResponse.json(
      { error: { code: "NOT_IMPLEMENTED", message: "Account closure is not available yet." } },
      { status: 501 },
    );
  } catch (error) { return errorResponse(error); }
}
