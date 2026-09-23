import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import {
  organizationIdSchema,
  updateAgentSchema,
} from "@/lib/validation/organization";
import { updateAgent } from "@/services/agent-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN", "BRANCH_MANAGER");
    verifyCsrf(request);

    const { id: rawId } = await params;
    const id = organizationIdSchema.parse(rawId);
    const input = updateAgentSchema.parse(await request.json());
    const scope = branchScope(user);
    const agent = await updateAgent(id, input, scope.branchId);

    return NextResponse.json({ data: agent });
  } catch (error) {
    return errorResponse(error);
  }
}
