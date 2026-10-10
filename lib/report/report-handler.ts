export interface ReportRequest {
  from?: string;
  to?: string;
  branchId?: string;
  agentId?: string;
  accountId?: string;
  planId?: string;
  status?: string;
  format: 'json' | 'csv';
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: "asc" | "desc";
}

export interface ReportResult<T> {
  reportName: string;
  rows: T[];
  subtotals?: Record<string, string>;
  grandTotal?: Record<string, string>;
  filters: ReportRequest;
  generatedAt: string;
  requestedBy: string;
  totalRows: number;
  page: number;
  pageSize: number;
}

export interface BranchScope {
  branchId: string | null;
}

export function buildScopeClause(
  scope: BranchScope, 
  paramIndex: number
): { clause: string; params: unknown[] } {
  if (scope.branchId === null) {
    return { clause: '', params: [] };
  }
  return {
    clause: ` AND branch_id = $${paramIndex}`,
    params: [scope.branchId],
  };
}

export function allowListed(value: string | undefined, allowed: string[], defaultValue: string): string {
  if (!value) return defaultValue;
  return allowed.includes(value) ? value : defaultValue;
}

import type { AuthenticatedUser } from '../../lib/auth/rbac';
import type { Executor } from '../../lib/db';

/** Appends access auditing in the caller's transaction, or one standalone insert for legacy callers. */
export async function auditReportAccess(
  user: AuthenticatedUser,
  reportName: string,
  filters: ReportRequest,
  executor?: Executor
): Promise<void> {
  const { writeAuditEvent } = await import('../../services/audit-service');
  const writer = executor ?? (await import('../../lib/db')).pool;
  await writeAuditEvent({
    userId: user.userId,
    actorType: 'USER',
    entityType: 'report',
    entityId: null,
    action: 'REPORT_ACCESSED',
    newValues: {
      report_name: reportName,
      filters: filters as unknown as Record<string, unknown>,
      format: filters.format,
    },
  }, writer);
}
