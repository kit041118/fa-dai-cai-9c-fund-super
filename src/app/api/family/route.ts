import { NextRequest, NextResponse } from "next/server";
import { createFamily } from "@/server/db";
import { jsonError } from "@/server/http";
import { readSessionUser } from "@/server/session";
import type { Role } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = readSessionUser(request);
  if (!user) return jsonError("請先登入", 401);
  const body = await request.json().catch(() => null);
  const role = body && typeof body === "object" ? (body as { role?: string }).role : undefined;
  if (role !== "boyfriend" && role !== "girlfriend") return jsonError("請選擇你的角色");
  const result = createFamily(user.id, role as Role);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 409);
  return NextResponse.json({ family: result.family });
}
