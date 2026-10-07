import { requirePageRole } from "@/lib/auth/page-access";
import { listAgents } from "@/services/agent-service";
import { CustomerRegistration } from "./customer-registration";
export default async function NewCustomerPage() {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER");
  const agents = user.roleName === "AGENT" ? [{ agentId: user.userId, fullName: "You (current agent)" }]
    : (await listAgents(user.branchId, "ACTIVE")).map(agent => ({ agentId: agent.agentId, fullName: agent.fullName }));
  return <CustomerRegistration branchId={user.branchId!} agents={agents} />;
}
