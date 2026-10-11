export const reportRoles = ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR"] as const;

export const reportCatalogue = [
  { href: "/reports/agent-transactions", code: "RPT-01", title: "Agent transaction totals", description: "Review transaction totals attributed to agents in your permitted branches." },
  { href: "/reports/account-summary", code: "RPT-02", title: "Account transaction summary", description: "Compare opening balances, movements and closing balances by account." },
  { href: "/reports/active-fds", code: "RPT-03", title: "Active fixed deposits", description: "Review active principal, maturity dates and upcoming payouts." },
  { href: "/reports/interest-distribution", code: "RPT-04", title: "Interest distribution", description: "Review interest credited across completed distribution cycles." },
  { href: "/reports/customer-activity", code: "RPT-05", title: "Customer activity", description: "Review customer account activity and transaction totals." },
] as const;
