import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { ValidationError } from '@/lib/db';
import { errorResponse } from '@/lib/http/error-response';
import { auditReportAccess, type ReportRequest } from '@/lib/report/report-handler';
import { streamCsv } from '@/lib/report/csv-export';
import { getCustomerActivityReport } from '@/services/customer-activity-report-service';

function optionalString(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value === null || value === '' ? undefined : value;
}

function positiveInt(params: URLSearchParams, key: string, fallback: number): number {
  const raw = optionalString(params, key);
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new ValidationError(`Invalid ${key}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new ValidationError(`Invalid ${key}.`);
  return value;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN');

    const params = request.nextUrl.searchParams;
    const format = optionalString(params, 'format') ?? 'json';
    if (format !== 'json' && format !== 'csv') {
      throw new ValidationError('Format must be json or csv.');
    }
    const filters: ReportRequest = {
      from: optionalString(params, 'from'),
      to: optionalString(params, 'to'),
      branchId: optionalString(params, 'branchId'),
      accountId: optionalString(params, 'accountId'),
      planId: optionalString(params, 'planId'),
      status: optionalString(params, 'status'),
      sort: optionalString(params, 'sort'),
      format,
      page: positiveInt(params, 'page', 1),
      pageSize: positiveInt(params, 'pageSize', 25),
    };
    const result = await getCustomerActivityReport(filters, user);
    await auditReportAccess(user, 'customer-activity', result.filters);
    return format === 'csv'
      ? streamCsv(result)
      : NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
