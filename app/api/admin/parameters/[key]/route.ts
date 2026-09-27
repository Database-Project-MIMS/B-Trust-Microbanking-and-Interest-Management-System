import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateParameter, listParameters } from '@/services/parameter-service';
import { writeAuditEvent } from '@/services/audit-service';
import { query } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, { status: 401 });
  if (session.role !== 'ADMIN')
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'ADMIN role required' } }, { status: 403 });

  const body = await req.json() as { value?: unknown };
  const newValue = body?.value;

  if (typeof newValue !== 'string' || newValue.trim() === '')
    return NextResponse.json({ error: { code: 'VALIDATION', message: '`value` must be a non-empty string' } }, { status: 400 });

  const old = await query<{ param_id: string; param_value: string }>(
    `SELECT param_id, param_value FROM system_parameter WHERE param_key = $1`,
    [params.key]
  );
  if (old.rows.length === 0)
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Parameter not found' } }, { status: 404 });

  const updated = await updateParameter(params.key, newValue.trim());

  await writeAuditEvent({
    userId: session.userId,
    actorType: 'USER',
    entityType: 'system_parameter',
    entityId: old.rows[0].param_id,
    action: 'UPDATE',
    oldValues: { param_key: params.key, param_value: old.rows[0].param_value },
    newValues: { param_key: params.key, param_value: newValue.trim() },
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ data: updated });
}
