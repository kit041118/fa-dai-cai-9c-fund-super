import { NextRequest, NextResponse } from "next/server";
import { addWish } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { validateWish } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const body = await request.json().catch(() => null);
  const parsed = validateWish(body);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.fields);
  const wish = addWish(access.familyId, parsed.value.title, parsed.value.budgetCents);
  return NextResponse.json(wish);
}
