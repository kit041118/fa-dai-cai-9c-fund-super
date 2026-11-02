import { NextRequest, NextResponse } from "next/server";
import { browserOrigin } from "@/server/http";
import { beginOAuth, isOAuthProvider, oauthConfigured } from "@/server/oauth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  const login = new URL("/login", `${browserOrigin(request)}/`);
  if (!isOAuthProvider(raw)) {
    login.searchParams.set("oauth", "error");
    return NextResponse.redirect(login);
  }
  if (!oauthConfigured(raw)) {
    login.searchParams.set("oauth", raw);
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(beginOAuth(raw, browserOrigin(request)));
}
