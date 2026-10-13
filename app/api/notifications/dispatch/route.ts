import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { NotAuthenticatedError } from "@/lib/db";
import { errorResponse } from "@/lib/http/error-response";
import { dispatchPending } from "@/services/notification-service";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Vercel Cron presents `Authorization: Bearer $CRON_SECRET`; a manual caller may present NOTIFICATION_WORKER_TOKEN. */
function authenticateSweeper(request: NextRequest): void {
  const presented = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1] ?? "";
  const allowed = [process.env.CRON_SECRET, process.env.NOTIFICATION_WORKER_TOKEN].filter((v): v is string => Boolean(v));
  const ok = presented.length > 0 && allowed.some(secret => {
    const a = Buffer.from(presented), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!ok) throw new NotAuthenticatedError();
}

async function sweep(request: NextRequest): Promise<Response> {
  try {
    authenticateSweeper(request);
    return Response.json({ data: await dispatchPending({ limit: 25 }) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Retry sweep for the outbox (Vercel Cron issues GET). */
export const GET = sweep;
/** Same sweep for external schedulers. */
export const POST = sweep;
