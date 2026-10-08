import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/http/error-response";
import { streamCsv, type CsvColumn } from "@/lib/report/csv-export";
import { parseRpt02Query, RPT02_ROLES } from "@/lib/validation/account-summary-report";
import { getAccountSummaryReport } from "@/services/account-summary-report-service";
import type { AccountSummaryRow } from "@/types/account-summary-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same query, same totals as the JSON response (REP-COM-04): only the columns and the paging differ.
const csvColumns: CsvColumn<AccountSummaryRow>[] = [
  { key: "accountNumber", label: "Account number" }, { key: "branchName", label: "Branch" },
  { key: "planName", label: "Plan" }, { key: "accountStatus", label: "Status" },
  { key: "openingBalance", label: "Opening balance LKR" }, { key: "closingBalance", label: "Closing balance LKR" },
  { key: "depositCount", label: "Deposit count" }, { key: "depositTotal", label: "Deposits LKR" },
  { key: "withdrawalCount", label: "Withdrawal count" }, { key: "withdrawalTotal", label: "Withdrawals LKR" },
  { key: "interestCount", label: "Interest count" }, { key: "interestTotal", label: "Interest LKR" },
  { key: "reversalCount", label: "Reversal count" }, { key: "netMovement", label: "Net movement LKR" },
];

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    requireRole(user, ...RPT02_ROLES);
    const filters = parseRpt02Query(request.nextUrl.searchParams);
    // Rows, totals and the REPORT_ACCESSED audit row are produced in one transaction; delivery follows the commit.
    const result = await getAccountSummaryReport(filters, user);
    if (filters.format === "csv") return streamCsv(result, { columns: csvColumns, notes: result.notes });
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
