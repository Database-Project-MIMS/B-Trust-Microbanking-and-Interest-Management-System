"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionData } from "@/lib/auth/session";

interface TopBarProps {
  session: SessionData;
}

const navigation = [
  {href:'/my/accounts',label:'My accounts',roles:['CUSTOMER']},
  {href:'/transactions/withdraw',label:'Withdraw',roles:['CUSTOMER']},
  {href:'/transactions/transfer',label:'Transfers',roles:['AGENT','BRANCH_MANAGER']},
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR", "CUSTOMER"] },
  { href: "/customers", label: "Customers", roles: ["CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/accounts", label: "Accounts", roles: ["CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/transactions/deposit", label: "Transactions", roles: ["BRANCH_MANAGER", "AGENT"] },
  { href: "/fixed-deposits", label: "Fixed deposits", roles: ["CUSTOMER", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT", "AUDITOR"] },
  { href: "/reports/agent-transactions", label: "Reports", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR"] },
  { href: "/branches", label: "Branches", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AUDITOR"] },
  { href: "/agents", label: "Agents", roles: ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER"] },
  { href: "/admin/parameters", label: "Controls", roles: ["ADMIN"] },
  { href: "/admin/health", label: "Health", roles: ["ADMIN", "CENTRAL_OPS"] },
];

function csrfToken(): string {
  const cookie = document.cookie.split("; ").find((value) => value.startsWith("mims_csrf="));
  return cookie?.split("=")[1] ?? "";
}

/** Renders role-aware navigation and signs out through the server-side session endpoint. */
export function TopBar({ session }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const visibleNavigation = navigation.filter((item) => item.roles.includes(session.roleName));

  async function signOut(): Promise<void> {
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": csrfToken() } });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setLogoutError(true);
      setIsSigningOut(false);
    }
  }

  return (
    <header className="workspace-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="workspace-brand" href="/dashboard"><span className="brand-symbol">b.</span>B-Trust</Link>
        <button aria-controls="primary-navigation" aria-expanded={isOpen} className="btn btn-secondary md:hidden" onClick={() => setIsOpen((open) => !open)} type="button">Menu</button>
        <nav className={`${isOpen ? "flex" : "hidden"} absolute left-0 right-0 top-[57px] z-10 flex-col gap-1 border-b border-[var(--border)] bg-[var(--surface)] p-4 md:static md:flex md:flex-1 md:flex-row md:flex-wrap md:justify-center md:border-0 md:p-0`} id="primary-navigation">
          {visibleNavigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`} href={item.href} key={item.href} onClick={() => setIsOpen(false)}>{item.label}</Link>;
          })}
        </nav>
        <div className="flex items-center gap-3 text-right text-sm">
          <div><p className="font-medium text-[var(--text)]">{session.username}</p><p className="text-xs text-[var(--text-muted)]">{session.roleName.replaceAll("_", " ")}</p></div>
          <button className="btn btn-secondary" disabled={isSigningOut} onClick={signOut} type="button">{isSigningOut ? "Signing out…" : "Sign out"}</button>
        </div>
      </div>
      {logoutError && <p role="alert" className="px-4 pb-3 text-[var(--danger)]">Sign out failed. Please try again.</p>}
    </header>
  );
}
