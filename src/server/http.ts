import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";
import type { FieldErrors } from "@/lib/validate";

export function cookieOptions(maxAge = 60 * 60 * 24 * SESSION_DAYS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function withSession(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}

export function withoutSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}

export function jsonError(error: string, status = 400, fields?: FieldErrors) {
  return NextResponse.json({ error, fields }, { status });
}

export function browserOrigin(request: NextRequest) {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
