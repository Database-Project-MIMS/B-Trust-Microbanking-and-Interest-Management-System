import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
        await logout(token);
    }

    const response = new NextResponse(null, { status: 204 });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
}
