import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { OrganizationTable } from "@/components/organization/organization-table";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

export default async function BranchesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect("/sign-in?next=/branches");
  return <AppShell session={session}><div className="page-header"><div><p className="eyebrow">Organisation</p><h1 className="page-title">Branches</h1><p className="page-description">Branches are limited to your authorised scope.</p></div></div><OrganizationTable resource="branches" /></AppShell>;
}
