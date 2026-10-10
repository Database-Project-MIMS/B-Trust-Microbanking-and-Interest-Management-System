import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {errorResponse} from '@/lib/http/error-response';
import { verifyCsrf } from "@/lib/auth/csrf";

export async function POST(request: NextRequest) {
    try {
        verifyCsrf(request);
    } catch (error) {
        if (error instanceof Response) {
            return error;
        }
        return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "Request could not be verified." } },
            { status: 403 },
        );
    }
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    try {if (token) await logout(token);} catch(error){return errorResponse(error);}

    const response = new NextResponse(null, { status: 204 });
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete("mims_csrf");
    return response;
}
