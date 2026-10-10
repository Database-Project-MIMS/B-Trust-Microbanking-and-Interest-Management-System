import { requirePageRole } from "@/lib/auth/page-access";
import { colomboToday } from "@/lib/validation/agent-activity";
import { RPT02_ROLES } from "@/lib/validation/account-summary-report";
import { getAccountSummaryChoices } from "@/services/account-summary-report-service";
import { AccountSummaryScreen } from "./account-summary-screen";

export default async function AccountSummaryReportPage() {
  const session = await requirePageRole(...RPT02_ROLES);
  const choices = await getAccountSummaryChoices({ ...session, userId: session.userId, branchId: session.branchId ?? null });
  return <AccountSummaryScreen choices={choices} today={colomboToday()} />;
}
