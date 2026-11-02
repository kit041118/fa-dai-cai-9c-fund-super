import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { deleteSession } from "@/server/db";
import { withoutSession } from "@/server/http";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  return withoutSession(NextResponse.json({ ok: true }));
}
