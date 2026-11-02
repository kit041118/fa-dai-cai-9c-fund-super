import type { ExpenseUpsert, Role, Scope } from "@/lib/types";
import { isValidIsoDate, parseHkdToCents } from "@/lib/format";

export type FieldErrors = Record<string, string>;

export type AuthInput = {
  email: string;
  password: string;
  displayName?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: {
  email?: unknown;
  password?: unknown;
}): { ok: true; value: { email: string; password: string } } | { ok: false; error: string; fields: FieldErrors } {
  const fields: FieldErrors = {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!email) fields.email = "請輸入電郵";
  else if (!EMAIL_RE.test(email) || email.length > 120) fields.email = "電郵格式不正確";
  if (!password) fields.password = "請輸入密碼";
  else if (password.length < 8) fields.password = "密碼至少 8 個字元";
  else if (password.length > 72) fields.password = "密碼最多 72 個字元";
  if (Object.keys(fields).length) {
    return { ok: false, error: Object.values(fields)[0] ?? "請檢查欄位", fields };
  }
  return { ok: true, value: { email, password } };
}

export function validateRegister(input: {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}):
  | { ok: true; value: { email: string; password: string; displayName: string } }
  | { ok: false; error: string; fields: FieldErrors } {
  const base = validateLogin(input);
  const fields = base.ok ? {} : { ...base.fields };
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!displayName) fields.displayName = "請輸入顯示名稱";
  else if (displayName.length > 20) fields.displayName = "顯示名稱最多 20 字";
  if (!base.ok || Object.keys(fields).length) {
    const merged = base.ok ? fields : { ...base.fields, ...fields };
    return { ok: false, error: Object.values(merged)[0] ?? "請檢查欄位", fields: merged };
  }
  return { ok: true, value: { ...base.value, displayName } };
}

export function validateExpense(
  input: unknown,
  ctx: { categoryIds: string[]; methodIds: string[] },
): { ok: true; value: ExpenseUpsert } | { ok: false; error: string; fields: FieldErrors } {
  const body = asRecord(input);
  const fields: FieldErrors = {};
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) fields.id = "紀錄編號不正確";

  let amountCents = 0;
  if (typeof body.amountCents === "number" && Number.isInteger(body.amountCents)) {
    if (body.amountCents <= 0) fields.amount = "金額須大於 0";
    else if (body.amountCents > 100_000_000) fields.amount = "金額不能超過 HK$1,000,000";
    else amountCents = body.amountCents;
  } else if (typeof body.amount === "string" || typeof body.amount === "number") {
    const parsed = parseHkdToCents(String(body.amount));
    if (!parsed.ok) fields.amount = parsed.error;
    else amountCents = parsed.cents;
  } else {
    fields.amount = "請輸入金額";
  }

  const payer = body.payer;
  if (payer !== "boyfriend" && payer !== "girlfriend") fields.payer = "請選擇付款人";

  const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";
  if (!ctx.methodIds.includes(paymentMethodId)) fields.paymentMethodId = "請選擇支付類型";

  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  if (!ctx.categoryIds.includes(categoryId)) fields.categoryId = "請選擇消費類型";

  const spentOn = typeof body.spentOn === "string" ? body.spentOn : "";
  if (!isValidIsoDate(spentOn)) fields.spentOn = "請選擇有效日期";

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 200) fields.note = "備註最多 200 字";

  const scope = body.scope;
  if (scope !== "shared" && scope !== "personal") fields.scope = "請選擇支出歸屬";

  if (Object.keys(fields).length) {
    return { ok: false, error: Object.values(fields)[0] ?? "請檢查欄位", fields };
  }

  return {
    ok: true,
    value: {
      id,
      amountCents,
      payer: payer as Role,
      paymentMethodId,
      categoryId,
      spentOn,
      note,
      scope: scope as Scope,
    },
  };
}

export function validateDisplayName(raw: unknown, label: string): string | { error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { error: `請輸入${label}` };
  if (name.length > 12) return { error: `${label}最多 12 字` };
  return name;
}

export function validateItemName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "請輸入名稱" };
  if (name.length > 20) return { ok: false, error: "名稱最多 20 字" };
  return { ok: true, name };
}

export function validateWish(input: unknown):
  | { ok: true; value: { title: string; budgetCents: number | null } }
  | { ok: false; error: string; fields: FieldErrors } {
  const body = asRecord(input);
  const fields: FieldErrors = {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) fields.title = "請輸入願望";
  else if (title.length > 40) fields.title = "願望最多 40 字";
  let budgetCents: number | null = null;
  const budgetRaw = body.budget;
  if (typeof budgetRaw === "string" && budgetRaw.trim()) {
    const parsed = parseHkdToCents(budgetRaw, { maxDollars: 10_000_000 });
    if (!parsed.ok) fields.budget = parsed.error;
    else budgetCents = parsed.cents;
  } else if (budgetRaw == null || budgetRaw === "") {
    budgetCents = null;
  } else {
    fields.budget = "請輸入有效預算";
  }
  if (Object.keys(fields).length) {
    return { ok: false, error: Object.values(fields)[0] ?? "請檢查欄位", fields };
  }
  return { ok: true, value: { title, budgetCents } };
}

export function validateRecipe(input: unknown):
  | {
      ok: true;
      value: {
        title: string;
        photoUrl: string;
        ingredients: string[];
        steps: string[];
        servings: number;
      };
    }
  | { ok: false; error: string; fields: FieldErrors } {
  const body = asRecord(input);
  const fields: FieldErrors = {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) fields.title = "請輸入食譜名稱";
  else if (title.length > 40) fields.title = "食譜名稱最多 40 字";

  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";
  if (photoUrl && !/^https?:\/\/\S+$/i.test(photoUrl)) fields.photoUrl = "相片網址須以 http 或 https 開頭";
  if (photoUrl.length > 500) fields.photoUrl = "相片網址太長";

  const ingredients = stringList(body.ingredients, 40, 80);
  const steps = stringList(body.steps, 30, 200);
  if (!ingredients.length) fields.ingredients = "請至少填一項材料";
  if (!steps.length) fields.steps = "請至少填一個步驟";

  const servings = Number(body.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
    fields.servings = "份量須為 1 至 20";
  }

  if (Object.keys(fields).length) {
    return { ok: false, error: Object.values(fields)[0] ?? "請檢查欄位", fields };
  }
  return {
    ok: true,
    value: { title, photoUrl, ingredients, steps, servings },
  };
}

export function validateInviteCode(raw: unknown): { ok: true; code: string } | { ok: false; error: string } {
  const code = typeof raw === "string" ? raw.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!/^[A-Z0-9]{6}$/.test(code)) return { ok: false, error: "邀請碼須為 6 位英數" };
  return { ok: true, code };
}

function stringList(value: unknown, maxItems: number, maxLen: number): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  return source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLen));
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}
