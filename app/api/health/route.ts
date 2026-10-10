import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { getHealthStatus } from "@/services/health-service";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    const data = await getHealthStatus(user);
    return NextResponse.json({ data }, { status: data.status === "ok" ? 200 : 503 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Health check unavailable." } },
      { status: 503 },
    );
  }
}
