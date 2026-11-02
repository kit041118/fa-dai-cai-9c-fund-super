import { NextRequest } from "next/server";
import { deleteExpense } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const { id } = await context.params;
  deleteExpense(access.familyId, id);
  return NextResponse.json({ ok: true });
}
