import { requirePageRole } from "@/lib/auth/page-access";
import { CustomerList } from "./customer-list";
import { listBranches } from "@/services/branch-service";
import { listAgents } from "@/services/agent-service";
export default async function CustomersPage() {
  const user = await requirePageRole("AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR");
  const [branches, agents] = await Promise.all([listBranches(user.branchId), listAgents(user.branchId)]);
  return <CustomerList canRegister={["AGENT", "BRANCH_MANAGER"].includes(user.roleName)}
    branches={branches.map(branch => ({ id: branch.branchId, name: branch.branchName }))}
    agents={agents.filter(agent => user.roleName !== "AGENT" || agent.agentId === user.userId)
      .map(agent => ({ id: agent.agentId, name: agent.fullName }))} />;
}
