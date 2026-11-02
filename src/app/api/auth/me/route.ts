import { NextRequest, NextResponse } from "next/server";
import { readSessionUser } from "@/server/session";
import { toPublicUser } from "@/server/db";
import { jsonError, withoutSession } from "@/server/http";

export async function GET(request: NextRequest) {
  const user = readSessionUser(request);
  if (!user) return withoutSession(jsonError("請先登入", 401));
  return NextResponse.json({ user: toPublicUser(user) });
}
