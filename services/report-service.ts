import 'server-only';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { setRlsContext } from '@/lib/db/rls-context';
import { NotAuthorizedError, ValidationError } from '@/lib/db/errors';
import type { AuthenticatedUser } from '@/lib/auth/rbac';
import type { ReportRequest, ReportResult, BranchScope } from '@/lib/report/report-handler';
import { auditReportAccess } from '@/lib/report/report-handler';

export type FdReportRow = Record<string, string | number | null>;
const filtersSchema = z.object({
  from: z.string().date().optional(), to: z.string().date().optional(),
  branchId: z.string().uuid().optional(), planId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE','MATURED','CLOSED']).optional(),
  format: z.enum(['json','csv']).default('json'),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  sort: z.enum(['start_date','principal_amount','next_interest_date','estimated_next_payout']).optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to,
  'From date must precede to date.');
/** Parses request filters without a transaction or database access. */
export function parseFdReportFilters(params: URLSearchParams): ReportRequest {
  return filtersSchema.parse(Object.fromEntries(params));
}
function validateScope(scope: BranchScope, user: AuthenticatedUser, filters: ReportRequest) {
  if (!['ADMIN','CENTRAL_OPS','AUDITOR','BRANCH_MANAGER'].includes(user.roleName)) throw new NotAuthorizedError();
  if (user.roleName === 'BRANCH_MANAGER' && (!user.branchId || user.branchId !== scope.branchId)) throw new NotAuthorizedError();
  if (scope.branchId && filters.branchId && scope.branchId !== filters.branchId) throw new NotAuthorizedError();
}

/** One read transaction owns scope, exact totals, all CSV rows and access audit. */
export async function getActiveFdsReport(input: ReportRequest, scope: BranchScope,
  user: AuthenticatedUser): Promise<ReportResult<FdReportRow>> {
  const filters = filtersSchema.parse(input);
  validateScope(scope,user,filters);
  return withTransaction(async tx => {
    await setRlsContext(tx,user);
    const values = [scope.branchId ?? filters.branchId ?? null, filters.planId ?? null,
      filters.status ?? null, filters.from ?? null, filters.to ?? null];
    const where = `WHERE ($1::uuid IS NULL OR branch_id=$1) AND ($2::uuid IS NULL OR fd_plan_id=$2)
      AND ($3::text IS NULL OR fd_status=$3) AND ($4::date IS NULL OR start_date >= $4)
      AND ($5::date IS NULL OR maturity_date <= $5)`;
    const columns = `fd_id,account_id,account_number,branch_id,branch_name,fd_plan_id,product_name,
      tenure_months,principal_amount,interest_rate_at_opening,start_date::text,maturity_date::text,
      next_interest_date::text,fd_status,holder_names,holder_count,estimated_next_payout`;
    const sort = filters.sort ?? 'next_interest_date'; // validated enum
    const totals = (await tx.query(`SELECT count(*)::int AS n,
      COALESCE(sum(principal_amount),0)::text AS principal,
      COALESCE(sum(estimated_next_payout),0)::text AS payout FROM vw_rpt03_active_fds ${where}`,values)).rows[0];
    if (filters.format === 'csv' && totals.n > 10000) throw new ValidationError('Narrow the filters to export at most 10000 rows.');
    const rows = (await tx.query<FdReportRow>(`SELECT ${columns} FROM vw_rpt03_active_fds ${where}
      ORDER BY ${sort} DESC,fd_id LIMIT $6 OFFSET $7`,[...values,
        filters.format === 'csv' ? 10000 : filters.pageSize, filters.format === 'csv' ? 0 : (filters.page-1)*filters.pageSize])).rows;
    await auditReportAccess(user,'RPT-03',filters,tx);
    return { reportName:'Active Fixed Deposits', rows, grandTotal:{ principal_amount:totals.principal,estimated_next_payout:totals.payout },
      filters, generatedAt:new Date().toISOString(), requestedBy:user.userId, totalRows:totals.n,
      page:filters.page, pageSize:filters.pageSize };
  },{ isolationLevel:'REPEATABLE READ' });
}

/** One read transaction filters branch detail BEFORE aggregation and access audit. */
export async function getInterestDistributionReport(input: ReportRequest, scope: BranchScope,
  user: AuthenticatedUser): Promise<ReportResult<FdReportRow>> {
  const filters = filtersSchema.parse(input);
  validateScope(scope,user,filters);
  return withTransaction(async tx => {
    await setRlsContext(tx,user);
    // Use only leaf rows of the existing rollup view; regenerate scoped totals.
    const values = [scope.branchId ?? filters.branchId ?? null, filters.from ?? null, filters.to ?? null,
      filters.planId ?? null];
    const rows = (await tx.query<FdReportRow>(`SELECT cycle_date::text,savings_plan_name,fd_product_name,branch_id,branch_name,
      sum(distribution_count)::text AS distribution_count, sum(total_interest)::text AS total_interest,
      (sum(total_interest)/NULLIF(sum(distribution_count),0))::numeric(15,2)::text AS avg_interest,
      min(min_interest)::text AS min_interest,max(max_interest)::text AS max_interest
      FROM vw_rpt04_interest_distribution v
      WHERE v.branch_id IS NOT NULL AND ($1::uuid IS NULL OR v.branch_id=$1)
        AND ($2::date IS NULL OR cycle_date >= $2) AND ($3::date IS NULL OR cycle_date <= $3)
        AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM savings_plan p WHERE p.plan_id=$4 AND p.plan_name=v.savings_plan_name))
      GROUP BY ROLLUP ((cycle_date),(savings_plan_name),(fd_product_name),(branch_id,branch_name))
      ORDER BY cycle_date DESC NULLS LAST,savings_plan_name NULLS LAST,fd_product_name NULLS LAST,branch_name NULLS LAST`,values)).rows;
    const total = rows.find(row => row.cycle_date === null && row.savings_plan_name === null);
    if (filters.format === 'csv' && rows.length > 10000) throw new ValidationError('Narrow the filters to export at most 10000 rows.');
    const visibleRows = filters.format === 'csv' ? rows : rows.slice((filters.page-1)*filters.pageSize,filters.page*filters.pageSize);
    await auditReportAccess(user,'RPT-04',filters,tx);
    return { reportName:'Monthly Interest Distribution', rows:visibleRows, filters,
      grandTotal:{ total_interest:String(total?.total_interest ?? '0.00') },
      generatedAt:new Date().toISOString(), requestedBy:user.userId, totalRows:rows.length,
      page:filters.page, pageSize:filters.pageSize };
  },{ isolationLevel:'REPEATABLE READ' });
}
