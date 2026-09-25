"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { name: "Overview", href: "/dashboard" },
  { name: "Liquidity", href: "/dashboard/liquidity" },
  { name: "Yield Vaults", href: "/dashboard/fixed-deposits" },
  { name: "Payments", href: "/dashboard/transactions" },
  { name: "FX Desks", href: "/dashboard/fx-desks" },
  { name: "Cards", href: "/dashboard/cards" },
  { name: "Insights", href: "/dashboard/insights" },
  { name: "Compliance", href: "/dashboard/compliance" },
  { name: "Concierge", href: "/dashboard/concierge" },
  { name: "Security", href: "/dashboard/security" },
]

export function TopBar() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-20 max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between gap-gutter">
        
        {/* Brand */}
        <div className="flex items-center gap-space-sm shrink-0">
          <Link href="/dashboard" className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight">B-Trust</span>
          </Link>
          <div className="hidden xl:flex items-center gap-space-xs pl-space-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Operational • Central Bank Monitored</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-space-xs p-1 bg-surface-container-low rounded-full shadow-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User / Meta */}
        <div className="flex items-center gap-space-sm shrink-0">
          <div className="flex items-center bg-surface-container-low p-0.5 rounded-full text-label-caps font-label-caps text-on-surface-variant">
            <span className="px-2.5 py-1 rounded-full bg-surface text-primary shadow-sm">LKR</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary-container transition-colors">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>

      </div>
    </header>
  )
}
