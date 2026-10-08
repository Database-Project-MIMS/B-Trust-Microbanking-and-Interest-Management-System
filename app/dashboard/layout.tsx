import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;

  if (!session) {
    redirect("/sign-in?next=/dashboard");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
