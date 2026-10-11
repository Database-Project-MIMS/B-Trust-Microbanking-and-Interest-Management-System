import { AppShell } from "@/components/app-shell/app-shell";
import { OrganizationDetail } from "@/components/organization/organization-detail";
import { requirePageRole } from "@/lib/auth/page-access";

export default async function AgentDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requirePageRole("ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER");
  return <AppShell session={user}><OrganizationDetail resource="agents" id={(await params).id}
    canEdit={["ADMIN", "BRANCH_MANAGER"].includes(user.roleName)} editing={(await searchParams).edit === "1"} /></AppShell>;
}
