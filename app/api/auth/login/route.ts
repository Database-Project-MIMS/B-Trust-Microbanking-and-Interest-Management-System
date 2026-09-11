import { NextRequest, NextResponse } from "next/server";
import { login } from "@/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body ?? {};

        if (!username || !password || typeof username !== "string" || typeof password !== "string") {
            return NextResponse.json(
                { error: { code: "INVALID_INPUT", message: "Username and password are required." } },
                { status: 400 }
            );
        }

        const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
        const userAgent = request.headers.get("user-agent") ?? undefined;

        const result = await login(username.trim(), password, ipAddress, userAgent);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: result.statusCode });
        }

        const response = NextResponse.json(
            { data: { user: result.user } },
            { status: 200 }
        );

        // Attach secure cookie
        response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: result.sessionToken!,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            expires: result.sessionExpiresAt,
            path: "/",
        });

        return response;
    } catch {
        return NextResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
            { status: 500 }
        );
    }
}
