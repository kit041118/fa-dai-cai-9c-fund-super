import { NextRequest, NextResponse } from "next/server";
import { createRecipe } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";
import { validateRecipe } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const body = await request.json().catch(() => null);
  const parsed = validateRecipe(body);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.fields);
  const recipe = createRecipe(access.familyId, access.user.id, parsed.value);
  return NextResponse.json({ recipe });
}
