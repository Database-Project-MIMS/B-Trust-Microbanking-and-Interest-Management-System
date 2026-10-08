import { pool } from '../lib/db';
import type { ReportRequest, ReportResult, BranchScope } from '../lib/report/report-handler';
import { buildScopeClause, allowListed } from '../lib/report/report-handler';

export async function getActiveFdsReport(
  filters: ReportRequest,
  scope: BranchScope,
  requestedBy: string
): Promise<ReportResult<any>> {
  const params: unknown[] = [];
  let paramIdx = 1;
  const conditions: string[] = [];

  const { clause, params: scopeParams } = buildScopeClause(scope, paramIdx);
  if (clause) {
    conditions.push(`1=1 ${clause}`); // buildScopeClause expects a leading " AND " or we can just append it
    params.push(...scopeParams);
    paramIdx += scopeParams.length;
  }

  if (filters.branchId && scope.branchId === null) {
    conditions.push(`branch_id = $${paramIdx++}`);
    params.push(filters.branchId);
  }

  if (filters.planId) {
    conditions.push(`fd_plan_id = $${paramIdx++}`);
    params.push(filters.planId);
  }

  if (filters.status) {
    conditions.push(`fd_status = $${paramIdx++}`);
    params.push(filters.status);
  }

  if (filters.from) {
    conditions.push(`start_date >= $${paramIdx++}`);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(`maturity_date <= $${paramIdx++}`);
    params.push(filters.to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = allowListed(filters.sort, ['start_date', 'principal_amount', 'next_interest_date', 'estimated_next_payout'], 'next_interest_date');

  const query = `
    SELECT *
    FROM vw_rpt03_active_fds
    ${whereClause}
    ORDER BY ${sortCol} DESC
  `;

  const { rows } = await pool.query(query, params);

  // Calculate grand totals manually or through SQL. We'll do it manually here for simplicity,
  // since the view doesn't use ROLLUP.
  let grandTotalPrincipal = 0;
  let grandTotalEstimatedPayout = 0;
  const subtotals: Record<string, { principal: number, payout: number }> = {};

  for (const row of rows) {
    const principal = Number(row.principal_amount) || 0;
    const payout = Number(row.estimated_next_payout) || 0;
    const planName = row.product_name;

    grandTotalPrincipal += principal;
    grandTotalEstimatedPayout += payout;

    if (!subtotals[planName]) {
      subtotals[planName] = { principal: 0, payout: 0 };
    }
    subtotals[planName].principal += principal;
    subtotals[planName].payout += payout;
  }

  const formattedSubtotals: Record<string, string> = {};
  for (const [plan, vals] of Object.entries(subtotals)) {
    formattedSubtotals[plan] = `Principal: ${vals.principal.toFixed(2)} | Payout: ${vals.payout.toFixed(2)}`;
  }

  return {
    reportName: 'Active Fixed Deposits',
    rows,
    subtotals: formattedSubtotals,
    grandTotal: { 
      principal: grandTotalPrincipal.toFixed(2), 
      payout: grandTotalEstimatedPayout.toFixed(2) 
    },
    filters,
    generatedAt: new Date().toISOString(),
    requestedBy,
    totalRows: rows.length,
    page: filters.page || 1,
    pageSize: filters.pageSize || rows.length || 100,
  };
}

export async function getInterestDistributionReport(
  filters: ReportRequest,
  scope: BranchScope,
  requestedBy: string
): Promise<ReportResult<any>> {
  const params: unknown[] = [];
  let paramIdx = 1;
  const conditions: string[] = [];

  const { clause, params: scopeParams } = buildScopeClause(scope, paramIdx);
  if (clause) {
    conditions.push(`1=1 ${clause}`);
    params.push(...scopeParams);
    paramIdx += scopeParams.length;
  }

  if (filters.branchId && scope.branchId === null) {
    conditions.push(`branch_id = $${paramIdx++}`);
    params.push(filters.branchId);
  }

  if (filters.planId) {
    conditions.push(`savings_plan_name = $${paramIdx++}`);
    params.push(filters.planId);
  }

  if (filters.from) {
    conditions.push(`cycle_date >= $${paramIdx++}`);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(`cycle_date <= $${paramIdx++}`);
    params.push(filters.to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT *
    FROM vw_rpt04_interest_distribution
    ${whereClause}
    ORDER BY cycle_date DESC NULLS LAST, savings_plan_name NULLS LAST, fd_product_name NULLS LAST, branch_name NULLS LAST
  `;

  const { rows } = await pool.query(query, params);

  return {
    reportName: 'Monthly Interest Distribution',
    rows,
    filters,
    generatedAt: new Date().toISOString(),
    requestedBy,
    totalRows: rows.length,
    page: filters.page || 1,
    pageSize: filters.pageSize || rows.length || 100,
  };
}
