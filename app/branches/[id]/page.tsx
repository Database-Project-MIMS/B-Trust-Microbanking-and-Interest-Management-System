import { AppShell } from "@/components/app-shell/app-shell";
import { OrganizationDetail } from "@/components/organization/organization-detail";
import { requirePageRole } from "@/lib/auth/page-access";

export default async function BranchDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requirePageRole("ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR");
  return <AppShell session={user}><OrganizationDetail resource="branches" id={(await params).id}
    canEdit={user.roleName === "ADMIN"} editing={(await searchParams).edit === "1"} /></AppShell>;
}
