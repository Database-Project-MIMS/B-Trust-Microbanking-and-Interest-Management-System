import "server-only";
import { mkdtemp, open, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import { withTransaction } from "@/lib/db";
import { NotAuthorizedError, ValidationError } from "@/lib/db/errors";
import { setRlsContext } from "@/lib/db/rls-context";
import { auditReportAccess } from "@/lib/report/report-handler";
import { rpt01QuerySchema, RPT01_ROLES, type Rpt01Query } from "@/lib/validation/rpt01-report";
import type { Rpt01Result, Rpt01Row } from "@/types/rpt01-report";

const actorSchema = z.object({
  userId: z.string().uuid(), roleName: z.enum(RPT01_ROLES),
  branchId: z.string().uuid().nullable(),
});
const columns = `
  agent_id AS "agentId", employee_no AS "employeeNo", agent_name AS "agentName",
  agent_status AS "agentStatus", branch_id AS "branchId", branch_name AS "branchName",
  transaction_count::text AS "transactionCount", deposit_count::text AS "depositCount",
  deposit_total::text AS "depositTotal", withdrawal_count::text AS "withdrawalCount",
  withdrawal_total::text AS "withdrawalTotal", interest_count::text AS "interestCount",
  interest_total::text AS "interestTotal", reversal_count::text AS "reversalCount",
  reversal_total::text AS "reversalTotal", reversal_credit::text AS "reversalCredit",
  reversal_debit::text AS "reversalDebit", unresolved_reversal_count::text AS "unresolvedReversalCount",
  net_total::text AS "netTotal"`;
const rowKeys = ["agentId","employeeNo","agentName","agentStatus","branchId","branchName",
  "transactionCount","depositCount","depositTotal","withdrawalCount","withdrawalTotal",
  "interestCount","interestTotal","reversalCount","reversalTotal","reversalCredit",
  "reversalDebit","unresolvedReversalCount","netTotal"] as const;
const rowProjection = rowKeys.map(key => '"' + key + '"').join(",");
const totalKeys = ["transactionCount", "depositCount", "depositTotal", "withdrawalCount",
  "withdrawalTotal", "interestCount", "interestTotal", "reversalCount", "reversalTotal",
  "reversalCredit", "reversalDebit", "unresolvedReversalCount"] as const;
// All SQL identifiers and directions come from server constants, never request interpolation.
const totalsSql = "jsonb_build_object(" + totalKeys.map(key =>
  "'" + key + "',COALESCE(SUM(\"" + key + "\"::numeric),0)::text").join(",") +
  ",'netTotal', CASE WHEN COALESCE(SUM(\"unresolvedReversalCount\"::numeric),0)=0 THEN COALESCE(SUM(\"netTotal\"::numeric),0.00)::text ELSE 'UNRESOLVED' END)";
const sortColumns = { employeeNo: '"employeeNo"', agentName: '"agentName"', netTotal: '"netTotal"::numeric' } as const;

async function currentActor(tx: Parameters<typeof setRlsContext>[0], actor: AuthenticatedUser) {
  const identity = actorSchema.safeParse(actor);
  if (!identity.success) throw new NotAuthorizedError();
  const { rows } = await tx.query<{ username: string; role_name: string; branch_id: string | null }>(`
    SELECT u.username,r.role_name,CASE WHEN r.role_name='BRANCH_MANAGER' THEN a.branch_id END AS branch_id
    FROM app_user u JOIN role r ON r.role_id=u.role_id
    LEFT JOIN agent a ON a.agent_id=u.user_id LEFT JOIN branch b ON b.branch_id=a.branch_id
    WHERE u.user_id=$1 AND u.status='ACTIVE' AND r.status='ACTIVE'
      AND r.role_name IN ('ADMIN','CENTRAL_OPS','AUDITOR','BRANCH_MANAGER')
      AND (r.role_name<>'BRANCH_MANAGER' OR (a.status='ACTIVE' AND b.status='ACTIVE'))`, [identity.data.userId]);
  const caller = rows[0];
  if (!caller || caller.role_name !== identity.data.roleName ||
    (caller.role_name === "BRANCH_MANAGER" && caller.branch_id !== identity.data.branchId?.toLowerCase())) throw new NotAuthorizedError();
  await setRlsContext(tx,
    { userId: actor.userId, roleName: caller.role_name, branchId: caller.branch_id });
  return caller;
}

export interface PreparedRpt01 { result: Rpt01Result; csvRows?: AsyncIterable<Rpt01Row>; cleanup?: () => Promise<void> }

/** Prepares scoped rows/totals/spool and access audit in one REPEATABLE READ transaction; network delivery follows commit. */
export async function prepareRpt01(input: Rpt01Query, actor: AuthenticatedUser): Promise<PreparedRpt01> {
  const parsed = rpt01QuerySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Choose valid report filters.");
  let directory: string | undefined;
  let cleaned = false;
  async function cleanup() {
    if (directory && !cleaned) {
      // mkdtemp returns the generated absolute path; validate that exact root/name.
      if (!isAbsolute(directory) || dirname(directory) !== tmpdir() || !basename(directory).startsWith("mims-rpt01-")) {
        throw new Error("Refusing report cleanup outside its generated temporary directory.");
      }
      await rm(directory, { recursive: true, force: true }); cleaned = true;
    }
  }
  try {
    const result = await withTransaction(async tx => {
      const caller = await currentActor(tx, actor);
      const filters = { ...parsed.data };
      if (caller.role_name === "BRANCH_MANAGER") {
        if (filters.branchId && filters.branchId !== caller.branch_id) throw new NotAuthorizedError();
        filters.branchId = caller.branch_id!;
      }
      const args = [filters.from, filters.to, filters.branchId ?? null, filters.agentId ?? null];
      await tx.query(`CREATE TEMP TABLE rpt01_result ON COMMIT DROP AS
        SELECT ${columns} FROM fn_rpt01_rows($1::date,$2::date,$3::uuid,$4::uuid)`, args);
      const order = sortColumns[filters.sort] + (filters.direction === "desc" ? " DESC" : " ASC") +
        ' NULLS LAST, "agentId", "branchId" NULLS FIRST';
      const offset = (filters.page - 1) * filters.pageSize;
      const { rows: totals } = await tx.query<{ total: string; values: Record<string, string> }>(
        `SELECT COUNT(*)::text AS total,${totalsSql} AS values FROM pg_temp.rpt01_result`);
      const grand = totals[0];
      if (!grand) throw new Error("Missing report totals.");
      const totalRows = Number(grand.total);
      if (!Number.isSafeInteger(totalRows)) throw new Error("Report row count exceeds pagination capacity.");
      const { rows: pageTotals } = await tx.query<{ values: Record<string, string> }>(
        `SELECT ${totalsSql} AS values FROM (SELECT ${rowProjection}
         FROM pg_temp.rpt01_result ORDER BY ${order} LIMIT $1 OFFSET $2) page`,
        [filters.pageSize, offset]);
      const { rows: excluded } = await tx.query<{ transactionCount: string; unsignedValue: string }>(
        `SELECT transaction_count::text AS "transactionCount",unsigned_value::text AS "unsignedValue"
         FROM fn_rpt01_exclusions($1::date,$2::date,$3::uuid)`, args.slice(0, 3));
      const subtotal = pageTotals[0];
      const exclusions = excluded[0];
      if (!subtotal || !exclusions) throw new Error("Missing report metadata.");
      const notes = [
        "Totals include attributed transactions only. Inactive staff and manager profiles retain history.",
        "Posting branch is captured at posting time; a zero-activity row uses the roster branch.",
        "Unattributed exclusions cover the selected dates and branch, independently of the agent filter.",
        "Net is unresolved when a historical reversal has no valid original link.",
      ];
      const report: Rpt01Result = {
        reportName: "agent-transactions", rows: [], subtotals: subtotal.values,
        grandTotal: grand.values, filters, generatedAt: new Date().toISOString(),
        requestedBy: caller.username, totalRows, page: filters.page, pageSize: filters.pageSize,
        exclusions, scopeLabel: filters.branchId ?? "Bankwide", timeZone: "Asia/Colombo", notes,
      };
      const selectRows = `SELECT ${rowProjection} FROM pg_temp.rpt01_result ORDER BY ${order}`;
      if (filters.format === "csv") {
        directory = await mkdtemp(join(tmpdir(), "mims-rpt01-"));
        const file = await open(join(directory, "rows.ndjson"), "wx", 0o600);
        try {
          await tx.query("DECLARE rpt01_export NO SCROLL CURSOR FOR " + selectRows);
          for (;;) {
            const batch = await tx.query<Rpt01Row>("FETCH FORWARD 100 FROM rpt01_export");
            if (batch.rows.length === 0) break;
            for (const row of batch.rows) await file.write(JSON.stringify(row) + "\n");
          }
          await tx.query("CLOSE rpt01_export");
        } finally { await file.close(); }
      } else {
        report.rows = (await tx.query<Rpt01Row>(selectRows + " LIMIT $1 OFFSET $2", [filters.pageSize, offset])).rows;
      }
      await auditReportAccess({ ...actor, username: caller.username }, report.reportName, filters, tx);
      return report;
    }, { isolationLevel: "REPEATABLE READ", maxAttempts: 1 });
    if (!directory) return { result };
    const filename = join(directory, "rows.ndjson");
    async function* csvRows() {
      const source = createReadStream(filename, { encoding: "utf8" });
      const lines = createInterface({ input: source, crlfDelay: Infinity });
      try { for await (const line of lines) yield JSON.parse(line) as Rpt01Row; }
      finally {
        lines.close();
        if (!source.closed) await new Promise<void>(resolve => { source.once("close", resolve); source.destroy(); });
      }
    }
    return { result, csvRows: csvRows(), cleanup };
  } catch (error) { await cleanup(); throw error; }
}

/** Reads named choices in one authorized transaction; returns no report financial data. */
export async function getRpt01Choices(actor: AuthenticatedUser) {
  return withTransaction(async tx => {
    const caller = await currentActor(tx, actor);
    const branches = (await tx.query<{ id: string; name: string }>(
      "SELECT branch_id AS id,branch_code || ' — ' || branch_name AS name FROM branch WHERE ($1::uuid IS NULL OR branch_id=$1) ORDER BY branch_code",
      [caller.branch_id])).rows;
    const agents = (await tx.query<{ id: string; name: string }>(`
      SELECT a.agent_id AS id,a.employee_no || ' — ' || a.full_name AS name
      FROM agent a WHERE $1::uuid IS NULL OR a.branch_id=$1
        OR EXISTS (SELECT 1 FROM transaction t WHERE t.agent_id=a.agent_id AND t.branch_id=$1)
      ORDER BY a.employee_no LIMIT 1000`, [caller.branch_id])).rows;
    return { branches, agents, branchId: caller.branch_id };
  }, { isolationLevel: "REPEATABLE READ" });
}
