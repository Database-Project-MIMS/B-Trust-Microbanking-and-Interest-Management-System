import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { verifyCsrf } from '@/lib/auth/csrf';
import { errorResponse } from '@/lib/http/error-response';
import { updateParameter } from '@/services/parameter-service';
import { query } from '@/lib/db';

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

    const old = await query<{ param_id: string; param_value: string }>(
      `SELECT param_id, param_value FROM system_parameter WHERE param_key = $1`,
      [key],
    );
    if (old.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Parameter not found' } },
        { status: 404 },
      );
    }

    const updated = await updateParameter(key, newValue.trim());

    return NextResponse.json({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
