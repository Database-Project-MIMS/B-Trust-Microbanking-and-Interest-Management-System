import { requirePageRole } from "@/lib/auth/page-access";
import { CustomerProfile } from "./customer-profile";
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
  return <CustomerProfile id={(await params).id} canSearch={user.roleName !== "CUSTOMER"} canVerify={['AGENT','BRANCH_MANAGER'].includes(user.roleName)} />;
}
