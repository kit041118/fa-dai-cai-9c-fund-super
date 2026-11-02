import { NextRequest, NextResponse } from "next/server";
import { getFamilyBundle, upsertExpense } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { validateExpense } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const family = getFamilyBundle(access.familyId);
  if (!family) return jsonError("找不到家庭", 404);
  const body = await request.json().catch(() => null);
  const parsed = validateExpense(body, {
    categoryIds: family.categories.map((item) => item.id),
    methodIds: family.paymentMethods.map((item) => item.id),
  });
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.fields);
  const result = upsertExpense(access.familyId, access.user.id, parsed.value);
  if ("error" in result) return jsonError(result.error ?? "請求失敗", 400);
  return NextResponse.json({ expense: result.expense });
}
