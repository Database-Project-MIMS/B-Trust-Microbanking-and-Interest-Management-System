import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

const quickLinks = [
  { href: "/customers", title: "Customers", description: "Register, search and review customer profiles.", roles: ["CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/accounts", title: "Savings accounts", description: "Open individual or joint accounts and view balances.", roles: ["CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/transactions/deposit", title: "Transactions", description: "Post deposits and withdrawals through the controlled workflow.", roles: ["BRANCH_MANAGER", "AGENT"] },
  { href: "/fixed-deposits", title: "Fixed deposits", description: "Open deposits and review maturity and interest dates.", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/reports/agent-transactions", title: "Reports", description: "Run scoped operational and management reports.", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR"] },
  { href: "/reconciliation", title: "Reconciliation", description: "Check ledger and account-balance control results.", roles: ["CENTRAL_OPS", "AUDITOR"] },
  { href: "/branches", title: "Branch administration", description: "View permitted branches and maintain branch master data.", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR"] },
  { href: "/agents", title: "Agent administration", description: "View branch-scoped agents and their status.", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER"] },
  { href: "/fd-products", title: "FD products", description: "View current fixed-deposit products and rate history.", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/admin/audit", title: "Audit trail", description: "Search traceable activity by actor, entity and action.", roles: ["ADMIN", "AUDITOR"] },
];

export default async function DashboardHome() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  const visibleLinks = quickLinks.filter((item) => item.roles.includes(session?.roleName ?? ""));
  return (
    <section>
      <div className="page-header" data-reveal>
        <div><p className="eyebrow">Your daily overview</p><h1 className="page-title">Welcome back, {session?.username}.</h1><p className="page-description">Everything you need to keep your operations moving.</p></div>
      </div>
      <div className="dashboard-hero" data-reveal><span className="light-eyebrow">B-Trust · Operations hub</span><h2>A clear view.<br />A confident next step.</h2><p>Bring your branch network, people, and product portfolio together. Select a workspace below to get started.</p></div>
      <div className="flex items-center justify-between" data-reveal><h2 className="section-heading">Your workspaces</h2><span className="text-xs text-[var(--text-muted)]">Access tailored to your role</span></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleLinks.map((item, index) => <Link data-reveal className="card app-card-link" href={item.href} key={item.href}><span className="card-index" aria-hidden="true">{["⌘", "◎", "↗", "◒", "▤", "✓", "⌂", "◉", "◇", "◌"][index]}</span><h2>{item.title}</h2><p>{item.description}</p><span>Explore workspace ↗</span></Link>)}
      </div>
    </section>
  );
}
