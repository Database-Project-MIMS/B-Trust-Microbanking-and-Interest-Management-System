import type { ReactNode } from "react";
import { TopBar } from "@/components/app-shell/top-bar";
import type { SessionData } from "@/lib/auth/session";
import { MotionSurface } from "@/components/motion-surface";

interface AppShellProps {
  children: ReactNode;
  session: SessionData;
}

/** Provides the authenticated MIMS layout around a server-validated session. */
export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--surface-muted)] text-[var(--text)]">
      <TopBar session={session} />
      <MotionSurface className="workspace-content"><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main></MotionSurface>
    </div>
  );
}
