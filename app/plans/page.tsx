import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { listSavingsPlans } from "@/services/savings-plan-service";
import SavingsPlanClient from "./SavingsPlanClient";

export default async function PlansPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mims_session")?.value;

  if (!token) {
    redirect("/sign-in");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/sign-in");
  }

  const csrfToken = cookieStore.get("mims_csrf")?.value || "";
  const plans = await listSavingsPlans();
  const canEdit = session.roleName === "ADMIN" || session.roleName === "CENTRAL_OPS";

  return (
    <div className="p-space-lg max-w-6xl mx-auto">
      <div className="mb-space-md">
        <h1 className="font-headline text-headline-sm text-on-surface mb-1">
          Savings Plans
        </h1>
        <p className="font-body text-body-sm text-on-surface-variant">
          Interest rate, minimum balance and eligibility rules for the five savings
          products.
        </p>
      </div>

      <SavingsPlanClient initialPlans={plans} canEdit={canEdit} csrfToken={csrfToken} />
    </div>
  );
}
