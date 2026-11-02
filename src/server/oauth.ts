import crypto from "node:crypto";
import {
  createSession,
  saveOAuthState,
  takeOAuthState,
  upsertOAuthUser,
} from "@/server/db";

export type OAuthProvider = "google" | "x";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "x";
}

export function oauthConfigured(provider: OAuthProvider) {
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

export function beginOAuth(provider: OAuthProvider, origin: string) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const state = saveOAuthState(provider, verifier);
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.X_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "users.read users.email tweet.read");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type OAuthProfile = { subject: string; email: string; displayName: string };

export async function finishOAuth(input: {
  provider: OAuthProvider;
  code: string;
  state: string;
  origin: string;
}): Promise<{ token: string } | { error: string }> {
  const saved = takeOAuthState(input.state, input.provider);
  if (!saved) return { error: "登入狀態已過期，請再試一次" };
  const redirectUri = `${input.origin}/api/auth/oauth/${input.provider}/callback`;
  const profile =
    input.provider === "google"
      ? await googleProfile(input.code, redirectUri)
      : await xProfile(input.code, redirectUri, saved.verifier);
  if ("error" in profile) return { error: profile.error };
  const user = upsertOAuthUser({
    provider: input.provider,
    subject: profile.subject,
    email: profile.email,
    displayName: profile.displayName,
  });
  return { token: createSession(user.id) };
}

async function googleProfile(code: string, redirectUri: string): Promise<OAuthProfile | { error: string }> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return { error: "Google 登入失敗" };
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return { error: "Google 登入失敗" };
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return { error: "無法讀取 Google 帳號" };
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    given_name?: string;
  };
  if (!profile.sub || !profile.email) return { error: "Google 帳號沒有電郵，請改用電郵註冊" };
  return {
    subject: profile.sub,
    email: profile.email,
    displayName: profile.given_name || profile.name || "家人",
  };
}

async function xProfile(code: string, redirectUri: string, verifier: string): Promise<OAuthProfile | { error: string }> {
  const clientId = process.env.X_CLIENT_ID ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET ?? "";
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      client_id: clientId,
    }),
  });
  if (!tokenResponse.ok) return { error: "X 登入失敗" };
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return { error: "X 登入失敗" };
  const profileResponse = await fetch(
    "https://api.x.com/2/users/me?user.fields=name,username,confirmed_email",
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  );
  if (!profileResponse.ok) return { error: "無法讀取 X 帳號" };
  const profile = (await profileResponse.json()) as {
    data?: { id?: string; name?: string; username?: string; confirmed_email?: string };
  };
  const email = profile.data?.confirmed_email;
  if (!profile.data?.id || !email) {
    return { error: "X 帳號沒有可讀取的電郵，請改用電郵註冊" };
  }
  return {
    subject: profile.data.id,
    email,
    displayName: profile.data.name || profile.data.username || "家人",
  };
}
