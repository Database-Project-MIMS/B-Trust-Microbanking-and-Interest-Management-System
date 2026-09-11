import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";

export interface AuthenticatedUser {
  userId: string;
  username: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
}

export interface BranchScope {
  branchId: string | null;
}

export async function requireUser(request: NextRequest): Promise<AuthenticatedUser> {
  const token = request.cookies.get("mims_session")?.value;

  if (!token) {
    throw NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const session = await validateSession(token);

  if (!session) {
    throw NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Session expired or invalid." } },
      { status: 401 }
    );
  }

  return {
    userId: session.userId,
    username: session.username,
    roleId: session.roleId,
    roleName: session.roleName,
    branchId: session.branchId ?? null,
  };
}

export function requireRole(user: AuthenticatedUser, ...allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.roleName)) {
    throw NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } },
      { status: 403 }
    );
  }
}

const BANK_WIDE_ROLES = ["ADMIN", "CENTRAL_OPS", "AUDITOR"];

export function branchScope(user: AuthenticatedUser): BranchScope {
  if (BANK_WIDE_ROLES.includes(user.roleName)) {
    return { branchId: null };
  }
  return { branchId: user.branchId };
}

export function withAuth(
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const user = await requireUser(req);
      return await handler(req, user);
    } catch (e) {
      if (e instanceof NextResponse) return e;
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
        { status: 500 }
      );
    }
  };
}
