import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { listParameters } from "@/services/parameter-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN");

    const parameters = await listParameters();
    return NextResponse.json({ data: parameters });
  } catch (error) {
    return errorResponse(error);
  }
}
