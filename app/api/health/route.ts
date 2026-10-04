import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const row = await queryOne<{ ok: number }>("SELECT 1 AS ok");
    const isOk = row?.ok === 1;
    
    // Await cookies for Next.js 15
    const cookieStore = await cookies();
    const hasSession = cookieStore.has("session");

    if (hasSession) {
      // Dynamic fallback until Task 1 is merged
      let poolMetrics = { totalCount: 0, idleCount: 0, waitingCount: 0 };
      try {
        const db = require("@/lib/db");
        if (db.getPoolMetrics) poolMetrics = db.getPoolMetrics();
      } catch {}

      const lastMig = await queryOne<{ filename: string }>("SELECT filename FROM schema_migration ORDER BY filename DESC LIMIT 1");
      return NextResponse.json({
        data: {
          status: isOk ? "ok" : "degraded",
          db: { connected: isOk, poolTotal: poolMetrics.totalCount, poolIdle: poolMetrics.idleCount, poolWaiting: poolMetrics.waitingCount },
          migrationsApplied: lastMig?.filename || null
        }
      });
    }

    return NextResponse.json({ data: { status: isOk ? "ok" : "degraded" } });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}