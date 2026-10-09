import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/rbac";
import { verifyCsrf } from "@/lib/auth/csrf";
import { updateFdProduct } from "@/services/fd-product-service";
import { z } from 'zod';
import { errorResponse } from '@/lib/http/error-response';

const updateSchema = z.object({
  interestRate: z.string().optional(), status: z.string().optional(),
  description: z.string().max(255).optional(),
}).strict().refine(value => Object.keys(value).length > 0);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(request);
    requireRole(user, "ADMIN");
    verifyCsrf(request);

    const body = updateSchema.parse(await request.json());
    const { interestRate, status, description } = body;

    // Validate interestRate if provided (must be a fraction between 0 and 1, exclusive of 0, inclusive of 1)
    if (interestRate !== undefined && interestRate !== null) {
      const rate = typeof interestRate === "string" ? interestRate : "";
      if (!/^0\.(?=.*[1-9])\d{1,4}$|^1(?:\.0{1,4})?$/.test(rate)) {
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

    const updatedProduct = await updateFdProduct(id, {
      interestRate: interestRate ? String(interestRate) : undefined,
      status: status ?? undefined,
      description: description ?? undefined,
    });

    return NextResponse.json({ data: updatedProduct });
  } catch (error) {
    return errorResponse(error);
  }
}
