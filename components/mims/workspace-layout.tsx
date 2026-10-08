import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

/** Applies the authenticated MIMS shell to workflow routes outside /dashboard. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect("/sign-in");
  return <AppShell session={session}>{children}</AppShell>;
}
