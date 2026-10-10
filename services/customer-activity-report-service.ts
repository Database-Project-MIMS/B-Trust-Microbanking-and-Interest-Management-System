import { withTransaction, ValidationError, NotAuthorizedError } from '@/lib/db';
import { setRlsContext } from '@/lib/db/rls-context';
import { allowListed, type ReportRequest, type ReportResult } from '@/lib/report/report-handler';
import type { AuthenticatedUser } from '@/lib/auth/rbac';

export interface CustomerActivityRow {
  customer_id: string;
  full_name: string;
  branch_id: string;
  account_count: number;
  deposits: string;
  withdrawals: string;
  interest: string;
  net: string;
}

interface TotalRow {
  total_rows: string;
  deposits: string;
  withdrawals: string;
  interest: string;
  net: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['ACTIVE', 'FROZEN', 'CLOSED']);
const SORT_COLUMNS = {
  name: 'full_name',
  deposits: 'deposits',
  withdrawals: 'withdrawals',
  interest: 'interest',
  net: 'net',
} as const;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateFilters(filters: ReportRequest): void {
  if (filters.from && !validDate(filters.from)) throw new ValidationError('Invalid from date.');
  if (filters.to && !validDate(filters.to)) throw new ValidationError('Invalid to date.');
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new ValidationError('From date must not follow to date.');
  }
  for (const value of [filters.branchId, filters.accountId, filters.planId]) {
    if (value && !UUID.test(value)) throw new ValidationError('Invalid report identifier.');
  }
  if (filters.status && !STATUSES.has(filters.status)) {
    throw new ValidationError('Invalid account status.');
  }
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ValidationError('Invalid report pagination.');
  }
}

const AGGREGATE_SQL = `
  WITH scoped AS (
    SELECT customer_id, full_name, branch_id, account_id,
           activity_type, effective_amount, transaction_date
    FROM vw_rpt05_customer_activity
    WHERE ($1::uuid IS NULL OR branch_id = $1)
      AND ($2::uuid IS NULL OR account_branch_id = $2)
      AND ($3::uuid IS NULL OR account_id = $3)
      AND ($4::uuid IS NULL OR plan_id = $4)
      AND ($5::varchar IS NULL OR account_status = $5)
  ),
  per_customer AS (
    SELECT customer_id, full_name, branch_id,
           COUNT(DISTINCT account_id)::integer AS account_count,
           COALESCE(SUM(effective_amount) FILTER (
             WHERE activity_type = 'DEPOSIT'
               AND ($6::date IS NULL OR transaction_date >= ($6::date::timestamp AT TIME ZONE 'Asia/Colombo'))
               AND ($7::date IS NULL OR transaction_date < (($7::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo'))
           ), 0)::numeric(15,2) AS deposits,
           COALESCE(SUM(effective_amount) FILTER (
             WHERE activity_type = 'WITHDRAWAL'
               AND ($6::date IS NULL OR transaction_date >= ($6::date::timestamp AT TIME ZONE 'Asia/Colombo'))
               AND ($7::date IS NULL OR transaction_date < (($7::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo'))
           ), 0)::numeric(15,2) AS withdrawals,
           COALESCE(SUM(effective_amount) FILTER (
             WHERE activity_type = 'INTEREST_CREDIT'
               AND ($6::date IS NULL OR transaction_date >= ($6::date::timestamp AT TIME ZONE 'Asia/Colombo'))
               AND ($7::date IS NULL OR transaction_date < (($7::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo'))
           ), 0)::numeric(15,2) AS interest
    FROM scoped
    GROUP BY customer_id, full_name, branch_id
  ),
  activity AS (
    SELECT customer_id, full_name, branch_id, account_count,
           deposits, withdrawals, interest,
           (deposits - withdrawals + interest)::numeric(15,2) AS net
    FROM per_customer
  )
`;

function amounts(row: Pick<TotalRow, 'deposits' | 'withdrawals' | 'interest' | 'net'>) {
  return {
    deposits: row.deposits,
    withdrawals: row.withdrawals,
    interest: row.interest,
    net: row.net,
  };
}

/** Reads one consistent, branch-scoped report snapshot inside a read-only transaction. */
export async function getCustomerActivityReport(
  filters: ReportRequest,
  user: AuthenticatedUser,
): Promise<ReportResult<CustomerActivityRow>> {
  validateFilters(filters);
  if (user.roleName === 'BRANCH_MANAGER' && !user.branchId) {
    throw new NotAuthorizedError('A branch profile is required.');
  }
  if (user.roleName === 'BRANCH_MANAGER' && filters.branchId &&
      filters.branchId !== user.branchId) {
    throw new NotAuthorizedError('Branch filter is outside your scope.');
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const branchId = user.roleName === 'BRANCH_MANAGER' ? user.branchId : filters.branchId ?? null;
  const accountBranchId = user.roleName === 'BRANCH_MANAGER' ? user.branchId : null;
  const params = [
    branchId, accountBranchId, filters.accountId ?? null,
    filters.planId ?? null, filters.status ?? null,
    filters.from ?? null, filters.to ?? null,
  ];
  const sort = allowListed(filters.sort, Object.keys(SORT_COLUMNS), 'name') as keyof typeof SORT_COLUMNS;
  const sortColumn = SORT_COLUMNS[sort];
  const generatedAt = new Date().toISOString();

  return withTransaction(async (tx) => {
    await setRlsContext(tx, {
      userId: user.userId,
      branchId: user.branchId,
      roleName: user.roleName,
    });
    const totals = await tx.query<TotalRow>(
      `${AGGREGATE_SQL}
       SELECT COUNT(*)::text AS total_rows,
              COALESCE(SUM(deposits), 0)::numeric(15,2) AS deposits,
              COALESCE(SUM(withdrawals), 0)::numeric(15,2) AS withdrawals,
              COALESCE(SUM(interest), 0)::numeric(15,2) AS interest,
              COALESCE(SUM(net), 0)::numeric(15,2) AS net
       FROM activity`,
      params,
    );
    const rows = await tx.query<CustomerActivityRow>(
      `${AGGREGATE_SQL}
       SELECT customer_id, full_name, branch_id, account_count,
              deposits, withdrawals, interest, net
       FROM activity
       ORDER BY ${sortColumn} ${sort === 'name' ? 'ASC' : 'DESC'}, customer_id ASC
       LIMIT $8 OFFSET $9`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    const subtotal = await tx.query<TotalRow>(
      `${AGGREGATE_SQL}, page_rows AS (
         SELECT deposits, withdrawals, interest, net
         FROM activity
         ORDER BY ${sortColumn} ${sort === 'name' ? 'ASC' : 'DESC'}, customer_id ASC
         LIMIT $8 OFFSET $9
       )
       SELECT COUNT(*)::text AS total_rows,
              COALESCE(SUM(deposits), 0)::numeric(15,2) AS deposits,
              COALESCE(SUM(withdrawals), 0)::numeric(15,2) AS withdrawals,
              COALESCE(SUM(interest), 0)::numeric(15,2) AS interest,
              COALESCE(SUM(net), 0)::numeric(15,2) AS net
       FROM page_rows`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    const pageTotal = subtotal.rows[0];
    const grand = totals.rows[0];
    if (!pageTotal || !grand) throw new Error('Report totals unavailable');
    return {
      reportName: 'customer-activity',
      rows: rows.rows,
      subtotals: amounts(pageTotal),
      grandTotal: amounts(grand),
      filters: { ...filters, branchId: branchId ?? undefined, page, pageSize },
      generatedAt,
      requestedBy: user.username,
      totalRows: Number(grand.total_rows),
      page,
      pageSize,
    };
  }, { isolationLevel: 'REPEATABLE READ' });
}
