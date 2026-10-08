import { NextResponse, NextRequest } from 'next/server';
import { branchScope, requireUser, requireRole } from '../../../../lib/auth/rbac';
import { getInterestDistributionReport } from '../../../../services/report-service';
import { auditReportAccess } from '../../../../lib/report/report-handler';
import { streamCsv } from '../../../../lib/report/csv-export';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN');
    
    const scope = branchScope(user);
    const url = new URL(request.url);
    const filters = {
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      branchId: url.searchParams.get('branchId') || undefined,
      planId: url.searchParams.get('planId') || undefined,
      format: (url.searchParams.get('format') || 'json') as 'json' | 'csv',
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 100,
    };
    
    const result = await getInterestDistributionReport(filters, scope, user.userId);
    
    await auditReportAccess(user, 'RPT-04', filters);
    
    if (filters.format === 'csv') {
      return streamCsv(result);
    }
    
    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error generating report:', error);
    if (error.name === 'NotAuthorizedError' || error.message.includes('role')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: error.message } }, { status: 403 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate report' } }, { status: 500 });
  }
}
