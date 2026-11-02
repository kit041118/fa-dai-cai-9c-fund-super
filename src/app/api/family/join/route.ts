import { NextRequest, NextResponse } from "next/server";
import { joinFamily } from "@/server/db";
import { jsonError } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { validateInviteCode } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const user = readSessionUser(request);
  if (!user) return jsonError("請先登入", 401);
  const body = await request.json().catch(() => null);
  const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
  const parsed = validateInviteCode(code);
  if (!parsed.ok) return jsonError(parsed.error);
  const result = joinFamily(user.id, parsed.code);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 400);
  return NextResponse.json({ family: result.family });
}
