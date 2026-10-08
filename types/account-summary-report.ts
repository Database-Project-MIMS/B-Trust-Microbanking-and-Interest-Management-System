import type { ReportResult } from "@/lib/report/report-handler";

/** One account in RPT-02. Money and counts are exact strings; reversals are netted into their original category. */
export interface AccountSummaryRow {
  accountId: string; accountNumber: string; branchId: string; branchName: string;
  planName: string; accountStatus: string;
  openingBalance: string; closingBalance: string;
  depositCount: string; depositTotal: string;
  withdrawalCount: string; withdrawalTotal: string;
  interestCount: string; interestTotal: string;
  reversalCount: string; netMovement: string;
}
export interface AccountSummaryResult extends ReportResult<AccountSummaryRow> {
  timeZone: "Asia/Colombo";
  notes: string[];
}
export interface AccountSummaryChoices {
  branches: { id: string; name: string }[];
  plans: { id: string; name: string }[];
  branchId: string | null;
}
