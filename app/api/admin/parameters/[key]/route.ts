import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { verifyCsrf } from '@/lib/auth/csrf';
import { errorResponse } from '@/lib/http/error-response';
import { updateParameter } from '@/services/parameter-service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<Response> {
  try {
    const user = await requireUser(req);
    requireRole(user, 'ADMIN');
    verifyCsrf(req);
    const { key } = await params;

    const body = await req.json() as { value?: unknown };
    const newValue = body?.value;

    if (typeof newValue !== 'string' || newValue.trim() === '') {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: '`value` must be a non-empty string' } },
        { status: 400 },
      );
    }

    const updated = await updateParameter(key, newValue.trim());

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
