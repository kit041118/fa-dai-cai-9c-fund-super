import { NextRequest, NextResponse } from "next/server";
import { deleteCategory } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const { id } = await context.params;
  const result = deleteCategory(access.familyId, id);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 400);
  return NextResponse.json({ ok: true });
}
