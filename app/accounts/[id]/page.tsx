import { requirePageRole } from "@/lib/auth/page-access";
import { AccountDetail } from "./account-detail";

// Who may start opening a fixed deposit (docs/15). Only controls the link: the FD page and API authorize on the server.
const OPEN_FD_ROLES: readonly string[] = ["AGENT", "BRANCH_MANAGER", "CENTRAL_OPS"];

export default async function AccountDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR", "CUSTOMER");
  const { notice } = await searchParams;
  return <AccountDetail id={(await params).id} canAddHolder={user.roleName === "BRANCH_MANAGER"} canBrowse={user.roleName !== "CUSTOMER"} canOpenFd={OPEN_FD_ROLES.includes(user.roleName)} notice={notice} />;
}
