import * as React from "react"
import { TopBar } from "@/components/app-shell/top-bar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-surface text-on-surface">
      <TopBar />
      <main className="w-full pt-20 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
