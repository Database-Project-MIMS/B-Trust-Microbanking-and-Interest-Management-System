import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { updateFdProduct } from "@/services/fd-product-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(request);
    requireRole(user, "ADMIN");
    verifyCsrf(request);

    const body = await request.json();
    const { interestRate, status, description } = body;

    // Validate interestRate if provided (must be a fraction between 0 and 1, exclusive of 0, inclusive of 1)
    if (interestRate !== undefined && interestRate !== null) {
      const rateNum = parseFloat(interestRate);
      if (isNaN(rateNum) || rateNum <= 0 || rateNum > 1) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Interest rate must be a fraction between 0 and 1 (e.g. 0.1300)." } },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (status !== undefined && status !== null && status !== "ACTIVE" && status !== "INACTIVE") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Status must be ACTIVE or INACTIVE." } },
        { status: 400 }
      );
    }

    const updatedProduct = await updateFdProduct(params.id, {
      interestRate: interestRate ? String(interestRate) : undefined,
      status: status ?? undefined,
      description: description ?? undefined,
    });

    return NextResponse.json({ data: updatedProduct });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    
    const msg = error instanceof Error ? error.message : "An unexpected error occurred.";
    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: msg } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
