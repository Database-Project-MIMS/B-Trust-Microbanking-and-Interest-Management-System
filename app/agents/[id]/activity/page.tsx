import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { assertBranchProfile } from "@/lib/auth/rbac";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";
import { AGENT_ACTIVITY_ROLES, colomboToday } from "@/lib/validation/agent-activity";
import { AgentActivityScreen } from "./agent-activity-screen";

export default async function AgentActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/agents/${id}/activity`)}`);
  assertBranchProfile(session.roleName, session.branchId);
  if (!(AGENT_ACTIVITY_ROLES as readonly string[]).includes(session.roleName)) redirect("/dashboard");
  return <AppShell session={session}><AgentActivityScreen agentId={id} today={colomboToday()}
    backHref={session.roleName === "AGENT" ? "/customers" : "/agents"} /></AppShell>;
}
