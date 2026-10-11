import { requirePageRole } from "@/lib/auth/page-access";
import { CustomerProfile } from "./customer-profile";
export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
  return <CustomerProfile id={(await params).id} canSearch={user.roleName !== "CUSTOMER"} canVerify={['AGENT','BRANCH_MANAGER'].includes(user.roleName)}
    canEdit={['AGENT','BRANCH_MANAGER'].includes(user.roleName)} canEditEmail={user.roleName === 'AGENT'} editing={(await searchParams).edit === '1'} />;
}
