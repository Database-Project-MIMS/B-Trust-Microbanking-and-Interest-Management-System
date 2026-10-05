import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";
import {
  savingsPlanIdSchema,
  updateSavingsPlanSchema,
} from "@/lib/validation/savings-plan";
import { updateSavingsPlan } from "@/services/savings-plan-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN", "CENTRAL_OPS");
    verifyCsrf(request);

    const { id: rawId } = await params;
    const id = savingsPlanIdSchema.parse(rawId);
    const input = updateSavingsPlanSchema.parse(await request.json());
    const plan = await updateSavingsPlan(id, input);

    return NextResponse.json({ data: plan });
  } catch (error) {
    return errorResponse(error);
  }
}
