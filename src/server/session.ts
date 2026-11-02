import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { getUserBySessionToken, type DbUser } from "@/server/db";

export function readSessionUser(request: NextRequest): DbUser | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(token) ?? null;
}

export function requireFamily(
  request: NextRequest,
): { user: DbUser; familyId: string } | { error: string; status: number } {
  const user = readSessionUser(request);
  if (!user) return { error: "請先登入", status: 401 };
  const familyId = user.familyId;
  if (!familyId) return { error: "請先建立或加入家庭", status: 409 };
  return { user, familyId };
}
