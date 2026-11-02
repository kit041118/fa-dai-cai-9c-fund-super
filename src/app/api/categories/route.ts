import { NextRequest, NextResponse } from "next/server";
import { addCategory } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { validateItemName } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const body = await request.json().catch(() => null);
  const name = validateItemName(body && typeof body === "object" ? (body as { name?: unknown }).name : "");
  if (!name.ok) return jsonError(name.error);
  const result = addCategory(access.familyId, name.name);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 409);
  return NextResponse.json(result);
}
