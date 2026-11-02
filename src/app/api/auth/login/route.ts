import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findUserByEmail,
  toPublicUser,
  verifyPassword,
} from "@/server/db";
import { jsonError, withSession } from "@/server/http";
import { validateLogin } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = validateLogin(body ?? {});
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.fields);
  const user = findUserByEmail(parsed.value.email);
  if (!user || !user.passwordHash) {
    if (user && !user.passwordHash) {
      return jsonError("此電郵已連結 Google 或 X，請用原本的方式登入", 400);
    }
    return jsonError("電郵或密碼不正確", 401);
  }
  if (!verifyPassword(user, parsed.value.password)) {
    return jsonError("電郵或密碼不正確", 401);
  }
  const token = createSession(user.id);
  return withSession(NextResponse.json({ user: toPublicUser(user) }), token);
}
