import { NextRequest, NextResponse } from "next/server";
import { applySyncOps, getFamilyBundle } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import type { SyncOp } from "@/lib/types";
import { isValidIsoDate } from "@/lib/format";
import { validateExpense } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const family = getFamilyBundle(access.familyId);
  if (!family) return jsonError("找不到家庭", 404);
  const body = await request.json().catch(() => null);
  const rawOps = body && typeof body === "object" && Array.isArray((body as { ops?: unknown }).ops)
    ? (body as { ops: unknown[] }).ops
    : null;
  if (!rawOps) return jsonError("同步內容不正確");
  if (rawOps.length > 50) return jsonError("一次最多同步 50 筆");

  const ops: SyncOp[] = [];
  const rejected: { opId: string; error: string }[] = [];
  for (const raw of rawOps) {
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const opId = typeof record.opId === "string" ? record.opId : "";
    if (!opId) {
      rejected.push({ opId: "unknown", error: "缺少同步編號" });
      continue;
    }
    if (record.kind === "expense.delete" && typeof record.id === "string") {
      ops.push({ opId, kind: "expense.delete", id: record.id });
      continue;
    }
    if (record.kind === "recipe.cooked" && typeof record.id === "string") {
      const cookedOn = record.cookedOn == null ? null : String(record.cookedOn);
      if (cookedOn !== null && !isValidIsoDate(cookedOn)) {
        rejected.push({ opId, error: "煮食日期不正確" });
        continue;
      }
      ops.push({ opId, kind: "recipe.cooked", id: record.id, cookedOn });
      continue;
    }
    if (record.kind === "expense.upsert") {
      const parsed = validateExpense(record.expense, {
        categoryIds: family.categories.map((item) => item.id),
        methodIds: family.paymentMethods.map((item) => item.id),
      });
      if (!parsed.ok) {
        rejected.push({ opId, error: parsed.error });
        continue;
      }
      ops.push({ opId, kind: "expense.upsert", expense: parsed.value });
      continue;
    }
    rejected.push({ opId, error: "不支援的同步動作" });
  }

  const result = applySyncOps(access.familyId, access.user.id, ops);
  return NextResponse.json({
    applied: result.applied,
    rejected: [...rejected, ...result.rejected],
  });
}
