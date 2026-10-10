import { requirePageRole } from "@/lib/auth/page-access";
import { RPT01_ROLES } from "@/lib/validation/rpt01-report";
import { colomboToday } from "@/lib/validation/agent-activity";
import { getRpt01Choices } from "@/services/rpt01-report-service";
import { Rpt01Screen } from "./rpt01-screen";

export default async function AgentTransactionsReportPage() {
  const session = await requirePageRole(...RPT01_ROLES);
  const actor = { ...session, userId: session.userId, branchId: session.branchId ?? null };
  const choices = await getRpt01Choices(actor);
  return <Rpt01Screen choices={choices} today={colomboToday()} />;
}
