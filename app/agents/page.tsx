import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { OrganizationTable } from "@/components/organization/organization-table";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

export default async function AgentsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect("/sign-in?next=/agents");
  if (!["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER"].includes(session.roleName)) redirect("/dashboard");
  return <AppShell session={session}><div className="page-header"><div><p className="eyebrow">Organisation</p><h1 className="page-title">Agents</h1><p className="page-description">Create and deactivate ordinary agents within your authorised branch scope.</p></div></div><OrganizationTable resource="agents" roleName={session.roleName} /></AppShell>;
}
