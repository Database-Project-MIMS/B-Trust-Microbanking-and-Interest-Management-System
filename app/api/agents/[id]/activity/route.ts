import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { organizationIdSchema } from "@/lib/validation/organization";
import { AGENT_ACTIVITY_ROLES, parseAgentActivityRange } from "@/lib/validation/agent-activity";
import { getAgentActivity } from "@/services/agent-service";

/** Authenticates each read; identity and scope are never accepted from query parameters. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    requireRole(user, ...AGENT_ACTIVITY_ROLES);
    const id = organizationIdSchema.parse((await context.params).id).toLowerCase();
    const range = parseAgentActivityRange(request.nextUrl.searchParams);
    const data = await getAgentActivity(id, range, user);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
