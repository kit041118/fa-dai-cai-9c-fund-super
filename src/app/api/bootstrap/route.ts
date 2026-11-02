import { NextRequest, NextResponse } from "next/server";
import {
  getFamilyBundle,
  listConcerts,
  listExpenses,
  listRecipes,
  toPublicUser,
} from "@/server/db";
import { jsonError, withoutSession } from "@/server/http";
import { readSessionUser } from "@/server/session";

export async function GET(request: NextRequest) {
  const user = readSessionUser(request);
  if (!user) return withoutSession(jsonError("請先登入", 401));
  const family = user.familyId ? getFamilyBundle(user.familyId) : null;
  return NextResponse.json({
    user: toPublicUser(user),
    family,
    expenses: family ? listExpenses(family.id) : [],
    recipes: family ? listRecipes(family.id) : [],
    concerts: listConcerts(),
  });
}
