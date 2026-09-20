import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import {
  organizationIdSchema,
  updateBranchSchema,
} from "@/lib/validation/organization";
import { updateBranch } from "@/services/branch-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN");
    verifyCsrf(request);

    const { id: rawId } = await params;
    const id = organizationIdSchema.parse(rawId);
    const input = updateBranchSchema.parse(await request.json());
    const branch = await updateBranch(id, input);

    return NextResponse.json({ data: branch });
  } catch (error) {
    return errorResponse(error);
  }
}
