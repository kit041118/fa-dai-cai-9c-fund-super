import { NextRequest } from "next/server";
import { expenseCsv } from "@/server/db";
import { jsonError } from "@/server/http";
import { requireFamily } from "@/server/session";

export async function GET(request: NextRequest) {
  const access = requireFamily(request);
  if ("error" in access) return jsonError(access.error, access.status);
  const csv = expenseCsv(access.familyId);
  const utfName = encodeURIComponent("發大財家庭基金-支出.csv");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="family-fund-expenses.csv"; filename*=UTF-8''${utfName}`,
      "Cache-Control": "no-store",
    },
  });
}
