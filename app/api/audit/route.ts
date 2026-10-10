import { requireRole, requireUser } from '@/lib/auth/rbac';
import { searchAuditLog } from '@/services/audit-query-service';
import { errorResponse } from '@/lib/http/error-response';
import { ZodError } from 'zod';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, 'AUDITOR', 'ADMIN');
    const params=request.nextUrl.searchParams;
    if([...params.keys()].some(key=>params.getAll(key).length!==1))return Response.json({error:{code:'BAD_REQUEST',message:'Repeated query parameters are invalid.'}},{status:400});
    return Response.json(await searchAuditLog(Object.fromEntries(request.nextUrl.searchParams)));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Invalid query parameters.' } }, { status: 400 });
    }
    return errorResponse(error);
  }
}
