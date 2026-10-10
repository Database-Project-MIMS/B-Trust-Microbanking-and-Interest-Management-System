import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireRole } from '@/lib/auth/rbac';
import { verifyCsrf } from '@/lib/auth/csrf';
import { errorResponse } from '@/lib/http/error-response';
import { verifyDocument } from '@/services/customer-document-service';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); requireRole(user, 'AGENT', 'BRANCH_MANAGER');
    verifyCsrf(request);
    return NextResponse.json({ data: await verifyDocument((await context.params).id, user.userId) });
  } catch (error) { return errorResponse(error); }
}
