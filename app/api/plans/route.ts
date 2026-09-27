import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { listSavingsPlans } from "@/services/savings-plan-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireUser(request);
    const plans = await listSavingsPlans();
    return NextResponse.json({ data: plans });
  } catch (error) {
    return errorResponse(error);
  }
}
