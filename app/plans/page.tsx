import { requirePageRole } from "@/lib/auth/page-access";
import { listSavingsPlans } from "@/services/savings-plan-service";
import SavingsPlanClient from "./SavingsPlanClient";

export default async function PlansPage() {
  const user = await requirePageRole("ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR");
  const plans = await listSavingsPlans();
  return <>
    <div className="page-header"><div><p className="eyebrow">Product catalogue</p><h1 className="page-title">Savings plans</h1></div></div>
    <div className="mt-2"><SavingsPlanClient initialPlans={plans} canEdit={["ADMIN", "CENTRAL_OPS"].includes(user.roleName)} /></div>
  </>;
}
