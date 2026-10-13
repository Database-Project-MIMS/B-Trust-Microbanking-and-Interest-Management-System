import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { recordInterestRunRequest } from '@/services/interest-request-service';
import { errorResponse } from '@/lib/http/error-response';
import { NotAuthenticatedError, ValidationError } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Secret-only scheduler entry; manual runs use the CSRF-protected POST /api/interest-runs. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const secret = process.env.CRON_SECRET;
    const supplied = Buffer.from(request.headers.get('authorization') ?? '');
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new NotAuthenticatedError();
    }
    if ([...request.nextUrl.searchParams].length) {
      throw new ValidationError('The scheduler accepts no parameters.');
    }
    const now = new Date();
    // Match the database's authoritative timezone, including UTC/Colombo day boundaries.
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find(value => value.type === type)?.value;
    const cycleDate = `${part('year')}-${part('month')}-${part('day')}`;
    const result = await recordInterestRunRequest(
      { cycleDate, dryRun: false }, { userId: null, actorType: 'SYSTEM' },
    );
    return Response.json({ data: {
      ...result, triggeredBy: 'VERCEL_CRON', triggeredAt: now.toISOString(),
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
