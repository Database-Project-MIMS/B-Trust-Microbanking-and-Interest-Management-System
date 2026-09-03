import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

/**
 * GET /api/health — liveness and database connectivity check (NFR-REL-06).
 *
 * Public, but returns no schema detail, no version string and no driver error
 * text (NFR-SEC-05). Owned by Member 4 from Phase 1.
 */
export async function GET() {
  try {
    const row = await queryOne<{ ok: number }>("SELECT 1 AS ok");
    return NextResponse.json({ data: { status: row?.ok === 1 ? "ok" : "degraded" } });
  } catch {
    return NextResponse.json(
      { error: { code: "DB_UNAVAILABLE", message: "Service unavailable." } },
      { status: 503 },
    );
  }
}
