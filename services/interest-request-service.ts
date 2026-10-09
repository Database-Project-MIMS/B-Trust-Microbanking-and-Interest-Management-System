import 'server-only';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { writeAuditEvent } from '@/services/audit-service';

const requestSchema = z.object({
  cycleDate: z.string().date(),
  dryRun: z.boolean(),
}).strict();

/** Records a validated request in one audit transaction; cycle execution remains separate. */
export async function recordInterestRunRequest(
  input: unknown,
  actor: { userId: string | null; actorType: 'USER' | 'SYSTEM' },
): Promise<{ status: 'STARTED' }> {
  const body = requestSchema.parse(input);
  await withTransaction(async tx => {
    await writeAuditEvent({
      ...actor,
      entityType: 'interest_run',
      entityId: null,
      action: 'INTEREST_RUN_INITIATED',
      newValues: { cycle_date: body.cycleDate, dry_run: body.dryRun },
    }, tx);
  });
  return { status: 'STARTED' };
}
