import { NextRequest, NextResponse } from 'next/server';
import { recordInterestRunRequest } from '@/services/interest-request-service';
import { requireUser, requireRole } from '@/lib/auth/rbac';
import { errorResponse } from '@/lib/http/error-response';

/**
 * Vercel Cron endpoint — runs daily at midnight Asia/Colombo.
 *
 * Determines today's date in the bank timezone and delegates to the existing
 * `recordInterestRunRequest` service which processes all FDs whose
 * `next_interest_date <= today`. The service already handles:
 *   - per-FD transaction isolation (one failure doesn't roll back others)
 *   - duplicate-run prevention (UNIQUE on cycle_date)
 *   - savings interest, FD payouts, and maturity returns
 *
 * Security:
 * - Vercel Cron: Protected by Vercel's CRON_SECRET header verification.
 *   Vercel automatically sends an `Authorization: Bearer <CRON_SECRET>` header.
 * - Manual trigger: Allowed for ADMIN and CENTRAL_OPS roles via session cookie.
 * - All other roles or requests with invalid secrets receive 403 / 401.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    let actor: { userId: string | null; actorType: 'USER' | 'SYSTEM' };
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && token === cronSecret) {
      actor = { userId: null, actorType: 'SYSTEM' };
    } else if (request.cookies.get('mims_session')?.value) {
      const user = await requireUser(request);
      requireRole(user, 'ADMIN', 'CENTRAL_OPS');
      actor = { userId: user.userId, actorType: 'USER' };
    } else {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret.' } },
        { status: 401 }
      );
    }

    // --- Determine today in bank timezone ------------------------------------
    const bankTz = process.env.BANK_TIMEZONE ?? 'Asia/Colombo';
    const now = new Date();
    // Format as YYYY-MM-DD in the bank's timezone
    const cycleDate = now.toLocaleDateString('en-CA', { timeZone: bankTz });

    // --- Run the interest cycle for today ------------------------------------
    const result = await recordInterestRunRequest(
      { cycleDate, dryRun: false },
      actor
    );

    return NextResponse.json({
      data: {
        ...result,
        triggeredBy: actor.actorType === 'SYSTEM' ? 'VERCEL_CRON' : 'MANUAL_TRIGGER',
        triggeredAt: now.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
