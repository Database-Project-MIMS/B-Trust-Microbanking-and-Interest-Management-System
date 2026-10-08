import { NextRequest, NextResponse } from "next/server";

export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get("Idempotency-Key") || null;
}

export function requireIdempotencyKey(request: NextRequest): string | NextResponse {
  const key = getIdempotencyKey(request);
  if (!key) {
    return NextResponse.json(
      { error: { code: "MISSING_IDEMPOTENCY_KEY", message: "Idempotency-Key header is required." } },
      { status: 400 }
    );
  }
  return key;
}
