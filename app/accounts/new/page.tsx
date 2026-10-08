import { requirePageRole } from "@/lib/auth/page-access";
import { listSavingsPlans } from "@/services/savings-plan-service";
import { AccountOpening } from "./account-opening";

export default async function NewAccountPage() {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER");
  const plans = (await listSavingsPlans()).filter(plan => plan.status === "ACTIVE");
  return <AccountOpening branchId={user.branchId!} plans={plans.map(plan => ({
    planId: plan.planId, planName: plan.planName, interestRate: plan.interestRate, minBalance: plan.minBalance,
    description: plan.description, minAgeYears: plan.minAgeYears, maxAgeYears: plan.maxAgeYears,
    minHolders: plan.minHolders, maxHolders: plan.maxHolders, requiresAllAdult: plan.requiresAllAdult }))} />;
}
