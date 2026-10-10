import { NextRequest, NextResponse } from "next/server";
import { login } from "@/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { issueCsrfToken } from "@/lib/auth/csrf";
import { errorResponse } from "@/lib/http/error-response";

export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(`${new URL(request.url).protocol}//${request.headers.get('host') ?? new URL(request.url).host}`).origin) {
            return NextResponse.json({ error: { code: "FORBIDDEN", message: "Request origin could not be verified." } }, { status: 403 });
        }
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
            return NextResponse.json({ error: { code: "INVALID_INPUT", message: "A JSON request is required." } }, { status: 400 });
        }
        const body = await request.json();
        const { username, password } = body ?? {};

        if (!username || !password || typeof username !== "string" || typeof password !== "string" || username.trim().length > 100 || password.length > 4096) {
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
        issueCsrfToken(response);

        return response;
    } catch (error) {
        return errorResponse(error);
    }
}
