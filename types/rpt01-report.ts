import type { ReportResult } from "@/lib/report/report-handler";

export interface Rpt01Row {
  agentId: string; employeeNo: string; agentName: string; agentStatus: string;
  branchId: string | null; branchName: string; transactionCount: string;
  depositCount: string; depositTotal: string; withdrawalCount: string; withdrawalTotal: string;
  interestCount: string; interestTotal: string; reversalCount: string; reversalTotal: string;
  reversalCredit: string; reversalDebit: string; unresolvedReversalCount: string; netTotal: string | null;
}
export interface Rpt01Result extends ReportResult<Rpt01Row> {
  exclusions: { transactionCount: string; unsignedValue: string };
  scopeLabel: string;
  timeZone: "Asia/Colombo";
  notes: string[];
}
