import { NextRequest, NextResponse } from "next/server";
import { deleteWish } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const { id } = await context.params;
  deleteWish(access.familyId, id);
  return NextResponse.json({ ok: true });
}
