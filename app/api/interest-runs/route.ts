import { authenticateInterestWorker } from '@/lib/auth/worker-auth';
import { requireUser, requireRole } from '@/lib/auth/rbac';
import { verifyCsrf } from '@/lib/auth/csrf';
import { recordInterestRunRequest } from '@/services/interest-request-service';
import { errorResponse } from '@/lib/http/error-response';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let actor: { userId: string | null; actorType: 'USER' | 'SYSTEM' };
    if (request.cookies.get('mims_session')?.value) {
      const user = await requireUser(request);
      requireRole(user, 'CENTRAL_OPS', 'ADMIN');
      verifyCsrf(request);
      actor = { userId: user.userId, actorType: 'USER' };
    } else {
      await authenticateInterestWorker(request);
      actor = { userId: null, actorType: 'SYSTEM' };
    }
    const result = await recordInterestRunRequest(await request.json(), actor);
    return Response.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
