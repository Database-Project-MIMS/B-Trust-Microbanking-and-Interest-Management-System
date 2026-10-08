import { requirePageRole } from "@/lib/auth/page-access";
import { listSavingsPlans } from "@/services/savings-plan-service";
import { AccountList } from "./account-list";

export default async function AccountsPage() {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR");
  const plans = await listSavingsPlans();
  return <AccountList canOpen={["AGENT", "BRANCH_MANAGER"].includes(user.roleName)} plans={plans.map(plan => ({ id: plan.planId, name: plan.planName }))} />;
}
