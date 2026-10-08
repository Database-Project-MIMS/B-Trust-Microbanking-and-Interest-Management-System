import { authenticateInterestWorker } from '@/lib/auth/worker-auth';
import { requireUser, requireRole } from '@/lib/auth/rbac';
import { writeAuditEvent } from '@/services/audit-service';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  let actor: { userId: string | null; actorType: 'USER' | 'SYSTEM' };
  
  try {
    const user = await requireUser(request);
    requireRole(user, 'CENTRAL_OPS', 'ADMIN');
    actor = { userId: user.userId, actorType: 'USER' };
  } catch (err) {
    try {
      const worker = await authenticateInterestWorker(request);
      actor = { userId: null, actorType: 'SYSTEM' };
    } catch (workerErr) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
  }
  
  const body = await request.json().catch(() => ({}));

  // Audit the run request
  await writeAuditEvent({
    userId: actor.userId,
    actorType: actor.actorType,
    entityType: 'interest_run',
    entityId: null,
    action: 'INTEREST_RUN_INITIATED',
    newValues: { cycle_date: body.cycleDate, dry_run: body.dryRun },
    ipAddress: request.headers.get('x-forwarded-for') ?? '127.0.0.1',
  }, pool);
  
  // M5's service would be called here
  
  return Response.json({ data: { status: 'STARTED' } });
}
