import { NextRequest, NextResponse } from "next/server";
import { createSession, createUser, findUserByEmail, toPublicUser } from "@/server/db";
import { jsonError, withSession } from "@/server/http";
import { validateRegister } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = validateRegister(body ?? {});
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.fields);
  if (findUserByEmail(parsed.value.email)) return jsonError("此電郵已註冊", 409);
  const user = createUser({
    email: parsed.value.email,
    password: parsed.value.password,
    displayName: parsed.value.displayName,
  });
  const token = createSession(user.id);
  return withSession(NextResponse.json({ user: toPublicUser(user) }), token);
}
