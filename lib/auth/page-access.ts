import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertBranchProfile } from "./rbac";
import { SESSION_COOKIE_NAME, validateSession, type SessionData } from "./session";

/** Resolves the live server session and restricts page access before data is fetched. */
export async function requirePageRole(...roles: string[]): Promise<SessionData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect("/sign-in");
  assertBranchProfile(session.roleName, session.branchId);
  if (!roles.includes(session.roleName)) redirect("/dashboard");
  return session;
}
