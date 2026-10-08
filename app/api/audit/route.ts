import { requireRole, requireUser } from '@/lib/auth/rbac';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  requireRole(user, 'AUDITOR', 'ADMIN');

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get('actorId') || null;
  const entityType = searchParams.get('entityType') || null;
  const entityId = searchParams.get('entityId') || null;
  const action = searchParams.get('action') || null;
  const from = searchParams.get('from') || null;
  const to = searchParams.get('to') || null;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

  const offset = (page - 1) * pageSize;

  const query = `
    SELECT log_id, user_id, actor_type, entity_type, entity_id, 
           action, old_values, new_values, ip_address, logged_at
    FROM audit_log
    WHERE ($1::uuid IS NULL OR user_id = $1)
      AND ($2::varchar IS NULL OR entity_type = $2)
      AND ($3::uuid IS NULL OR entity_id = $3)
      AND ($4::varchar IS NULL OR action = $4)
      AND ($5::timestamptz IS NULL OR logged_at >= $5)
      AND ($6::timestamptz IS NULL OR logged_at <= $6)
    ORDER BY logged_at DESC
    LIMIT $7 OFFSET $8
  `;

  try {
    const { rows } = await pool.query(query, [
      actorId,
      entityType,
      entityId,
      action,
      from,
      to,
      pageSize,
      offset
    ]);

    return Response.json({ data: rows, page, pageSize });
  } catch (error: any) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' } }, { status: 400 });
  }
}
