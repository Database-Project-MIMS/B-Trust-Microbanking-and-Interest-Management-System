import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { DomainError } from "@/lib/db/errors";
import { streamCsv, type CsvColumn } from "@/lib/report/csv-export";
import { parseRpt01Query, RPT01_ROLES } from "@/lib/validation/rpt01-report";
import { prepareRpt01 } from "@/services/rpt01-report-service";
import type { Rpt01Row } from "@/types/rpt01-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const csvColumns: CsvColumn<Rpt01Row>[] = [
  { key: "employeeNo", label: "Employee number" }, { key: "agentName", label: "Agent name" },
  { key: "agentStatus", label: "Agent status" }, { key: "branchName", label: "Posting branch" },
  { key: "transactionCount", label: "Transaction count" }, { key: "depositCount", label: "Deposit count" },
  { key: "depositTotal", label: "Deposits LKR" }, { key: "withdrawalCount", label: "Withdrawal count" },
  { key: "withdrawalTotal", label: "Withdrawals LKR" }, { key: "interestCount", label: "Interest count" },
  { key: "interestTotal", label: "Interest LKR" }, { key: "reversalCount", label: "Reversal count" },
  { key: "reversalTotal", label: "Reversals unsigned LKR" }, { key: "reversalCredit", label: "Reversal credits LKR" },
  { key: "reversalDebit", label: "Reversal debits LKR" },
  { key: "unresolvedReversalCount", label: "Unresolved reversal count" }, { key: "netTotal", label: "Net LKR" },
];

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, ...RPT01_ROLES);
    const filters = parseRpt01Query(request.nextUrl.searchParams);
    const prepared = await prepareRpt01(filters, user);
    if (filters.format === "csv") {
      try {
        return streamCsv(prepared.result, { columns: csvColumns, rows: prepared.csvRows,
          cleanup: prepared.cleanup, notes: [...prepared.result.notes,
            "Excluded unattributed transactions: " + prepared.result.exclusions.transactionCount +
            "; unsigned LKR " + prepared.result.exclusions.unsignedValue] });
      } catch (error) { await prepared.cleanup?.(); throw error; }
    }
    return NextResponse.json({ data: prepared.result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NextResponse) {
      error.headers.set("Cache-Control", "private, no-store");
      return error;
    }
    if (error instanceof ZodError) return NextResponse.json({ error: {
      code: "VALIDATION_FAILED", message: "The request contains invalid or missing fields.",
    } }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof DomainError) return NextResponse.json({ error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "The report could not be generated." } },
      { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
