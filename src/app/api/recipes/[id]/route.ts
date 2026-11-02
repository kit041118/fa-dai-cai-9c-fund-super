import { NextRequest, NextResponse } from "next/server";
import { deleteRecipe, setRecipeCooked } from "@/server/db";
import { isValidIsoDate } from "@/lib/format";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const { id } = await context.params;
  deleteRecipe(access.familyId, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const cookedOn =
    body && typeof body === "object" ? (body as { cookedOn?: unknown }).cookedOn : undefined;
  const value = cookedOn == null || cookedOn === "" ? null : String(cookedOn);
  if (value !== null && !isValidIsoDate(value)) return jsonError("煮食日期不正確");
  const result = setRecipeCooked(access.familyId, id, value);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 404);
  return NextResponse.json({ ok: true });
}
