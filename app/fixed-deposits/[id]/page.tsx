import { requirePageRole } from "@/lib/auth/page-access";
import { FixedDepositDetails } from "./fixed-deposit-details";

export default async function FixedDepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
  return <FixedDepositDetails id={(await params).id} canEditAccount={user.roleName === "BRANCH_MANAGER"}
    canRunInterest={user.roleName === "CENTRAL_OPS"} />;
}
