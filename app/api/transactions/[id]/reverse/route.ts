import { NextRequest } from 'next/server';
import { requireUser, requireRole, branchScope } from '@/lib/auth/rbac';
import { pool, withTransaction, NotFoundError, BusinessRuleError } from '@/lib/db';
import { auditReversal } from '@/services/audit-service';

/**
 * POST /api/transactions/[id]/reverse
 * Roles: BRANCH_MANAGER, ADMIN only.
 * Branch scope: BRANCH_MANAGER can only reverse transactions belonging to their branch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  try {
    requireRole(user, 'BRANCH_MANAGER', 'ADMIN');
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const scope = branchScope(user);
  const body = await request.json().catch(() => ({})) as { reason?: string };
  const reason = body.reason?.trim() ?? '';

  if (!reason) {
    return Response.json(
      { error: { code: 'VALIDATION_FAILED', message: 'A reason is required to reverse a transaction.' } },
      { status: 400 }
    );
  }

  const ipAddress = request.headers.get('x-forwarded-for') ?? '127.0.0.1';

  return await withTransaction(async (tx) => {
    // Verify the transaction exists and (if branch-scoped) belongs to this branch
    const branchClause = scope.branchId ? 'AND a.branch_id = $2' : '';
    const txParams: unknown[] = [id];
    if (scope.branchId) txParams.push(scope.branchId);

    const txRes = await tx.query<{
      transaction_id: string;
      transaction_type: string;
      account_id: string;
      amount: string;
      is_reversal: boolean;
    }>(
      `SELECT t.transaction_id, t.transaction_type, t.account_id, t.amount::text,
              (t.reversal_of_transaction_id IS NOT NULL) AS is_reversal
       FROM transaction t
       JOIN account a ON a.account_id = t.account_id
       WHERE t.transaction_id = $1 ${branchClause}`,
      txParams
    );

    if (txRes.rows.length === 0) {
      throw new NotFoundError('Transaction');
    }

    const txRow = txRes.rows[0];

    if (txRow?.is_reversal) {
      throw new BusinessRuleError('CANNOT_REVERSE_REVERSAL', 'A reversal transaction cannot itself be reversed.');
    }

    // Check that sp_reverse_transaction exists; if not, raise a clear error
    const procCheck = await tx.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'sp_reverse_transaction'
       ) AS exists`
    );

    if (!procCheck.rows[0]?.exists) {
      // M4's procedure not yet merged; scaffold route returns 503
      return Response.json(
        { error: { code: 'NOT_AVAILABLE', message: 'Reversal procedure is not yet available. Dependency P03-M04-T04 is pending.' } },
        { status: 503 }
      );
    }

    // Call M4's reversal procedure
    const revRes = await tx.query<{ p_reversal_id: string }>(
      `CALL sp_reverse_transaction($1, $2, $3, NULL)`,
      [id, user.userId, reason]
    );

    const reversalId: string = revRes.rows[0]?.p_reversal_id ?? id;

    // Audit the reversal
    await auditReversal({
      userId: user.userId,
      originalTransactionId: id,
      reversalTransactionId: reversalId ?? id,
      reason,
      ipAddress,
    }, tx);

    return Response.json({ data: { reversalTransactionId: reversalId, originalTransactionId: id } });
  });
}
