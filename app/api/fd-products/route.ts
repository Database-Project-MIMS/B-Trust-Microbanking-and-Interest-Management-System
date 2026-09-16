import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { listFdProducts } from "@/services/fd-product-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    // Any authenticated user can view products
    
    const products = await listFdProducts();
    return NextResponse.json({ data: products });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
