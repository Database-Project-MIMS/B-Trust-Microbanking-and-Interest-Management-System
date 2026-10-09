import { NextRequest, NextResponse } from 'next/server';
import { branchScope, requireUser, requireRole } from '@/lib/auth/rbac';
import { getInterestDistributionReport, parseFdReportFilters } from '@/services/report-service';
import { streamCsv } from '@/lib/report/csv-export';
import { errorResponse } from '@/lib/http/error-response';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user,'BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','ADMIN');
    const filters = parseFdReportFilters(request.nextUrl.searchParams);
    const result = await getInterestDistributionReport(filters,branchScope(user),user);
    return filters.format === 'csv' ? streamCsv(result) : NextResponse.json({ data:result });
  } catch (error) { return errorResponse(error); }
}
