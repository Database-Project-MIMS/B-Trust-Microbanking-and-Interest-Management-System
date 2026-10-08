import "server-only";
import { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import { withTransaction } from "@/lib/db";
import { NotAuthorizedError, ValidationError } from "@/lib/db/errors";
import { setRlsContext } from "@/lib/db/rls-context";
import { auditReportAccess } from "@/lib/report/report-handler";
import { RPT02_CSV_MAX_ROWS, RPT02_ROLES, rpt02QuerySchema, type Rpt02Query } from "@/lib/validation/account-summary-report";
import type { AccountSummaryChoices, AccountSummaryResult, AccountSummaryRow } from "@/types/account-summary-report";

const actorSchema = z.object({
  userId: z.string().uuid(), roleName: z.enum(RPT02_ROLES), branchId: z.string().uuid().nullable(),
});
type Tx = Parameters<typeof setRlsContext>[0];

// Fixed SQL expressions and directions: request text is only ever a lookup key, never interpolated.
const SORT_SQL = {
  accountNumber: "account_number", openingBalance: "opening_balance",
  closingBalance: "closing_balance", netMovement: "net_movement",
} as const;
const DIRECTION_SQL = { asc: "ASC", desc: "DESC" } as const;

/**
 * One row per account in scope, from vw_rpt02_account_summary.
 * $1 branch, $2 account, $3 plan, $4 status, $5 from, $6 to (Asia/Colombo calendar days, inclusive).
 * Opening = balance_before of the first posting (lowest ledger_seq) at or after the start, else the current
 * balance; closing = balance after the last posting (highest ledger_seq) before the end of the period, else
 * the opening balance. Both come from the stored running balance, never from re-summing the ledger.
 * Totals are net of reversals (a reversal sits in its original category with a negated amount); counts are
 * original postings, with reversals counted on their own.
 */
const SUMMARY_CTE = `
WITH bounds AS (
  SELECT ($5::date::timestamp AT TIME ZONE 'Asia/Colombo') AS lo,
         (($6::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo') AS hi
), per_account AS (
  SELECT v.account_id, v.account_number, v.branch_id, v.plan_name, v.account_status, v.current_balance,
    (array_agg(v.balance_before ORDER BY v.ledger_seq)
       FILTER (WHERE v.transaction_id IS NOT NULL AND v.transaction_date >= b.lo))[1] AS first_before,
    (array_agg(v.balance_after_effective ORDER BY v.ledger_seq DESC)
       FILTER (WHERE v.transaction_id IS NOT NULL AND v.transaction_date < b.hi))[1] AS last_after,
    COUNT(*) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.transaction_type = 'DEPOSIT') AS deposit_count,
    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.activity_type = 'DEPOSIT'), 0.00) AS deposit_total,
    COUNT(*) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.transaction_type = 'WITHDRAWAL') AS withdrawal_count,
    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.activity_type = 'WITHDRAWAL'), 0.00) AS withdrawal_total,
    COUNT(*) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.transaction_type = 'INTEREST_CREDIT') AS interest_count,
    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.activity_type = 'INTEREST_CREDIT'), 0.00) AS interest_total,
    COUNT(*) FILTER (WHERE v.transaction_date >= b.lo AND v.transaction_date < b.hi AND v.transaction_type = 'REVERSAL') AS reversal_count
  FROM vw_rpt02_account_summary v CROSS JOIN bounds b
  WHERE ($1::uuid IS NULL OR v.branch_id = $1)
    AND ($2::uuid IS NULL OR v.account_id = $2)
    AND ($3::uuid IS NULL OR v.plan_id = $3)
    AND ($4::varchar IS NULL OR v.account_status = $4)
  GROUP BY v.account_id, v.account_number, v.branch_id, v.plan_name, v.account_status, v.current_balance, b.lo, b.hi
), summary AS (
  SELECT p.account_id, p.account_number, p.branch_id, br.branch_code || ' — ' || br.branch_name AS branch_name,
         p.plan_name, p.account_status,
         COALESCE(p.first_before, p.current_balance) AS opening_balance,
         COALESCE(p.last_after, p.first_before, p.current_balance) AS closing_balance,
         COALESCE(p.last_after, p.first_before, p.current_balance) - COALESCE(p.first_before, p.current_balance) AS net_movement,
         p.deposit_count, p.deposit_total, p.withdrawal_count, p.withdrawal_total,
         p.interest_count, p.interest_total, p.reversal_count
  FROM per_account p JOIN branch br ON br.branch_id = p.branch_id
)`;

const ROW_COLUMNS = `
  account_id AS "accountId", account_number AS "accountNumber", branch_id AS "branchId", branch_name AS "branchName",
  plan_name AS "planName", account_status AS "accountStatus",
  opening_balance::text AS "openingBalance", closing_balance::text AS "closingBalance",
  deposit_count::text AS "depositCount", deposit_total::text AS "depositTotal",
  withdrawal_count::text AS "withdrawalCount", withdrawal_total::text AS "withdrawalTotal",
  interest_count::text AS "interestCount", interest_total::text AS "interestTotal",
  reversal_count::text AS "reversalCount", net_movement::text AS "netMovement"`;

const TOTAL_COLUMNS = `
  COUNT(*)::text AS "totalRows",
  COALESCE(SUM(opening_balance), 0.00)::text AS "openingBalance", COALESCE(SUM(closing_balance), 0.00)::text AS "closingBalance",
  COALESCE(SUM(deposit_count), 0)::text AS "depositCount", COALESCE(SUM(deposit_total), 0.00)::text AS "depositTotal",
  COALESCE(SUM(withdrawal_count), 0)::text AS "withdrawalCount", COALESCE(SUM(withdrawal_total), 0.00)::text AS "withdrawalTotal",
  COALESCE(SUM(interest_count), 0)::text AS "interestCount", COALESCE(SUM(interest_total), 0.00)::text AS "interestTotal",
  COALESCE(SUM(reversal_count), 0)::text AS "reversalCount", COALESCE(SUM(net_movement), 0.00)::text AS "netMovement"`;

const NOTES = [
  "Dates are Asia/Colombo calendar days, both ends inclusive.",
  "Opening balance is the balance before the first posting in the period and closing balance the balance after the last; both are read from the ledger's stored running balance. An account with no posting in the period shows the same balance for both.",
  "Deposit, withdrawal and interest totals are net of reversals (a reversal is counted in its original category); counts are original postings and reversals are counted separately. Closing minus opening equals deposits minus withdrawals plus interest.",
];

type Totals = Record<string, string>;

async function currentActor(tx: Tx, user: AuthenticatedUser) {
  const identity = actorSchema.safeParse(user);
  if (!identity.success) throw new NotAuthorizedError();
  const { rows } = await tx.query<{ username: string; role_name: string; branch_id: string | null }>(`
    SELECT u.username, r.role_name, CASE WHEN r.role_name = 'BRANCH_MANAGER' THEN a.branch_id END AS branch_id
      FROM app_user u JOIN role r ON r.role_id = u.role_id
      LEFT JOIN agent a ON a.agent_id = u.user_id LEFT JOIN branch b ON b.branch_id = a.branch_id
     WHERE u.user_id = $1 AND u.status = 'ACTIVE' AND r.status = 'ACTIVE'
       AND r.role_name IN ('ADMIN', 'CENTRAL_OPS', 'AUDITOR', 'BRANCH_MANAGER')
       AND (r.role_name <> 'BRANCH_MANAGER' OR (a.status = 'ACTIVE' AND b.status = 'ACTIVE'))`, [identity.data.userId]);
  const caller = rows[0];
  if (!caller || caller.role_name !== identity.data.roleName ||
      (caller.role_name === "BRANCH_MANAGER" && caller.branch_id !== identity.data.branchId?.toLowerCase())) throw new NotAuthorizedError();
  await setRlsContext(tx, { userId: user.userId, roleName: caller.role_name, branchId: caller.branch_id });
  return caller;
}

/**
 * Builds the RPT-02 snapshot (page or, for CSV, every filtered account) and writes the access audit, all in
 * one REPEATABLE READ transaction so rows, totals and the audit agree.
 */
export async function getAccountSummaryReport(input: Rpt02Query, user: AuthenticatedUser): Promise<AccountSummaryResult> {
  const parsed = rpt02QuerySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Choose valid report filters.");
  const filters = parsed.data;
  const generatedAt = new Date().toISOString();
  return withTransaction(async tx => {
    const caller = await currentActor(tx, user);
    // A branch manager is confined to their own branch, in SQL; asking for another branch is a 403, not an empty report.
    if (caller.role_name === "BRANCH_MANAGER" && filters.branchId && filters.branchId !== caller.branch_id) {
      throw new NotAuthorizedError("Branch filter is outside your scope.");
    }
    const branchId = caller.role_name === "BRANCH_MANAGER" ? caller.branch_id : filters.branchId ?? null;
    const params = [branchId, filters.accountId ?? null, filters.planId ?? null, filters.status ?? null, filters.from, filters.to];
    const order = `${SORT_SQL[filters.sort]} ${DIRECTION_SQL[filters.direction]}, account_id ASC`;
    const exportAll = filters.format === "csv";
    const limit = exportAll ? RPT02_CSV_MAX_ROWS + 1 : filters.pageSize;
    const offset = exportAll ? 0 : (filters.page - 1) * filters.pageSize;
    const paging = [...params, limit, offset];

    const grand = (await tx.query<Totals>(`${SUMMARY_CTE} SELECT ${TOTAL_COLUMNS} FROM summary`, params)).rows[0];
    const rows = (await tx.query<AccountSummaryRow>(
      `${SUMMARY_CTE} SELECT ${ROW_COLUMNS} FROM summary ORDER BY ${order} LIMIT $7 OFFSET $8`, paging)).rows;
    if (!grand) throw new Error("Report totals unavailable");
    if (exportAll && rows.length > RPT02_CSV_MAX_ROWS) {
      throw new ValidationError(`This export would exceed ${RPT02_CSV_MAX_ROWS} accounts. Narrow the filters.`);
    }
    // The page subtotal is summed by the database over exactly the rows returned (never in JavaScript).
    const subtotal = exportAll ? undefined : (await tx.query<Totals>(
      `${SUMMARY_CTE}, page AS (SELECT * FROM summary ORDER BY ${order} LIMIT $7 OFFSET $8)
       SELECT ${TOTAL_COLUMNS} FROM page`, paging)).rows[0];

    const { totalRows, ...grandTotal } = grand;
    const subtotals = subtotal ? (({ totalRows: _rows, ...rest }) => rest)(subtotal) : undefined;
    const echoed = { ...filters, branchId: branchId ?? undefined };
    const result: AccountSummaryResult = {
      reportName: "account-summary", rows, subtotals, grandTotal, filters: echoed,
      generatedAt, requestedBy: caller.username, totalRows: Number(totalRows),
      page: exportAll ? 1 : filters.page, pageSize: exportAll ? rows.length : filters.pageSize,
      timeZone: "Asia/Colombo", notes: NOTES,
    };
    await auditReportAccess(user, "account-summary", echoed, tx);
    return result;
  }, { isolationLevel: "REPEATABLE READ" });
}

/** Branch and plan choices for the filter form; a branch manager gets only their own branch. */
export async function getAccountSummaryChoices(user: AuthenticatedUser): Promise<AccountSummaryChoices> {
  return withTransaction(async tx => {
    const caller = await currentActor(tx, user);
    const branches = (await tx.query<{ id: string; name: string }>(
      `SELECT branch_id AS id, branch_code || ' — ' || branch_name AS name FROM branch
        WHERE ($1::uuid IS NULL OR branch_id = $1) ORDER BY branch_code`, [caller.branch_id])).rows;
    const plans = (await tx.query<{ id: string; name: string }>(
      "SELECT plan_id AS id, plan_name AS name FROM savings_plan ORDER BY plan_name")).rows;
    return { branches, plans, branchId: caller.branch_id };
  }, { isolationLevel: "REPEATABLE READ" });
}
