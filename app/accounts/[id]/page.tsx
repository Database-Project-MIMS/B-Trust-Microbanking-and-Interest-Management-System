import { requirePageRole } from "@/lib/auth/page-access";
import { AccountDetail } from "./account-detail";

export default async function AccountDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
  const { notice } = await searchParams;
  return <AccountDetail id={(await params).id} canAddHolder={user.roleName === "BRANCH_MANAGER"} canBrowse={user.roleName !== "CUSTOMER"} notice={notice} />;
}
