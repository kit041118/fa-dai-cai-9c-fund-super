import { NextRequest, NextResponse } from "next/server";
import { getFamilyBundle, updateFamilySettings } from "@/server/db";
import { parseHkdToCents } from "@/lib/format";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { validateDisplayName } from "@/lib/validate";

export async function PATCH(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const body = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const boyfriendName = validateDisplayName(record.boyfriendName, "男朋友顯示名稱");
  const girlfriendName = validateDisplayName(record.girlfriendName, "女朋友顯示名稱");
  if (typeof boyfriendName !== "string") return jsonError(boyfriendName.error, 400, { boyfriendName: boyfriendName.error });
  if (typeof girlfriendName !== "string") {
    return jsonError(girlfriendName.error, 400, { girlfriendName: girlfriendName.error });
  }
  const goalRaw = typeof record.monthlyGoal === "string" || typeof record.monthlyGoal === "number"
    ? String(record.monthlyGoal)
    : "";
  const goal = parseHkdToCents(goalRaw, { allowZero: true, maxDollars: 10_000_000 });
  if (!goal.ok) return jsonError(goal.error, 400, { monthlyGoal: goal.error });
  const family = updateFamilySettings(access.familyId, {
    boyfriendName,
    girlfriendName,
    monthlyGoalCents: goal.cents,
  });
  return NextResponse.json({ family });
}

export async function GET(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  return NextResponse.json({ family: getFamilyBundle(access.familyId) });
}
