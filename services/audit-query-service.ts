import 'server-only';
import { z } from 'zod';
import { query } from '@/lib/db';

const timestamp = z.union([z.string().date(), z.string().datetime({ offset: true })]);
const filters = z.object({
  actorId: z.string().uuid().optional(),
  entityType: z.string().min(1).max(50).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().min(1).max(50).optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
  page: z.string().regex(/^[1-9]\d{0,5}$/).default('1').transform(Number),
  pageSize: z.string().regex(/^[1-9]\d{0,2}$/).default('20').transform(Number).pipe(z.number().max(100)),
}).strict().refine(value => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to));

interface AuditRow {
  log_id: string;
  user_id: string | null;
  actor_type: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  logged_at: Date;
}

/** Reads a validated, bounded audit page with a single parameterized query. */
export async function searchAuditLog(input: unknown): Promise<{ data: AuditRow[]; page: number; pageSize: number }> {
  const value = filters.parse(input);
  const data = await query<AuditRow>(
    `SELECT log_id, user_id, actor_type, entity_type, entity_id,
            action, old_values, new_values, ip_address, logged_at
     FROM audit_log
     WHERE ($1::uuid IS NULL OR user_id = $1)
       AND ($2::varchar IS NULL OR entity_type = $2)
       AND ($3::uuid IS NULL OR entity_id = $3)
       AND ($4::varchar IS NULL OR action = $4)
       AND ($5::timestamptz IS NULL OR logged_at >= $5)
       AND ($6::timestamptz IS NULL OR logged_at <= $6)
     ORDER BY logged_at DESC, log_id DESC LIMIT $7 OFFSET $8`,
    [value.actorId ?? null, value.entityType ?? null, value.entityId ?? null, value.action ?? null,
      value.from ?? null, value.to ?? null, value.pageSize, (value.page - 1) * value.pageSize],
  );
  return { data, page: value.page, pageSize: value.pageSize };
}
