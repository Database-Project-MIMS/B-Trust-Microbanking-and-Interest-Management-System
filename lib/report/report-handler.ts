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

import { writeAuditEvent } from '../../services/audit-service';
import type { AuthenticatedUser } from '../../lib/auth/rbac';
import { pool } from '../../lib/db';

export async function auditReportAccess(
  user: AuthenticatedUser,
  reportName: string,
  filters: ReportRequest
): Promise<void> {
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
    ipAddress: '127.0.0.1',
  }, pool);
}
