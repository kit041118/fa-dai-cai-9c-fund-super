import { NextRequest, NextResponse } from "next/server";
import { browserOrigin, withSession } from "@/server/http";
import { finishOAuth, isOAuthProvider, oauthConfigured } from "@/server/oauth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  const login = new URL("/login", `${browserOrigin(request)}/`);
  login.searchParams.set("oauth", "error");
  if (!isOAuthProvider(raw) || !oauthConfigured(raw)) return NextResponse.redirect(login);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || request.nextUrl.searchParams.get("error")) {
    return NextResponse.redirect(login);
  }
  const origin = browserOrigin(request);
  try {
    const result = await finishOAuth({ provider: raw, code, state, origin });
    if (!("token" in result)) return NextResponse.redirect(login);
    const home = new URL("/", request.url);
    return withSession(NextResponse.redirect(home), result.token);
  } catch {
    return NextResponse.redirect(login);
  }
}
