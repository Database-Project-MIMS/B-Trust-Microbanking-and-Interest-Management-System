import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import {
  createAgentSchema,
  organizationListQuerySchema,
} from "@/lib/validation/organization";
import { createAgent, listAgents } from "@/services/agent-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER");

    const url = new URL(request.url);
    const query = organizationListQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
    });
    const scope = branchScope(user);
    const agents = await listAgents(scope.branchId, query.status);

    return NextResponse.json({ data: agents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN", "BRANCH_MANAGER");
    verifyCsrf(request);

    const input = createAgentSchema.parse(await request.json());
    const scope = branchScope(user);
    const agent = await createAgent(input, scope.branchId);

    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
