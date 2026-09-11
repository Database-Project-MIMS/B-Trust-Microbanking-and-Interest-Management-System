import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const CSRF_COOKIE_NAME = "mims_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

export function issueCsrfToken(response: NextResponse): string {
  const token = crypto.randomBytes(32).toString("hex");
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return token;
}

export function verifyCsrf(request: NextRequest): void {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    throw NextResponse.json(
      { error: { code: "FORBIDDEN", message: "CSRF token missing." } },
      { status: 403 }
    );
  }

  const cookieBuf = Buffer.from(cookieToken, "hex");
  const headerBuf = Buffer.from(headerToken, "hex");

  const isValid =
    cookieBuf.length === headerBuf.length &&
    crypto.timingSafeEqual(cookieBuf, headerBuf);

  if (!isValid) {
    throw NextResponse.json(
      { error: { code: "FORBIDDEN", message: "CSRF token invalid." } },
      { status: 403 }
    );
  }
}
