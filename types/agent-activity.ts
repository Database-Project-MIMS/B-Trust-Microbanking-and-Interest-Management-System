export interface AgentActivityRange {
  from: string;
  to: string;
}

export type AgentActivityType = "DEPOSIT" | "WITHDRAWAL" | "INTEREST_CREDIT" | "REVERSAL";

export interface AgentActivity extends AgentActivityRange {
  agentId: string;
  agent: { fullName: string; employeeNo: string; branchCode: string; branchName: string };
  timeZone: "Asia/Colombo";
  scope: "SELF" | "BRANCH" | "BANK";
  byType: { type: AgentActivityType; count: number; total: string }[];
}
