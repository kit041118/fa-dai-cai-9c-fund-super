import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { buildExpenseCsv } from "../src/lib/csv.ts";
import { formatHkd, hkMonthKey, parseHkdToCents, previousMonthKey } from "../src/lib/format.ts";
import { mergeExpenses, queueExpenseDelete, queueExpenseUpsert } from "../src/lib/sync.ts";
import { validateExpense, validateInviteCode, validateRegister } from "../src/lib/validate.ts";
import {
  createFamily,
  createUser,
  deleteCategory,
  expenseCsv,
  findUserByEmail,
  getFamilyBundle,
  joinFamily,
  listExpenses,
  resetDbForTests,
  upsertExpense,
} from "../src/server/db.ts";
import type { Expense, ExpenseUpsert, SyncOp } from "../src/lib/types.ts";

const dir = mkdtempSync(path.join(tmpdir(), "family-fund-"));
process.env.FAMILY_FUND_SEED = "0";
resetDbForTests(path.join(dir, "test.db"));

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("password, money, invite code and csv", () => {
  const register = validateRegister({ email: "a@b.co", password: "short", displayName: "A" });
  assert.equal(register.ok, false);
  const ok = validateRegister({ email: "Alex@Example.com", password: "familyfund", displayName: " Alex " });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.email, "alex@example.com");

  assert.deepEqual(parseHkdToCents("1,246.80"), { ok: true, cents: 124680 });
  assert.equal(parseHkdToCents("0").ok, false);
  assert.equal(parseHkdToCents("0", { allowZero: true }).ok, true);
  assert.equal(formatHkd(24680), "HK$246.80");
  assert.equal(formatHkd(1600), "HK$16");
  assert.equal(validateInviteCode(" 9fm88k ").ok, true);
  assert.equal(previousMonthKey("2026-01"), "2025-12");
  assert.match(hkMonthKey(), /^\d{4}-\d{2}$/);

  const csv = buildExpenseCsv([
    {
      spentOn: "2026-11-02",
      payerName: "男朋友",
      paymentMethod: "八達通",
      category: "餐飲",
      amountCents: 1690,
      scope: "shared",
      note: "=公式",
    },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /\r\n/);
  assert.match(csv, /日期,付款人,支付類型,消費類型,金額\(HKD\),歸屬,備註/);
  assert.match(csv, /16\.90/);
  assert.match(csv, /'=公式/);
});

test("create, join, expense, blocked category delete, csv export", () => {
  const alex = createUser({ email: "alex@test.hk", password: "familyfund", displayName: "Alex" });
  const may = createUser({ email: "may@test.hk", password: "familyfund", displayName: "May" });
  const created = createFamily(alex.id, "boyfriend");
  assert.ok(!("error" in created));
  if ("error" in created) return;
  assert.equal(created.family.inviteCode.length, 6);
  assert.equal(created.family.categories.length, 8);
  assert.equal(created.family.paymentMethods.some((item) => item.name === "八達通"), true);

  const joined = joinFamily(may.id, created.family.inviteCode.toLowerCase());
  assert.ok(!("error" in joined));
  if ("error" in joined) return;
  assert.equal(joined.family.members.length, 2);
  const mayUser = findUserByEmail("may@test.hk");
  assert.equal(mayUser?.role, "girlfriend");

  const full = joinFamily(
    createUser({ email: "third@test.hk", password: "familyfund", displayName: "Sam" }).id,
    created.family.inviteCode,
  );
  assert.equal("error" in full && full.error.includes("兩位"), true);

  const family = getFamilyBundle(created.family.id)!;
  const expense: ExpenseUpsert = {
    id: crypto.randomUUID(),
    amountCents: 8800,
    payer: "girlfriend",
    paymentMethodId: family.paymentMethods[0].id,
    categoryId: family.categories[0].id,
    spentOn: "2026-11-02",
    note: "早餐",
    scope: "shared",
  };
  const saved = upsertExpense(family.id, alex.id, expense);
  assert.ok(!("error" in saved));
  assert.equal(listExpenses(family.id).length, 1);
  const updated = upsertExpense(family.id, may.id, { ...expense, amountCents: 9900, note: "早餐加蛋" });
  assert.ok(!("error" in updated));
  assert.equal(listExpenses(family.id)[0]?.amountCents, 9900);

  const blocked = deleteCategory(family.id, family.categories[0].id);
  assert.equal("error" in blocked, true);

  const csv = expenseCsv(family.id);
  assert.match(csv, /女朋友/);
  assert.match(csv, /99\.00/);
  assert.match(csv, /早餐加蛋/);
});

test("offline queue overlays creates and deletes", () => {
  const base: Expense = {
    id: "server-1",
    amountCents: 1000,
    payer: "boyfriend",
    paymentMethodId: "m1",
    paymentMethodName: "現金",
    categoryId: "c1",
    categoryName: "餐飲",
    spentOn: "2026-11-01",
    note: "飯",
    scope: "shared",
    createdBy: "u",
    updatedAt: "",
  };
  const draft: ExpenseUpsert = {
    id: "local-1",
    amountCents: 2500,
    payer: "girlfriend",
    paymentMethodId: "m1",
    categoryId: "c1",
    spentOn: "2026-11-02",
    note: "咖啡",
    scope: "personal",
  };
  const family = {
    id: "f",
    inviteCode: "ABCDEF",
    boyfriendName: "男朋友",
    girlfriendName: "女朋友",
    monthlyGoalCents: 0,
    categories: [{ id: "c1", name: "餐飲", sortOrder: 0 }],
    paymentMethods: [{ id: "m1", name: "現金", sortOrder: 0 }],
    wishes: [],
    members: [],
  };
  let queue: SyncOp[] = [];
  queue = queueExpenseUpsert(queue, draft);
  queue = queueExpenseDelete(queue, "server-1", true);
  queue = queueExpenseDelete(queue, "local-1", false);
  const merged = mergeExpenses([base], queue, family);
  assert.equal(merged.length, 0);
});
