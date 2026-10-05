import { NextRequest, NextResponse } from "next/server";
import { branchScope, requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import {
  createBranchSchema,
  organizationListQuerySchema,
} from "@/lib/validation/organization";
import { createBranch, listBranches } from "@/services/branch-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR");

    const url = new URL(request.url);
    const query = organizationListQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
    });
    const scope = branchScope(user);
    const branches = await listBranches(scope.branchId, query.status);

    return NextResponse.json({ data: branches });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN");
    verifyCsrf(request);

    const input = createBranchSchema.parse(await request.json());
    const branch = await createBranch(input);

    return NextResponse.json({ data: branch }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
